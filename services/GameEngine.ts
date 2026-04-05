import * as PIXI from 'pixi.js';
import { FruitDef, FruitTier, GameSettings, GameStats, PointEvent, PopupData, PopUpType } from '../types';
import { FRUIT_DEFS, GAME_CONFIG, DANGER_TIME_MS, DANGER_Y_PERCENT, SPAWN_Y_PERCENT, SCORE_BASE_MERGE, FEVER_DURATION_MS, JUICE_MAX, SUBSTEPS } from '../constants';
import { MusicEngine } from './MusicEngine';
import { Particle, TomatoEffect, BombEffect, CelebrationState } from '../types/GameObjects';

// Systems
import { PhysicsSystem, PhysicsCallbacks, PhysicsContext } from './systems/PhysicsSystem';
import { InputSystem } from './systems/InputSystem';
import { EffectSystem } from './systems/EffectSystem';
import { RenderSystem } from './systems/RenderSystem';
import { ScoreController } from './systems/ScoreController';
import { CloudRenderer } from './renderers/CloudRenderer';
import { WallRenderer } from './renderers/WallRenderer';
import { GroundRenderer } from './renderers/GroundRenderer';
import { JuiceRenderer } from './renderers/JuiceRenderer';
import { GameVisibility } from './GameVisibility';
import { GameResize } from './GameResize';
import { GameInput } from './GameInput';
import { GameLogic } from './GameLogic';

// --- Virtual Resolution ---
// Aspect Ratio: 4:5
const V_WIDTH = 600;
const V_HEIGHT = 750;

// --- Engine ---
export class GameEngine {
    // PIXI references (Managed by RenderSystem mainly, but Engine holds App for Lifecycle)
    app: PIXI.Application | undefined;
    container: PIXI.Container;

    // Systems
    physicsSystem: PhysicsSystem;
    inputSystem: InputSystem;
    effectSystem: EffectSystem;
    renderSystem: RenderSystem;
    scoreController: ScoreController;
    cloudRenderer: CloudRenderer | null = null;
    wallRenderer: WallRenderer | null = null;
    groundRenderer: GroundRenderer | null = null;
    juiceRenderer: JuiceRenderer | null = null;
    gameLogic: GameLogic | null = null;
    _screenWidth = 0;
    _screenHeight = 0;
    _containerTop = 0;
    _containerLeft = 0;
    _gameAreaWidth = 0;
    _gameAreaHeight = 0;

    // Game State
    fruits: Particle[] = [];
    nextId: number = 0;
    canvasElement: HTMLCanvasElement;

    width: number = V_WIDTH;
    height: number = V_HEIGHT;
    scaleFactor: number = 1;

    settings: GameSettings;
    destroyed: boolean = false;
    initializing: boolean = false;
    paused: boolean = false;

    currentFruit: Particle | null = null;
    nextFruitTier: FruitTier = FruitTier.CHERRY;
    nextFruitQueue: FruitTier[] = [];
    canDrop: boolean = true;

    // Active Effects State
    activeTomatoes: TomatoEffect[] = [];
    activeBombs: BombEffect[] = [];
    celebrationEffect: CelebrationState | null = null;

    audio: MusicEngine;

    // Callbacks
    onScore: (amount: number, total: number) => void = () => { };
    onGameOver: (stats: GameStats) => void = () => { };
    onCombo: (count: number) => void = () => { };
    onFeverStart: (mult: number) => void = () => { };
    onFeverEnd: (finalScore?: number) => void = () => { };
    onDanger: (active: boolean, remainingMs: number) => void = () => { };
    onJuiceUpdate: (current: number, max: number) => void = () => { };
    onNextFruit: (tier: FruitTier) => void = () => { };
    onMaxFruit: (tier: FruitTier) => void = () => { };
    onTimeUpdate: (ms: number) => void = () => { };
    onSaveUpdate: (tier: FruitTier | null) => void = () => { };
    onCelebration: () => void = () => { };
    onPointEvent: (event: PointEvent) => void = () => { };
    onPopupUpdate: (data: PopupData) => void = () => { };

