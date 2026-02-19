import * as PIXI from 'pixi.js';
import { FruitDef, FruitTier, GameSettings, GameStats, PointEvent, PopupData, PopUpType } from '../types';
import { FRUIT_DEFS, GAME_CONFIG, DANGER_TIME_MS, DANGER_Y_PERCENT, SPAWN_Y_PERCENT, SCORE_BASE_MERGE, FEVER_DURATION_MS, JUICE_MAX } from '../constants';
import { MusicEngine } from './MusicEngine';
import { Particle, TomatoEffect, BombEffect, CelebrationState } from '../types/GameObjects';

// Systems
import { PhysicsSystem, PhysicsCallbacks, PhysicsContext } from './systems/PhysicsSystem';
import { InputSystem } from './systems/InputSystem';
import { EffectSystem } from './systems/EffectSystem';
import { RenderSystem } from './systems/RenderSystem';
import { ScoreController } from './systems/ScoreController';

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
    };
    private _perfLastTime: number = 0;
    private _perfFrameCount: number = 0;
    private _perfFpsAccumulator: number = 0;

    // Optimization: Reused Objects
    private _physicsContext: PhysicsContext;
    private _physicsCallbacks: PhysicsCallbacks;
    private _effectContext: { fruits: Particle[]; activeTomatoes: TomatoEffect[]; currentFruit: Particle | null; feverActive: boolean; width: number; height: number };
    private _timeUpdateAccumulator: number = 0; // Throttle onTimeUpdate to 4x/s instead of 60x/s
    // Optimization: O(1) fruit lookups in updateGameLogic (replaces .find() per active effect per frame)
    private _fruitsById: Map<number, Particle> = new Map();

    private spawnTimeout: any = null;
    private wasPausedBySystem: boolean = false;
    private visibilityHandler: () => void;
    private contextRestoredHandler: () => void;

    constructor(
        canvas: HTMLCanvasElement,
        settings: GameSettings,
        callbacks: any
    ) {
        this.canvasElement = canvas;
        this.settings = settings;
        Object.assign(this, callbacks);

        this.contextRestoredHandler = () => {
            console.log('[GameEngine] WebGL Context Restored event detected.');
            // Small delay to allow PixiJS to re-initialize its internal state
            setTimeout(() => this.attemptRestoration(0), 100);
        };

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
        };

        let lastFeverTime = 0;
        this.scoreController.onFeverStart = (mult) => {
            this.audio.setFrenzy(true);
            this.audio.playFrenzyStart();
            this.stats.feverCount++;
            lastFeverTime = FEVER_DURATION_MS; // Reset tracker
            this.onFeverStart(mult);
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
            activeTomatoes: [],
            currentFruit: null,
            feverActive: false,
            width: this.width,
            height: this.height
        };

        this.visibilityHandler = this.handleVisibilityChange.bind(this);
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
            // Optimization: Cap pixel ratio at 2 on mobile (iPhone 15 Pro = 3× = 3× GPU work)
            // Capping at 2 cuts GPU pixel fill by ~55% with near-invisible quality difference
            const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
            const cappedDpr = isMobile
                ? Math.min(window.devicePixelRatio || 1, 2)
                : (window.devicePixelRatio || 1);

            await this.app.init({
                canvas: this.canvasElement,
                backgroundAlpha: 0,
                width: this.canvasElement.clientWidth,
                height: this.canvasElement.clientHeight,
                antialias: !isMobile, // Disable antialias on mobile — saves GPU passes
                resolution: cappedDpr,
                autoDensity: true,
                preference: 'webgl',
                resizeTo: this.canvasElement
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

        // Start Game
        this.spawnNextFruit();
        this.app.ticker.maxFPS = 60; // Lock to 60 FPS for consistent physics speed
        this.app.ticker.add(this.update.bind(this));

        // Input Handling
        this.app.stage.eventMode = 'static';
        if (this.app.screen) this.app.stage.hitArea = this.app.screen;

        this.app.stage.on('pointerdown', this.onPointerDown.bind(this));
        this.app.stage.on('pointermove', this.onPointerMove.bind(this));
        this.app.stage.on('pointerup', this.onPointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.onPointerUp.bind(this));

        // Handle Visibility Changes (Context Loss Prevention)
        document.addEventListener('visibilitychange', this.visibilityHandler);
        this.canvasElement.addEventListener('webglcontextrestored', this.contextRestoredHandler);
    }

    handleVisibilityChange() {
        if (document.hidden) {
            console.log('[GameEngine] App backgrounded - pausing');
            if (!this.paused) {
                this.setPaused(true);
                this.wasPausedBySystem = true;
            } else {
                this.wasPausedBySystem = false;
            }
            if (this.app) {
                this.app.ticker.stop();
            }
        } else {
            console.log('[GameEngine] App foregrounded - restoring');
            this.attemptRestoration(0);
        }
    }

    attemptRestoration(attempt: number) {
        if (attempt > 4) {
            console.error('[GameEngine] Failed to restore graphics after multiple attempts.');
            // Resume anyway to allow logic to run
            this.resumeAfterRestore();
            return;
        }

        // Exponential backoff: 200, 400, 800, 1600...
        const delay = 200 * Math.pow(2, attempt);
        console.log(`[GameEngine] Restoration attempt ${attempt + 1} scheduled in ${delay}ms`);

        setTimeout(() => {
            const success = this.restoreGraphics();
            if (success) {
                console.log('[GameEngine] Restoration successful.');
                this.resumeAfterRestore();
            } else {
                console.warn(`[GameEngine] Restoration attempt ${attempt + 1} failed (Context lost or error). Retrying...`);
                this.attemptRestoration(attempt + 1);
            }
        }, delay);
    }

    resumeAfterRestore() {
        if (this.wasPausedBySystem) {
            this.setPaused(false);
            this.wasPausedBySystem = false;
        }
        if (this.app) {
            this.app.ticker.start();
        }
    }

    restoreGraphics(): boolean {
        if (!this.app || !this.app.renderer) return false;

        console.log('[GameEngine] Restoring graphics context...');
        const success = this.renderSystem.refreshGraphics();
        if (!success) return false;

        // Restore current fruit sprite
        if (this.currentFruit) {
            this.renderSystem.createSprite(this.currentFruit);
        }

        // Restore all active fruits
        for (const p of this.fruits) {
            this.renderSystem.createSprite(p);
        }

        // Redraw static elements
        this.renderSystem.drawDangerLine(this.width, this.height, this.isOverLimit);

        return true;
    }

    handleResize() {
        if (!this.app || !this.app.screen) return;

        const actualW = this.app.screen.width;
        const actualH = this.app.screen.height;
        const viewW = actualW / 1.4;
        const viewH = actualH / 1.4;

        this.scaleFactor = Math.min(viewW / V_WIDTH, viewH / V_HEIGHT);
        this.container.scale.set(this.scaleFactor);

        // Center the container in the canvas
        const logicalW = V_WIDTH * this.scaleFactor;
        const logicalH = V_HEIGHT * this.scaleFactor;

        const xOffset = (actualW - logicalW) / 2;
        const yOffset = (actualH - logicalH) / 2;

        this.container.position.set(xOffset, yOffset);
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

    getInputContext() {
        return {
            containerX: this.container.position.x,
            containerY: this.container.position.y,
            scaleFactor: this.scaleFactor,
            width: this.width,
            height: this.height,
            paused: this.paused,
            currentFruit: this.currentFruit,
            canDrop: this.canDrop
        };
    }

    onPointerDown(e: PIXI.FederatedPointerEvent) {
        if (this.paused) return;
        this.audio.resume();
        this.inputSystem.onPointerDown(e, this.getInputContext());
    }

    onPointerMove(e: PIXI.FederatedPointerEvent) {
        this.inputSystem.onPointerMove(e, this.getInputContext());
    }

    onPointerUp(e: PIXI.FederatedPointerEvent) {
        const result = this.inputSystem.onPointerUp(e, this.getInputContext());
        if (result && this.currentFruit) {

            // Notify ScoreController about turn end
            this.scoreController.handleTurnEnd({ didMerge: this.didMergeThisTurn });
            this.didMergeThisTurn = false;

            this.currentFruit.isStatic = false;
            this.currentFruit.vx = result.vx;
            this.currentFruit.vy = result.vy;
            this.currentFruit.angularVelocity = result.vx * 0.05;
            this.fruits.push(this.currentFruit);
            this.currentFruit = null;
            this.canDrop = false;

            // Clear any existing timeout just in case
            if (this.spawnTimeout) clearTimeout(this.spawnTimeout);

            this.spawnTimeout = setTimeout(() => {
                this.canDrop = true;
                this.spawnTimeout = null;
                this.spawnNextFruit();
            }, GAME_CONFIG.spawnDelay);
        }
    }

    // --- Update Loop ---

    update(ticker: PIXI.Ticker) {
        if (this.paused) return;
        const dt = 1 / 60;
        const dtMs = dt * 1000;

        // --- Performance Tracking ---
        const _perfNow = performance.now();
        if (this._perfLastTime > 0) {
            const elapsed = _perfNow - this._perfLastTime;
            this._perfFpsAccumulator += elapsed;
            this._perfFrameCount++;
            if (this._perfFpsAccumulator >= 500) {
                this.perfStats.fps = Math.round((this._perfFrameCount * 1000) / this._perfFpsAccumulator);
                this.perfStats.frameTimeMs = Math.round(this._perfFpsAccumulator / this._perfFrameCount * 10) / 10;
                this._perfFpsAccumulator = 0;
                this._perfFrameCount = 0;
            }
        }
        this._perfLastTime = _perfNow;
        this.perfStats.fruitCount = this.fruits.length;
        this.perfStats.particleCount = this.effectSystem.visualParticles.length;
        this.perfStats.audioQueueLength = this.audio.soundQueue.length;

        // Optimization: Build O(1) fruit lookup Map once per frame
        this._fruitsById.clear();
        for (const p of this.fruits) this._fruitsById.set(p.id, p);

        // 1. Update Game Logic (Timers, Stats, Fever)
        this.updateGameLogic(dtMs);

        // 2. Update Physics
        // Optimization: Reuse object to reduce GC
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
        // Optimization: Reuse persistent context object — avoids GC allocation every frame
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

        // 5. Render
        this.renderSystem.drawDangerLine(this.width, this.height, this.isOverLimit);

        // Sync Render State
        const renderCtx = {
            fruits: this.fruits,
            currentFruit: this.currentFruit,
            feverActive: isFever,
            scaleFactor: this.scaleFactor
        };
        this.renderSystem.renderSync(renderCtx);
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

    spawnNextFruit() {
        if (!this.canDrop) return;

        let maxTier = FruitTier.CHERRY;
        for (const p of this.fruits) {
            if (!p.isStatic && p.tier !== FruitTier.TOMATO && p.tier !== FruitTier.BOMB && p.tier !== FruitTier.RAINBOW) {
                if (p.tier > maxTier) maxTier = p.tier;
            }
        }
        this.onMaxFruit(maxTier);
        if (maxTier > this.stats.maxTier) {
            this.stats.maxTier = maxTier;
        }

        let tier = this.nextFruitQueue.shift();
        if (tier === undefined) tier = this.pickRandomFruit(maxTier);

        const nextLookahead = this.pickRandomFruit(maxTier);
        this.nextFruitQueue.push(nextLookahead);

        this.onNextFruit(nextLookahead);

        this.nextFruitTier = tier;
        this.canSwap = true;
        this.currentFruit = new Particle(
            this.width / 2,
            this.height * SPAWN_Y_PERCENT,
            FRUIT_DEFS[tier],
            this.nextId++
        );
        this.currentFruit.isStatic = true;

        // Input System Update for Anchor
        this.inputSystem.dragAnchorX = this.width / 2;
        this.inputSystem.dragAnchorY = this.height * SPAWN_Y_PERCENT;

        this.renderSystem.createSprite(this.currentFruit);
    }

    forceCurrentFruit(tier: FruitTier) {
        if (!this.currentFruit) return;

        this.renderSystem.removeSprite(this.currentFruit);

        this.nextFruitTier = tier;
        this.currentFruit = new Particle(
            this.currentFruit.x,
            this.currentFruit.y,
            FRUIT_DEFS[tier],
            this.nextId++
        );
        this.currentFruit.isStatic = true;
        this.renderSystem.createSprite(this.currentFruit);
    }

    merge(p1: Particle, p2: Particle) {
        let nextTier: number;

        if (p1.tier === FruitTier.RAINBOW && p2.tier === FruitTier.RAINBOW) {
            nextTier = FruitTier.WATERMELON;
        } else if (p1.tier === FruitTier.RAINBOW) {
            nextTier = p2.tier + 1;
        } else if (p2.tier === FruitTier.RAINBOW) {
            nextTier = p1.tier + 1;
        } else {
            nextTier = p1.tier + 1;
        }

        if (nextTier > FruitTier.WATERMELON) nextTier = FruitTier.WATERMELON;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // 1. Calculate Score via ScoreController
        const mergePoints = this.scoreController.handleMerge({ tier: nextTier });
        this.didMergeThisTurn = true;

        // 2. Sync Stats (Handled by Callbacks)
        this.stats.bestCombo = Math.max(this.stats.bestCombo, this.scoreController.getChainCount());

        // 3. Emit Events
        // The visual popup now uses the exact points calculated by the controller.
        this.onPointEvent({
            x: midX,
            y: midY,
            points: mergePoints,
            tier: nextTier
        });

        this.removeParticle(p1);
        this.removeParticle(p2);

        const nextDef = FRUIT_DEFS[nextTier as FruitTier];
        const newP = new Particle(midX, midY, nextDef, this.nextId++);
        this.fruits.push(newP);
        this.renderSystem.createSprite(newP);

        this.effectSystem.createMergeEffect(midX, midY, nextDef.color);
        this.audio.playMergeSound(nextTier);
        this.applyShockwave(midX, midY, 150, 5);
        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(20);
    }

    handleTomatoCollision(p1: Particle, p2: Particle) {
        const tomato = p1.tier === FruitTier.TOMATO ? p1 : p2;
        const victim = p1.tier === FruitTier.TOMATO ? p2 : p1;
        if (victim.tier === FruitTier.TOMATO) return;
        if (tomato.cooldownTimer > 0) return;
        const existing = this.activeTomatoes.find(t => t.tomatoId === tomato.id);
        if (existing) return;
        const effect = new TomatoEffect(tomato.id, tomato.x, tomato.y, victim.tier);
        this.activeTomatoes.push(effect);
        tomato.isStatic = true;
        tomato.vx = 0;
        tomato.vy = 0;
        tomato.y = Math.max(tomato.radius, tomato.y - 50);
    }

    handleBombExplosion(bomb: Particle) {
        const existing = this.activeBombs.find(b => b.bombId === bomb.id);
        if (existing) return;

        const effect = new BombEffect(bomb.id, bomb.x, bomb.y);
        this.activeBombs.push(effect);

        this.audio.playMergeSound(FruitTier.CHERRY);
        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(30);
    }

    private prepareEffectConclusion(
        effectParticle: Particle | undefined,
        fallbackX: number,
        fallbackY: number,
        onRemove?: () => void
    ): { releaseX: number; releaseY: number } {
        let releaseX = fallbackX;
        let releaseY = fallbackY;

        if (effectParticle) {
            releaseX = effectParticle.x;
            releaseY = effectParticle.y;
            this.removeParticle(effectParticle);
            if (onRemove) onRemove();
        }

        return { releaseX, releaseY };
    }

    concludeTomatoEffect(effect: TomatoEffect) {
        const tomato = this.fruits.find(p => p.id === effect.tomatoId);
        const { releaseX, releaseY } = this.prepareEffectConclusion(
            tomato,
            effect.x,
            effect.y,
            () => this.stats.tomatoUses++
        );

        for (const id of effect.capturedIds) {
            const p = this.fruits.find(f => f.id === id);
            if (p) {
                p.isCaught = false;
                p.ignoreCollisions = false;
                p.scaleX = 1;
                p.scaleY = 1;
                p.alpha = 1;
                p.cooldownTimer = 0.8;
                p.x = releaseX + (Math.random() - 0.5) * 5;
                p.y = releaseY + (Math.random() - 0.5) * 5;
                const angle = Math.random() * Math.PI * 2;
                const force = 5;
                p.vx = Math.cos(angle) * force;
                p.vy = Math.sin(angle) * force - 3;
            }
        }

        this.effectSystem.createMergeEffect(releaseX, releaseY, "#FF4444");
        this.applyShockwave(releaseX, releaseY, 600, 40);
        this.audio.playMergeSound(FruitTier.WATERMELON);

        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 50]);
    }

    concludeBombEffect(effect: BombEffect) {
        const bomb = this.fruits.find(p => p.id === effect.bombId);
        const { releaseX, releaseY } = this.prepareEffectConclusion(
            bomb,
            effect.x,
            effect.y
        );

        this.effectSystem.createGhostEffect(releaseX, releaseY, 28);

        for (const id of effect.capturedIds) {
            const p = this.fruits.find(f => f.id === id);
            if (!p) continue;

            const tier = p.tier;
            let targetTier: number;
            let spawnCount: number;

            if (tier >= 3) {
                targetTier = tier - 3;
                spawnCount = 6;
            } else if (tier === 2) {
                targetTier = 0;
                spawnCount = 4;
            } else if (tier === 1) {
                targetTier = 0;
                spawnCount = 2;
            } else {
                this.removeParticle(p);
                continue;
            }

            targetTier = Math.max(0, Math.min(targetTier, tier));
            const fruitX = p.x;
            const fruitY = p.y;
            const fruitColor = FRUIT_DEFS[p.tier]?.color || '#FF6347';

            this.removeParticle(p);

            const targetDef = FRUIT_DEFS[targetTier as FruitTier];
            if (targetDef) {
                for (let i = 0; i < spawnCount; i++) {
                    const newP = new Particle(fruitX, fruitY, targetDef, this.nextId++);

                    const angle = (i / spawnCount) * Math.PI * 2 + Math.random() * 0.3;
                    const force = 5 + Math.random() * 3;
                    newP.vx = Math.cos(angle) * force;
                    newP.vy = Math.sin(angle) * force - 3;
                    newP.cooldownTimer = 1.5;

                    this.fruits.push(newP);
                    this.renderSystem.createSprite(newP);
                }
            }
            this.effectSystem.createMergeEffect(fruitX, fruitY, fruitColor);
        }

        this.effectSystem.createMergeEffect(releaseX, releaseY, "#212121");
        this.applyShockwave(releaseX, releaseY, 600, 40);
        this.audio.playMergeSound(FruitTier.WATERMELON);
        this.audio.playBombShrapnel();

        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }

    triggerCelebration(p1: Particle, p2: Particle) {
        if (this.celebrationEffect) return;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        this.removeParticle(p1);
        this.removeParticle(p2);

        this.effectSystem.createMergeEffect(midX, midY, "#4CAF50");
        this.applyShockwave(midX, midY, 600, 50);
        this.audio.playMergeSound(FruitTier.WATERMELON);

        const capturedIds: number[] = [];
        for (const p of this.fruits) {
            if (p.isStatic) continue;

            p.isCaught = true;
            p.ignoreCollisions = true;
            capturedIds.push(p.id);
        }

        this.celebrationEffect = new CelebrationState(midX, midY, capturedIds);
        this.celebrationEffect.phase = 'suck';
        this.celebrationEffect.timer = 0;

        this.onCelebration();

        if (this.stats.maxTier < 10) {
            this.stats.maxTier = 10 as FruitTier;
            this.onMaxFruit(this.stats.maxTier);
        }

        // Initialize score sequence for Celebration
        // We defer score addition to the POP phase
        // But the base "Celebration Bonus" (5000) happens now?
        // Old code: "Calculate Base Score for Celebration (5000)... addDirectPoints".
        this.scoreController.handleCelebration({ points: 5000 });

        this.onPopupUpdate({
            type: this.scoreController.isFever() ? PopUpType.FRENZY : PopUpType.WATERMELON_CRUSH,
            runningTotal: 0, // ScoreController handles the real running total update via callback
            multiplier: 1
        });
    }

    updateCelebrationLogic(dtMs: number) {
        if (!this.celebrationEffect) return;

        const state = this.celebrationEffect;
        state.timer += dtMs;

        if (state.phase === 'suck') {
            let allArrived = true;
            const targetY = this.height * SPAWN_Y_PERCENT;

            for (const id of state.capturedIds) {
                const p = this._fruitsById.get(id);
                if (!p) continue;
                if (Math.abs(p.y - targetY) > 50) {
                    allArrived = false;
                }
            }

            if (allArrived || state.timer > 3000) {
                state.phase = 'pop'; // Go to POP phase instead of HOLD/EXPLODE
                state.timer = 0;
                state.popTimer = 0;
                state.popIndex = 0;
            }
        } else if (state.phase === 'pop') {
            const POP_INTERVAL = 100; // ms between pops
            state.popTimer += dtMs;

            if (state.popTimer >= POP_INTERVAL) {
                state.popTimer -= POP_INTERVAL;

                if (state.popIndex < state.capturedIds.length) {
                    const id = state.capturedIds[state.popIndex];
                    state.popIndex++;

                    const p = this._fruitsById.get(id);
                    if (p) {
                        const tier = p.tier;

                        // FIX: Cap the tier for score calculation to avoid overflow with special fruits (Bomb=98, etc)
                        // Special fruits have high tier numbers (97+) which cause Math.pow(2, tier) to explode.
                        // We treat them as Watermelon-tier (9) for scoring purposes to provide a reward without breaking the game.
                        const safeTier = (tier > FruitTier.WATERMELON) ? FruitTier.WATERMELON : tier;

                        // Calculate Points (Base merge points for that tier)
                        // Double points for clearing!
                        let points = (SCORE_BASE_MERGE * Math.pow(2, safeTier) * 2);

                        this.scoreController.handleCelebration({ points: points });

                        // Visual & Audio
                        this.effectSystem.createMergeEffect(p.x, p.y, FRUIT_DEFS[tier].color);
                        this.audio.playMergeSound(tier);
                        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(10);

                        this.removeParticle(p);
                    }

                    // If we just popped the last one, end logic
                    if (state.popIndex >= state.capturedIds.length) {
                        this.celebrationEffect = null;
                        this.audio.playBombShrapnel(); // Final sound
                    }
                } else {
                    this.celebrationEffect = null;
                }
            }
        }
    }

    applyShockwave(x: number, y: number, radius: number, force: number) {
        const radiusSq = radius * radius;
        for (const p of this.fruits) {
            const dx = p.x - x;
            const dy = p.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq < radiusSq && distSq > 0) {
                const d = Math.sqrt(distSq);
                const factor = 1 - d / radius;
                p.vx += (dx / d) * force * factor;
                p.vy += (dy / d) * force * factor;
            }
        }
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
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.canvasElement.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
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
