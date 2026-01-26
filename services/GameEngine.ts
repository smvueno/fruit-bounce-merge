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
    onFeverEnd: () => void = () => { };
    onDanger: (active: boolean, remainingMs: number) => void = () => { };
    onJuiceUpdate: (current: number, max: number) => void = () => { };
    onNextFruit: (tier: FruitTier) => void = () => { };
    onMaxFruit: (tier: FruitTier) => void = () => { };
    onTimeUpdate: (ms: number) => void = () => { };
    onSaveUpdate: (tier: FruitTier | null) => void = () => { };
    onCelebration: () => void = () => { };
    onPointEvent: (event: PointEvent) => void = () => { };
    onPopupUpdate: (data: PopupData) => void = () => { };

    score: number = 0;
    stats: GameStats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };

    comboChain: number = 0;
    streakScore: number = 0;
    celebrationScore: number = 0; // Separate tracker for WC event
    didMergeThisTurn: boolean = false;

    // Batching State
    scoreBatch: number = 0;
    scoreBatchTimer: number = 0;

    feverActive: boolean = false;
    feverTimer: number = 0;
    juice: number = 0;

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

    // Frenzy-Chain Suspension Logic
    preFrenzyChain: number = 0;
    preFrenzyStreak: number = 0;
    currentFrenzyMult: number = 1;

    // Optimization: Reused Objects
    private _physicsContext: PhysicsContext;
    private _physicsCallbacks: PhysicsCallbacks;

    private spawnTimeout: any = null;

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
            await this.app.init({
                canvas: this.canvasElement,
                backgroundAlpha: 0,
                width: this.canvasElement.clientWidth,
                height: this.canvasElement.clientHeight,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
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
        const containerY = this.container.position.y || 0;

        // Ground now rendered by GroundCanvas component (see GameCanvas.tsx)
        // this.renderSystem.drawFloor(this.width, this.height, this.scaleFactor, actualH, containerY, actualW);

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
    }

    handleResize() {
        if (!this.app || !this.app.screen) return;

        const actualW = this.app.screen.width;
        const actualH = this.app.screen.height;

        // V_WIDTH/V_HEIGHT is the logical game size (600x750)
        // We want to scale based on the "View Size" (the 4:5 area), not the full canvas size
        // Helper: We need to know what the "visible" width/height is.
        // For now, we assume the canvas is 140% of the view.
        // So viewWidth = actualW / 1.4
        //    viewHeight = actualH / 1.4

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
        this.inputSystem.reset(); // Clear pointer history

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

        this.score = 0;
        this.stats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };
        this.comboChain = 0;
        this.streakScore = 0;
        this.scoreBatch = 0;
        this.scoreBatchTimer = 0;

        this.didMergeThisTurn = false;

        this.feverActive = false;
        this.feverTimer = 0;
        this.currentFrenzyMult = 1;

        this.juice = 0;
        this.dangerTimer = 0;
        this.dangerActive = false;
        this.dangerAccumulator = 0;
        this.nextId = 0;
        this.canDrop = true;
        this.consecutiveNonSpecialCount = 0;
        this.generatedFruitCount = 0;

        this.preFrenzyChain = 0;
        this.preFrenzyStreak = 0;

        // 3. Update UI
        this.onScore(0, 0);
        this.onCombo(0);
        this.onFeverEnd();
        this.audio.setFrenzy(false);
        this.onJuiceUpdate(0, JUICE_MAX);
        this.onDanger(false, 0);
        this.onTimeUpdate(0);

        // 4. Restart
        this.setPaused(false);
        this.audio.reset(); // Restart music from intro
        this.savedFruitTier = null;
        this.canSwap = true;
        this.onSaveUpdate(null);

        // Redraw floor to ensure clean state
        // Ground now rendered by GroundCanvas component (see GameCanvas.tsx)
        // if (this.app) {
        //     const actualH = this.app.screen.height;
        //     const actualW = this.app.screen.width;
        //     const containerY = this.container.position.y || 0;
        //     this.renderSystem.drawFloor(this.width, this.height, this.scaleFactor, actualH, containerY, actualW);
        // }

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
            // Logic moved from old onPointerUp

            // Chain Reset Logic
            if (!this.didMergeThisTurn) {
                this.comboChain = 0;
                this.onCombo(0);
                // Reset streak if not in fever
                if (!this.feverActive) {
                    this.streakScore = 0;
                    this.onPopupUpdate({
                        runningTotal: 0,
                        multiplier: 1,
                        type: PopUpType.CHAIN // Value doesn't matter for reset, just need clean state? specific type?
                        // Actually, just sending 0 might be enough for UI to close
                    });
                }
            }
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
        const effectContext = {
            fruits: this.fruits,
            activeTomatoes: this.activeTomatoes,
            currentFruit: this.currentFruit,
            feverActive: this.feverActive,
            width: this.width,
            height: this.height
        };
        this.effectSystem.update(dt, effectContext);

        // 4. Audio
        this.audio.update();

        // 5. Render
        this.renderSystem.drawDangerLine(this.width, this.height, this.isOverLimit);

        // Sync Render State
        const renderCtx = {
            fruits: this.fruits,
            currentFruit: this.currentFruit,
            feverActive: this.feverActive,
            scaleFactor: this.scaleFactor
        };
        this.renderSystem.renderSync(renderCtx);

        // Draw Effects - Moved to React EffectCanvas
        // this.renderSystem.renderEffects(this.effectSystem.visualParticles, this.height);
    }

    // --- Game Logic Methods ---

    updateGameLogic(dtMs: number) {
        this.stats.timePlayed += dtMs;
        this.onTimeUpdate(this.stats.timePlayed);

        // Score Batching Logic (100ms)
        this.scoreBatchTimer += dtMs;
        if (this.scoreBatchTimer >= 100) {
            this.scoreBatchTimer = 0;
            // Only emit if we have value or are in a streak
            // AND we are not in a celebration (which handles its own popups)
            if (!this.celebrationEffect && (this.streakScore > 0 || this.feverActive || this.comboChain > 0)) {

                let multiplier = 1;
                let popType = PopUpType.CHAIN;

                if (this.feverActive) {
                    multiplier = this.currentFrenzyMult;
                    popType = PopUpType.FRENZY;
                } else {
                    const comboMult = 1 + Math.min(this.comboChain, 10);
                    multiplier = comboMult;
                }

                this.onPopupUpdate({
                    runningTotal: this.streakScore,
                    multiplier: multiplier,
                    type: popType
                });

                // If we had a batch, clear it (if we were accumulating batch for something else, 
                // but here we are using streakScore for the running total)
                this.scoreBatch = 0;
            }
        }

        // Update Timers for Active Effects
        // Tomato Timer
        for (let i = this.activeTomatoes.length - 1; i >= 0; i--) {
            const t = this.activeTomatoes[i];

            // Loop Swoosh Sound
            // Trigger every 0.3 seconds roughly
            const prevTimer = t.timer + (dtMs / 1000);
            if (Math.floor(prevTimer / 0.3) > Math.floor(t.timer / 0.3)) {
                // Play Swoosh
                const intensity = 1.0 - (t.timer / t.maxTime); // 0 to 1
                this.audio.playTomatoSuck(intensity);
            }

            t.timer -= dtMs / 1000;
            // Visual Update for captured fruit (Scaling/Alpha) handled by Rendering/Physics now?
            // Actually PhysicsSystem only updates P position/velocity.
            // Scale/Alpha logic for captured fruits was in GameEngine logic loop.
            // PhysicsSystem updates positions for suck. 
            // We should keep the Scale/Alpha interpolation here or move to Physics/Effect.
            // Let's keep it here for now to ensure behavior match:
            const tomatoParticle = this.fruits.find(p => p.id === t.tomatoId);
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

            // Logic to play tick sound every second or faster as time decreases
            // Previous second integer
            const prevSec = Math.ceil(b.timer);
            b.timer -= dtMs / 1000;
            const currentSec = Math.ceil(b.timer);

            // Tick logic: If second changed, or if last 3 seconds play on half seconds
            if (currentSec < prevSec) {
                this.audio.playBombTick(1.0 - (b.timer / b.maxTime)); // Pitch up as it gets closer
            } else if (b.timer < 1.5 && b.timer > 0) {
                // play extra tick at .5
                if ((b.timer + (dtMs / 1000)) >= (currentSec - 0.5) && b.timer < (currentSec - 0.5)) {
                    this.audio.playBombTick(1.0);
                }
            }

            const bombParticle = this.fruits.find(p => p.id === b.bombId);
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

        // Fever Logic
        if (this.feverActive) {
            this.feverTimer -= dtMs;

            // Frenzy Ticking SFX
            // Calculate beat (every 0.5s approx)
            const prevTick = Math.floor((this.feverTimer + dtMs) / 500);
            const currTick = Math.floor(this.feverTimer / 500);
            if (currTick < prevTick) {
                const progress = 1.0 - (this.feverTimer / FEVER_DURATION_MS);
                this.audio.playFrenzyTick(progress);
            }

            if (this.feverTimer <= 0) {
                // FORCE FINAL UPDATE to ensure UI has the full Frenzy score for "Suck Up"
                this.onPopupUpdate({
                    runningTotal: this.streakScore,
                    multiplier: this.currentFrenzyMult,
                    type: PopUpType.FRENZY
                });

                this.feverActive = false;
                this.audio.setFrenzy(false);
                this.audio.playFrenzyEnd(); // End Sound
                this.juice = 0;
                this.onJuiceUpdate(0, JUICE_MAX);
                this.onFeverEnd();

                // Fever ended - Restore previous Chain State
                this.comboChain = this.preFrenzyChain;
                this.streakScore = this.preFrenzyStreak;

                // Resume Chain Visual if it existed
                if (this.streakScore > 0) {
                    const comboMult = 1 + Math.min(this.comboChain, 10);
                    this.onPopupUpdate({
                        runningTotal: this.streakScore,
                        multiplier: comboMult,
                        type: PopUpType.CHAIN
                    });
                }
            }
        } else {
            if (this.juice >= JUICE_MAX && !this.feverActive) {
                // Save Chain State before starting Frenzy
                this.preFrenzyChain = this.comboChain;
                this.preFrenzyStreak = this.streakScore;

                // Reset Chain for Frenzy Session (start fresh 0 multiplier)
                this.comboChain = 0;
                this.streakScore = 0;

                this.feverActive = true;
                this.audio.setFrenzy(true);
                this.audio.playFrenzyStart(); // Start Sound
                this.feverTimer = FEVER_DURATION_MS;
                this.stats.feverCount++;

                // Calculate Additive Multiplier
                // Base Frenzy: 1st time = 2x, 2nd = 3x.
                const frenzyBase = this.stats.feverCount + 1;

                // Chain Bonus from "Saved" state (Chain logic uses 1 + min(chain, 10))
                const chainMult = 1 + Math.min(this.preFrenzyChain, 10);

                // Additive Formula: Chain + FrenzyBase
                // User Request Update: Multiply them for crazier scores!
                // If Chain was 4x and Frenzy is 2x -> 4 * 2 = 8x.
                this.currentFrenzyMult = chainMult * frenzyBase;

                this.onFeverStart(this.currentFrenzyMult);

                // Immediate Visual Feedback (Instant Popup)
                this.onPopupUpdate({
                    runningTotal: 0, // Will not show score yet
                    multiplier: this.currentFrenzyMult,
                    type: PopUpType.FRENZY
                });
            }
        }

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

        const basePoints = SCORE_BASE_MERGE * Math.pow(2, nextTier);
        // Calculate midX/midY early for message
        // Calculate midX/midY early for message
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        let totalPoints = 0;

        if (this.feverActive) {
            // FRENZY MODE:
            // 1. Do NOT increment chain (Paused)
            // 2. Use Additive Multiplier calculated at start
            this.didMergeThisTurn = true; // Still mark merge to prevent chain reset logic elsewhere if needed
            totalPoints = basePoints * this.currentFrenzyMult;
        } else {
            // NORMAL MODE:
            this.comboChain++;
            this.didMergeThisTurn = true;
            this.onCombo(this.comboChain);

            const comboMult = 1 + Math.min(this.comboChain, 10);
            totalPoints = basePoints * comboMult;
        }

        // Emit immediate local event
        this.onPointEvent({
            x: midX,
            y: midY,
            points: totalPoints,
            tier: nextTier
        });

        // Accumulate Score
        this.streakScore += totalPoints;
        this.scoreBatch += totalPoints;

        this.addScore(totalPoints);
        this.stats.bestCombo = Math.max(this.stats.bestCombo, this.comboChain);
        if (!this.feverActive) {
            this.juice = Math.min(JUICE_MAX, this.juice + 50);
            this.onJuiceUpdate(this.juice, JUICE_MAX);
        }

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

    /**
     * Helper method to handle common effect conclusion logic.
     * Reduces code duplication between tomato and bomb effects.
     * Returns the release position where particles should be spawned.
     */
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

        // Release captured fruits with restored properties
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

        // Visual and audio effects
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

        // Process each captured fruit - split into smaller fruits
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

        // Visual and audio effects
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

        // Initialize score sequence
        // 1. Flush any existing streak visual first to avoid "lost" score
        if (this.streakScore > 0) {
            this.onPopupUpdate({
                runningTotal: 0, // Sending 0 triggers the "Suck Up" in GameCanvas
                multiplier: 1,
                type: PopUpType.CHAIN
            });
        }

        // 2. Calculate Base Score for Celebration (5000)
        let baseScore = 5000;
        if (this.feverActive) {
            baseScore *= this.currentFrenzyMult;
        }

        this.celebrationScore = baseScore;
        this.streakScore = 0; // Clear any pending main game streak
        this.addScore(baseScore);

        // Trigger Popup
        this.onPopupUpdate({
            type: PopUpType.WATERMELON_CRUSH,
            runningTotal: this.celebrationScore,
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
                const p = this.fruits.find(f => f.id === id);
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

                    const p = this.fruits.find(f => f.id === id);
                    if (p) {
                        const tier = p.tier;
                        // Calculate Points (Base merge points for that tier)
                        // Formula: BASE * 2^tier
                        let points = SCORE_BASE_MERGE * Math.pow(2, tier) * 2; // Double points for clearing!

                        // Apply Frenzy Multiplier if active
                        if (this.feverActive) {
                            points *= this.currentFrenzyMult;
                        }
                        this.addScore(points);
                        this.celebrationScore += points;

                        // Visual & Audio
                        this.effectSystem.createMergeEffect(p.x, p.y, FRUIT_DEFS[tier].color);
                        this.audio.playMergeSound(tier);
                        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(10);

                        this.removeParticle(p);

                        // Update Popup
                        this.onPopupUpdate({
                            type: PopUpType.WATERMELON_CRUSH,
                            runningTotal: this.celebrationScore,
                            multiplier: 1
                        });
                    }

                    // If we just popped the last one, end logic
                    if (state.popIndex >= state.capturedIds.length) {
                        this.celebrationEffect = null;
                        this.audio.playBombShrapnel(); // Final sound

                        // Finish: Trigger Suck Up logic (sending 0 resets and sucks)
                        this.onPopupUpdate({
                            type: PopUpType.WATERMELON_CRUSH,
                            runningTotal: 0,
                            multiplier: 1
                        });
                        this.celebrationScore = 0;
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

        // 1. Game Start Phase: First 9 fruits must be normal
        // "First 9 are not allowed to be a special"
        if (this.generatedFruitCount < 9) {
            this.generatedFruitCount++;
            this.consecutiveNonSpecialCount++;
            return pickNormal();
        }

        // 2. Pity Timer: If 9 consecutive non-specials, force special on the 10th
        // "no special is spawning within 9 spawns, on 10 th there will be a random spawn of a special"
        if (this.consecutiveNonSpecialCount >= 9) {
            this.generatedFruitCount++;
            this.consecutiveNonSpecialCount = 0;
            return pickSpecial();
        }

        // 3. Standard Random Logic
        this.generatedFruitCount++;
        const rand = Math.random();

        // 4.5% chance for special (1.5% each)
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
            this.spawnNextFruit(); // Actually need to handle logic: if swapping, do we use queue or force next?
            // "spawnNextFruit" uses queue. Correct behavior for first swap.
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
        this.renderSystem.removeSprite(p);
    }

    addScore(amt: number) {
        this.score += Math.floor(amt);
        this.stats.score = this.score;
        // DISABLED for now to decouple Real score from Display score (per Task 2 requirements)
        // this.onScore(Math.floor(amt), this.score); 
    }

    gameOver() {
        this.canDrop = false;
        this.app?.ticker.stop();
        this.audio.stop();
        this.onGameOver(this.stats);
    }

    cleanup() {
        this.destroyed = true;
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