    // New Callbacks for Score System refactor
    onPopupStash: () => void = () => { };
    onPopupRestore: (data: PopupData) => void = () => { };
    onStreakEnd: (amount: number, totalRealScore: number) => void = () => { };

    stats: GameStats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };

    didMergeThisTurn: boolean = false;

    savedFruitTier: FruitTier | null = null;
    canSwap: boolean = true;

    dangerTimer: number = 0;
    dangerActive: boolean = false;
    dangerAccumulator: number = 0;
    isOverLimit: boolean = false;
    readonly DANGER_TRIGGER_DELAY: number = 3000;

    // Spawn Logic State
    consecutiveNonSpecialCount: number = 0;
    generatedFruitCount: number = 0;

    // Performance Stats (updated every frame, read by UI overlay)
    perfStats = {
        fps: 0,
        frameTimeMs: 0,
        fruitCount: 0,
        particleCount: 0,
        audioQueueLength: 0,
        heapUsedMB: 0,
        heapTotalMB: 0,
        substeps: 0,
    };
    private _perfLastTime: number = 0;
    private _perfFrameCount: number = 0;
    private _perfFpsAccumulator: number = 0;
    private _perfMemoryAccumulator: number = 0;

    // Optimization: Reused Objects
    private _physicsContext: PhysicsContext;
    private _physicsCallbacks: PhysicsCallbacks;
    private _effectContext: { fruits: Particle[]; fruitMap: Map<number, Particle>; activeTomatoes: TomatoEffect[]; currentFruit: Particle | null; feverActive: boolean; width: number; height: number };
    private _timeUpdateAccumulator: number = 0; // Throttle onTimeUpdate to 4x/s instead of 60x/s
    // Optimization: O(1) fruit lookups in updateGameLogic (replaces .find() per active effect per frame)
    _fruitsById: Map<number, Particle> = new Map();

    spawnTimeout: any = null;
    gameVisibility: GameVisibility | null = null;
    gameResize: GameResize | null = null;
    gameInput: GameInput | null = null;
    private visibilityHandler: (() => void) | null = null;
    private contextRestoredHandler: (() => void) | null = null;

    constructor(
        canvas: HTMLCanvasElement,
        settings: GameSettings,
        callbacks: any
    ) {
        this.canvasElement = canvas;
        this.settings = settings;
        Object.assign(this, callbacks);

        // Core PIXI Containers
        this.container = new PIXI.Container();

        // Initialize Systems
        this.physicsSystem = new PhysicsSystem();
        this.inputSystem = new InputSystem();
        this.effectSystem = new EffectSystem();
        this.renderSystem = new RenderSystem();
        this.scoreController = new ScoreController();

        // Wire up ScoreController Callbacks
        this.scoreController.onScoreChange = (total, added) => {
            this.stats.score = total;
            this.onScore(added, total);
        };

        this.scoreController.onPopupUpdate = (streak, mult, isFever) => {
            this.onPopupUpdate({
                runningTotal: streak,
                multiplier: mult,
                type: isFever ? PopUpType.FRENZY : PopUpType.CHAIN
            });
            // Also sync combo count
            if (!isFever) {
                this.onCombo(this.scoreController.getChainCount());
            }
        };

        this.scoreController.onJuiceUpdate = (curr, max) => {
            this.onJuiceUpdate(curr, max);
            if (this.juiceRenderer) {
                this.juiceRenderer.update((curr / max) * 100, this.scoreController.isFever());
            }
        };

        let lastFeverTime = 0;
        this.scoreController.onFeverStart = (mult) => {
            this.audio.setFrenzy(true);
            this.audio.playFrenzyStart();
            this.stats.feverCount++;
            lastFeverTime = FEVER_DURATION_MS; // Reset tracker
            this.onFeverStart(mult);
            if (this.juiceRenderer) {
                this.juiceRenderer.update(this.scoreController.getFeverMeter() / JUICE_MAX * 100, true);
            }
        };

        this.scoreController.onFeverTick = (remaining, total) => {
            // Detect 500ms boundary crossing for tick sound
            const prevTick = Math.floor(lastFeverTime / 500);
            const currTick = Math.floor(remaining / 500);

            if (currTick < prevTick && lastFeverTime > 0) {
                const progress = 1.0 - (remaining / total);
                this.audio.playFrenzyTick(progress);
            }
            lastFeverTime = remaining;
        };

        this.scoreController.onFeverEnd = (suckedPoints) => {
            this.audio.setFrenzy(false);
            this.audio.playFrenzyEnd();
            lastFeverTime = 0;
            this.onFeverEnd(suckedPoints);
            if (this.juiceRenderer) {
                this.juiceRenderer.update(0, false);
            }
        };

        this.scoreController.onStreakEnd = (suckedPoints, totalScore) => {
            this.onStreakEnd(suckedPoints, totalScore);
        };

        this.scoreController.onChainReset = () => {
            this.onCombo(0);
        };

        this.audio = new MusicEngine(this.settings.musicEnabled, this.settings.sfxEnabled);

        // Optimization: Initialize reusable objects
        this._physicsContext = {
            fruits: [],
            fruitMap: this._fruitsById,
            activeTomatoes: [],
            activeBombs: [],
            celebrationEffect: null,
            currentFruit: null,
            isAiming: false,
            dragAnchorX: 0,
            dragAnchorY: 0,
            width: this.width,
            height: this.height
        };

        this._physicsCallbacks = {
            onMerge: (p1, p2) => this.merge(p1, p2),
            onBombExplosion: (bomb) => this.handleBombExplosion(bomb),
            onTomatoCollision: (p1, p2) => this.handleTomatoCollision(p1, p2),
            onCelebrationMatch: (p1, p2) => this.triggerCelebration(p1, p2)
        };

        // Optimization: Persistent effectContext to avoid new object allocation every frame
        this._effectContext = {
            fruits: [],
            fruitMap: this._fruitsById,
            activeTomatoes: [],
            currentFruit: null,
            feverActive: false,
            width: this.width,
            height: this.height
        };

        this.gameVisibility = new GameVisibility(this);
        this.gameResize = new GameResize(this);
        this.gameInput = new GameInput(this);
        this.gameLogic = new GameLogic(this);
    }

    setPaused(paused: boolean) {
        this.paused = paused;
        if (paused) {
            this.audio.stop();
        } else {
            this.audio.resume();
        }
    }

    updateSettings(settings: GameSettings) {
        this.settings = settings;
        this.audio.setMusicEnabled(settings.musicEnabled);
        this.audio.setSfxEnabled(settings.sfxEnabled);
    }

    async initialize() {
        if (this.destroyed) return;
        this.initializing = true;
        this.app = new PIXI.Application();

        try {
            const dpr = window.devicePixelRatio || 1;

            await this.app.init({
                canvas: this.canvasElement,
                backgroundAlpha: 0,
                width: this.canvasElement.clientWidth,
                height: this.canvasElement.clientHeight,
                antialias: true,
                resolution: dpr,
                autoDensity: true,
                preference: 'webgl',
                resizeTo: this.canvasElement,
            });

            this.app.renderer.on('resize', () => this.handleResize());

        } catch (e) {
            console.error(`[GameEngine] PIXI Init Error:`, e);
            this.initializing = false;
            return;
        }

        this.initializing = false;
        if (this.destroyed) {
            if (this.app) this.app.destroy({ removeView: false });
            return;
        }
        if (!this.app.renderer) return;

        // Initial Resize
        this.handleResize();

        this.app.stage.addChild(this.container);

        // Initialize Render System
        this.renderSystem.initialize(this.app, this.container);

        // Initialize Ground Renderer (inside the game container — virtual coords)
        this.groundRenderer = new GroundRenderer(this.container);

        // Initialize Juice Renderer (inside the game container — virtual coords)
        this.juiceRenderer = new JuiceRenderer(this.container);

        // Initialize Cloud Renderer (screen-space, on the stage)
        this.cloudRenderer = new CloudRenderer(this.app.stage, this.app.renderer);

        // Initialize Wall Renderer (inside the game container — virtual coords)
        this.wallRenderer = new WallRenderer(this.container);

        // Re-run resize to update screen-space renderers now that they exist
        this.handleResize();

        // Start Game
        this.spawnNextFruit();

        // Ticker configuration
        this.app.ticker.maxFPS = 0;
        this.app.ticker.minFPS = 30;
        this.app.ticker.add(this.update.bind(this));

        // Input Handling
        this.app.stage.eventMode = 'static';
        if (this.app.screen) this.app.stage.hitArea = this.app.screen;
        this.gameInput!.registerListeners(this.app.stage);

        // Handle Visibility Changes (Context Loss Prevention)
        const handlers = this.gameVisibility!.registerListeners(this.canvasElement);
        this.visibilityHandler = handlers.visibilityHandler;
        this.contextRestoredHandler = handlers.contextRestoredHandler;
    }
    handleResize() {
        this.gameResize?.handleResize();
    }

    /**
     * Update the game area rectangle in screen coordinates.
     * Called when the DOM layout changes (responsive resize).
     */
    updateGameAreaRect(left: number, top: number, width: number, height: number): void {
        this.gameResize?.updateGameAreaRect(left, top, width, height);
    }

    reset() {
        // 1. Reset Systems
        this.effectSystem.reset();
        this.renderSystem.reset();
        this.inputSystem.reset();
        this.scoreController.reset();

        if (this.spawnTimeout) {
            clearTimeout(this.spawnTimeout);
            this.spawnTimeout = null;
        }

        // 2. Clear Game State
        this.fruits = [];
        this.activeTomatoes = [];
        this.activeBombs = [];
        this.celebrationEffect = null;
        this.currentFruit = null;

        this.stats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };
        this.didMergeThisTurn = false;

        this.dangerTimer = 0;
        this.dangerActive = false;
        this.dangerAccumulator = 0;
        this.nextId = 0;
        this.canDrop = true;
        this.consecutiveNonSpecialCount = 0;
        this.generatedFruitCount = 0;

        // 3. Update UI (Already triggered by scoreController.reset())
        this.audio.setFrenzy(false);
        this.onDanger(false, 0);
        this.onTimeUpdate(0);

        // 4. Restart
        this.setPaused(false);
        this.audio.reset(); // Restart music from intro
        this.savedFruitTier = null;
        this.canSwap = true;
        this.onSaveUpdate(null);

        this.nextFruitQueue = [this.pickRandomFruit(FruitTier.CHERRY)];
        this.spawnNextFruit();

        if (this.settings.musicEnabled || this.settings.sfxEnabled) {
            this.audio.resume();
        }
    }

    // --- Input Delegation ---

    onPointerDown(e: PIXI.FederatedPointerEvent) {
        this.gameInput?.onPointerDown(e);
    }

    onPointerMove(e: PIXI.FederatedPointerEvent) {
        this.gameInput?.onPointerMove(e);
    }

    onPointerUp(e: PIXI.FederatedPointerEvent) {
        this.gameInput?.onPointerUp(e);
    }

    spawnNextFruit() {
        this.gameInput?.spawnNextFruit();
    }

    forceCurrentFruit(tier: FruitTier) {
        this.gameInput?.forceCurrentFruit(tier);
    }

    // --- Update Loop ---

    update(ticker: PIXI.Ticker) {
        if (this.paused) return;

        // Use ticker's actual elapsed time — physics runs at display refresh rate
        // (60Hz or 120Hz depending on device). This gives responsive input feel
        // since the fruit follows the finger every frame.
        // minFPS=30 prevents deltaTime spiral during slow frames.
        const dt = ticker.deltaMS / 1000;
        const dtMs = ticker.deltaMS;

        this.perfStats.fruitCount = this.fruits.length;
        this.perfStats.particleCount = this.effectSystem.visualParticles.length;
        this.perfStats.audioQueueLength = this.audio.soundQueue.length;
        this.perfStats.substeps = SUBSTEPS;

        // Optimization: Build O(1) fruit lookup Map once per frame
        this._fruitsById.clear();
        for (const p of this.fruits) this._fruitsById.set(p.id, p);

        // 1. Update Game Logic (Timers, Stats, Fever)
        this.updateGameLogic(dtMs);

        // 2. Update Physics
        this._physicsContext.fruits = this.fruits;
        this._physicsContext.activeTomatoes = this.activeTomatoes;
        this._physicsContext.activeBombs = this.activeBombs;
        this._physicsContext.celebrationEffect = this.celebrationEffect;
        this._physicsContext.currentFruit = this.currentFruit;
        this._physicsContext.isAiming = this.inputSystem.isAiming;
        this._physicsContext.dragAnchorX = this.inputSystem.dragAnchorX;
        this._physicsContext.dragAnchorY = this.inputSystem.dragAnchorY;
        this._physicsContext.width = this.width;
        this._physicsContext.height = this.height;

        this.physicsSystem.update(dt, this._physicsContext, this._physicsCallbacks);

        // 3. Update Effects
        const isFever = this.scoreController.isFever();
        this._effectContext.fruits = this.fruits;
        this._effectContext.activeTomatoes = this.activeTomatoes;
        this._effectContext.currentFruit = this.currentFruit;
        this._effectContext.feverActive = isFever;
        this._effectContext.width = this.width;
        this._effectContext.height = this.height;
        this.effectSystem.update(dt, this._effectContext);

        // 4. Audio
        this.audio.update();

        // Flush batched score/UI updates (single React render per frame)
        this.scoreController.flushUpdates();

        // 5. Render
        this.renderSystem.drawDangerLine(this.width, this.height, this.isOverLimit);

        // Update clouds (screen-space animation)
        if (this.cloudRenderer && this.app) {
            this.cloudRenderer.update(this._screenWidth, this._containerTop, this.scaleFactor);
        }

        // Sync Render State
        const renderCtx = {
            fruits: this.fruits,
            currentFruit: this.currentFruit,
            feverActive: isFever,
            scaleFactor: this.scaleFactor,
            effectParticles: this.effectSystem.visualParticles
        };
        this.renderSystem.renderSync(renderCtx);

        // Render juice overlay
        if (this.juiceRenderer) {
            this.juiceRenderer.render(dt);
        }

        // --- Performance Tracking ---
        const _perfNow = performance.now();
        if (this._perfLastTime > 0) {
            const elapsed = _perfNow - this._perfLastTime;
            this._perfFpsAccumulator += elapsed;
            this._perfFrameCount++;
            this._perfMemoryAccumulator += elapsed;

            if (this._perfFpsAccumulator >= 500) {
                this.perfStats.fps = Math.round((this._perfFrameCount * 1000) / this._perfFpsAccumulator);
                this.perfStats.frameTimeMs = Math.round(this._perfFpsAccumulator / this._perfFrameCount * 10) / 10;
                this._perfFpsAccumulator = 0;
                this._perfFrameCount = 0;
            }

            // Sample memory every 2s — performance.memory only updates periodically anyway
            if (this._perfMemoryAccumulator >= 2000) {
                this._perfMemoryAccumulator = 0;
                const mem = (performance as any).memory;
                if (mem) {
                    this.perfStats.heapUsedMB = Math.round(mem.usedJSHeapSize / 1048576 * 10) / 10;
                    this.perfStats.heapTotalMB = Math.round(mem.totalJSHeapSize / 1048576 * 10) / 10;
                }
            }
        }
        this._perfLastTime = _perfNow;
    }

    // --- Game Logic Methods ---

    updateGameLogic(dtMs: number) {
        this.stats.timePlayed += dtMs;

        // Optimization: Throttle time callback to 4x/s — firing at 60x/s causes 60 React renders/s just for the timer
        this._timeUpdateAccumulator += dtMs;
        if (this._timeUpdateAccumulator >= 250) {
            this._timeUpdateAccumulator = 0;
            this.onTimeUpdate(this.stats.timePlayed);
        }

        // Update ScoreController (Fever Timer)
        this.scoreController.update(dtMs);

        // Update Timers for Active Effects
        // Tomato Timer
        for (let i = this.activeTomatoes.length - 1; i >= 0; i--) {
            const t = this.activeTomatoes[i];

            // Loop Swoosh Sound
            const prevTimer = t.timer + (dtMs / 1000);
            if (Math.floor(prevTimer / 0.3) > Math.floor(t.timer / 0.3)) {
                const intensity = 1.0 - (t.timer / t.maxTime);
                this.audio.playTomatoSuck(intensity);
            }

            t.timer -= dtMs / 1000;
            const tomatoParticle = this._fruitsById.get(t.tomatoId);
            if (tomatoParticle) {
                const progress = 1 - (t.timer / t.maxTime);
                tomatoParticle.scaleX = 1 + (progress * 0.3);
                tomatoParticle.scaleY = 1 + (progress * 0.3);
                tomatoParticle.alpha = 1 - (progress * 0.4);
                tomatoParticle.rotation += 0.05;
            }

            if (t.timer <= 0) {
                this.concludeTomatoEffect(t);
                this.activeTomatoes.splice(i, 1);
            }
        }

        // Bomb Timer
        for (let i = this.activeBombs.length - 1; i >= 0; i--) {
            const b = this.activeBombs[i];
            const prevSec = Math.ceil(b.timer);
            b.timer -= dtMs / 1000;
            const currentSec = Math.ceil(b.timer);

            if (currentSec < prevSec) {
                this.audio.playBombTick(1.0 - (b.timer / b.maxTime));
            } else if (b.timer < 1.5 && b.timer > 0) {
                if ((b.timer + (dtMs / 1000)) >= (currentSec - 0.5) && b.timer < (currentSec - 0.5)) {
                    this.audio.playBombTick(1.0);
                }
            }

            const bombParticle = this._fruitsById.get(b.bombId);
            if (bombParticle) {
                const flashTiming = b.timer % 1.0;
                if (flashTiming > 0.7) {
                    bombParticle.scaleX = 1.3;
                    bombParticle.scaleY = 1.3;
                    bombParticle.alpha = 1.0;
                } else {
                    bombParticle.scaleX = 1.0;
                    bombParticle.scaleY = 1.0;
                    bombParticle.alpha = 0.9;
                }
            }
            if (b.timer <= 0) {
                this.concludeBombEffect(b);
                this.activeBombs.splice(i, 1);
            }
        }

        // Celebration Timer
        if (this.celebrationEffect) {
            this.updateCelebrationLogic(dtMs);
        }

        // Cooldowns
        for (const p of this.fruits) {
            if (p.cooldownTimer > 0) p.cooldownTimer -= dtMs / 1000;
        }

        // Fever Tick Audio
        // Handled via onFeverTick callback

        // Danger Logic
        const dangerY = this.height * DANGER_Y_PERCENT;
        let inDangerZone = false;
        for (const f of this.fruits) {
            if (!f.isStatic && !f.isCaught && f.y - f.radius < dangerY) {
                inDangerZone = true;
                break;
            }
        }
        this.isOverLimit = inDangerZone;
        if (inDangerZone) {
            this.dangerAccumulator += dtMs;
            if (this.dangerAccumulator > this.DANGER_TRIGGER_DELAY) {
                if (!this.dangerActive) {
                    this.dangerActive = true;
                    this.dangerTimer = DANGER_TIME_MS;
                }
            }
        } else {
            this.dangerAccumulator = 0;
            this.dangerActive = false;
            this.onDanger(false, 0);
        }
        if (this.dangerActive) {
            this.dangerTimer -= dtMs;
            this.onDanger(true, this.dangerTimer);
            if (this.dangerTimer <= 0) {
                this.gameOver();
            }
        }
    }

    // --- Action Methods ---

    merge(p1: Particle, p2: Particle) {
        this.gameLogic?.merge(p1, p2);
    }

    handleTomatoCollision(p1: Particle, p2: Particle) {
        this.gameLogic?.handleTomatoCollision(p1, p2);
    }

    handleBombExplosion(bomb: Particle) {
        this.gameLogic?.handleBombExplosion(bomb);
    }

    private prepareEffectConclusion(
        effectParticle: Particle | undefined,
        fallbackX: number,
        fallbackY: number,
        onRemove?: () => void
    ): { releaseX: number; releaseY: number } {
        return this.gameLogic!.prepareEffectConclusion(effectParticle, fallbackX, fallbackY, onRemove);
    }

    concludeTomatoEffect(effect: TomatoEffect) {
        this.gameLogic?.concludeTomatoEffect(effect);
    }

    concludeBombEffect(effect: BombEffect) {
        this.gameLogic?.concludeBombEffect(effect);
    }

    triggerCelebration(p1: Particle, p2: Particle) {
        this.gameLogic?.triggerCelebration(p1, p2);
    }

    updateCelebrationLogic(dtMs: number) {
        this.gameLogic?.updateCelebrationLogic(dtMs);
    }

    applyShockwave(x: number, y: number, radius: number, force: number) {
        this.gameLogic?.applyShockwave(x, y, radius, force);
    }

    pickRandomFruit(maxTier: FruitTier): FruitTier {
        const limit = Math.min(FruitTier.COCONUT, Math.max(FruitTier.CHERRY, maxTier - 2));
        const possibleTiers: FruitTier[] = [];
        for (let i = 0; i <= limit; i++) {
            possibleTiers.push(i);
        }

        const pickNormal = () => possibleTiers[Math.floor(Math.random() * possibleTiers.length)];

        const pickSpecial = () => {
            const r = Math.random();
            if (r < 0.333) return FruitTier.RAINBOW;
            if (r < 0.666) return FruitTier.TOMATO;
            return FruitTier.BOMB;
        };

        if (this.generatedFruitCount < 9) {
            this.generatedFruitCount++;
            this.consecutiveNonSpecialCount++;
            return pickNormal();
        }

        if (this.consecutiveNonSpecialCount >= 9) {
            this.generatedFruitCount++;
            this.consecutiveNonSpecialCount = 0;
            return pickSpecial();
        }

        this.generatedFruitCount++;
        const rand = Math.random();

        if (rand < 0.045) {
            this.consecutiveNonSpecialCount = 0;
            if (rand < 0.015) {
                return FruitTier.RAINBOW;
            } else if (rand < 0.030) {
                return FruitTier.TOMATO;
            } else {
                return FruitTier.BOMB;
            }
        } else {
            this.consecutiveNonSpecialCount++;
            return pickNormal();
        }
    }

    swapSavedFruit() {
        if (!this.canSwap || !this.currentFruit) return;

        const currentTier = this.currentFruit.tier;

        if (this.savedFruitTier === null) {
            this.savedFruitTier = currentTier;
            this.renderSystem.removeSprite(this.currentFruit);
            this.currentFruit = null;
            this.spawnNextFruit();
        } else {
            const oldSaved = this.savedFruitTier;
            this.savedFruitTier = currentTier;
            this.forceCurrentFruit(oldSaved);
        }

        this.canSwap = false;
        this.onSaveUpdate(this.savedFruitTier);
        this.audio.playMergeSound(FruitTier.CHERRY);
    }

    removeParticle(p: Particle) {
        const idx = this.fruits.indexOf(p);
        if (idx >= 0) this.fruits.splice(idx, 1);

        // Mark as caught/dead for physics engine to ignore in same frame
        p.isCaught = true;
        p.ignoreCollisions = true;

        this.renderSystem.removeSprite(p);
    }

    addScore(amt: number) {
        // Direct score addition via Celebration logic (or cheats)
        this.scoreController.handleCelebration({ points: amt });
    }

    gameOver() {
        this.canDrop = false;
        this.app?.ticker.stop();
        this.audio.stop();
        this.onGameOver(this.stats);
    }

    cleanup() {
        this.destroyed = true;
        if (this.gameVisibility && this.visibilityHandler && this.contextRestoredHandler) {
            this.gameVisibility.unregisterListeners(this.canvasElement, this.visibilityHandler, this.contextRestoredHandler);
        }
        this.audio.stop();
        if (!this.initializing && this.app) {
            try {
                this.app.destroy({ removeView: false });
            } catch (e) {
                console.warn(`[GameEngine] Error destroying Pixi app`, e);
            }
        }
    }
}
