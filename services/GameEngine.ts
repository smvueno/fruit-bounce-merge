
import * as PIXI from 'pixi.js';
import { FruitDef, FruitTier, Difficulty, GameSettings, GameStats } from '../types';
import { FRUIT_DEFS, DIFFICULTY_CONFIG, SUBSTEPS, WALL_DAMPING, FLOOR_DAMPING, FRICTION_SLIDE, FRICTION_LOCK, DANGER_TIME_MS, DANGER_Y_PERCENT, SPAWN_Y_PERCENT, SCORE_BASE_MERGE, FEVER_THRESHOLD, FEVER_DURATION_MS, JUICE_MAX } from '../constants';
import { MusicEngine } from './MusicEngine';

// --- Virtual Resolution ---
const V_WIDTH = 600;
const V_HEIGHT = 900;

// --- Physics Types ---
class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    mass: number;
    tier: FruitTier;
    id: number;
    isStatic: boolean = false; // "Static" means waiting to be dropped

    // State flags
    ignoreCollisions: boolean = false;
    isCaught: boolean = false;
    contactCount: number = 0; // Number of distinct bodies (or floor) this particle is touching
    stability: number = 0; // 0.0 = Unstable/Free, 1.0 = Stable/Locked. Used for mass weighting.
    cooldownTimer: number = 0;

    rotation: number = 0;
    angularVelocity: number = 0;

    // Visuals
    scaleX: number = 1;
    scaleY: number = 1;
    alpha: number = 1;

    // Animation State
    blinkTimer: number = Math.random() * 200;
    isBlinking: boolean = false;

    constructor(x: number, y: number, def: FruitDef, id: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = def.radius;
        this.mass = 1.0; // Enforce equal mass for stability
        this.tier = def.tier;
        this.id = id;
    }
}

class TomatoEffect {
    tomatoId: number;
    x: number;
    y: number;
    timer: number;
    maxTime: number;
    targetTier: FruitTier;
    capturedIds: number[] = [];

    constructor(id: number, x: number, y: number, targetTier: FruitTier) {
        this.tomatoId = id;
        this.x = x;
        this.y = y;
        this.targetTier = targetTier;
        this.maxTime = 3.5;
        this.timer = this.maxTime;
    }
}

class EffectParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string | number;
    life: number;
    type: 'circle' | 'star' | 'suck' | 'bomb-ghost';
    targetId?: number;
    rotation: number = 0; // Added for spinning stars

    constructor(x: number, y: number, color: string | number, type: 'circle' | 'star' | 'suck' | 'bomb-ghost' = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.type = type;
        this.size = type === 'star' ? 10 + Math.random() * 10 : 3 + Math.random() * 5;
        this.life = 1.0;
        this.alpha = 1.0;
    }
}

// --- Engine ---
export class GameEngine {
    app: PIXI.Application | undefined;
    container: PIXI.Container;
    effectContainer: PIXI.Container;
    effectGraphics: PIXI.Graphics;
    floorGraphics: PIXI.Graphics;

    fruits: Particle[] = [];
    nextId: number = 0;
    canvasElement: HTMLCanvasElement;

    width: number = V_WIDTH;
    height: number = V_HEIGHT;
    scaleFactor: number = 1;

    difficulty: Difficulty;
    settings: GameSettings;
    destroyed: boolean = false;
    initializing: boolean = false;
    paused: boolean = false;

    currentFruit: Particle | null = null;
    nextFruitTier: FruitTier = FruitTier.CHERRY;
    nextFruitQueue: FruitTier[] = []; // Lookahead queue
    isAiming: boolean = false;
    canDrop: boolean = true;
    aimX: number = 0;
    dragAnchorX: number = 0;
    dragAnchorY: number = 0;

    activeTomatoes: TomatoEffect[] = [];
    visualParticles: EffectParticle[] = [];

    audio: MusicEngine;

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

    score: number = 0;
    stats: GameStats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };

    comboChain: number = 0;
    didMergeThisTurn: boolean = false;

    feverActive: boolean = false;
    feverTimer: number = 0;
    juice: number = 0;

    dangerTimer: number = 0;
    dangerActive: boolean = false;
    dangerAccumulator: number = 0;
    readonly DANGER_TRIGGER_DELAY: number = 3000;

    fruitSprites: Map<number, PIXI.Container> = new Map();
    textures: Map<FruitTier, PIXI.Texture> = new Map();
    dangerLine: PIXI.Graphics;
    pointerHistory: { x: number, y: number, time: number }[] = [];
    lastFruitX: number = 0;
    lastFruitY: number = 0;

    constructor(
        canvas: HTMLCanvasElement,
        difficulty: Difficulty,
        settings: GameSettings,
        callbacks: any
    ) {
        this.canvasElement = canvas;
        this.difficulty = difficulty;
        this.settings = settings;
        Object.assign(this, callbacks);

        this.container = new PIXI.Container();
        this.effectContainer = new PIXI.Container();
        this.effectGraphics = new PIXI.Graphics();
        this.effectContainer.addChild(this.effectGraphics);
        this.floorGraphics = new PIXI.Graphics();
        this.dangerLine = new PIXI.Graphics();
        this.audio = new MusicEngine(this.settings.musicEnabled, this.settings.sfxEnabled);
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

        const actualW = this.app.screen.width;
        const actualH = this.app.screen.height;
        this.scaleFactor = Math.min(actualW / V_WIDTH, actualH / V_HEIGHT);
        this.container.scale.set(this.scaleFactor);
        this.effectContainer.scale.set(this.scaleFactor);

        const virtualHeightScaled = V_HEIGHT * this.scaleFactor;
        if (actualH > virtualHeightScaled) {
            const yOffset = (actualH - virtualHeightScaled) / 2;
            this.container.position.y = yOffset;
            this.effectContainer.position.y = yOffset;
        }

        this.app.stage.addChild(this.effectContainer);
        this.app.stage.addChild(this.container);
        this.container.addChild(this.floorGraphics);
        this.container.addChild(this.dangerLine);

        this.initTextures();
        this.drawFloor();
        this.spawnNextFruit();

        this.app.ticker.add(this.update.bind(this));

        this.app.stage.eventMode = 'static';
        if (this.app.screen) this.app.stage.hitArea = this.app.screen;

        this.app.stage.on('pointerdown', this.onPointerDown.bind(this));
        this.app.stage.on('pointermove', this.onPointerMove.bind(this));
        this.app.stage.on('pointerup', this.onPointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.onPointerUp.bind(this));
    }

    reset() {
        // 1. Cleanup ALL fruit sprites to prevent ghosting
        this.fruitSprites.forEach((sprite) => {
            if (sprite && sprite.parent) {
                sprite.parent.removeChild(sprite);
                sprite.destroy({ children: true });
            }
        });
        this.fruitSprites.clear();

        // Explicitly clear arrays
        this.fruits = [];
        this.activeTomatoes = [];
        this.visualParticles = [];

        // Cleanup current fruit if it exists
        if (this.currentFruit) {
            this.currentFruit = null;
        }

        // 2. Clear Graphics
        this.effectGraphics.clear();

        // 3. Reset Game State
        this.score = 0;
        this.stats = { score: 0, bestCombo: 0, feverCount: 0, tomatoUses: 0, dangerSaves: 0, timePlayed: 0, maxTier: FruitTier.CHERRY };
        this.comboChain = 0;
        this.didMergeThisTurn = false;
        this.feverActive = false;
        this.feverTimer = 0;
        this.juice = 0;
        this.dangerTimer = 0;
        this.dangerActive = false;
        this.dangerAccumulator = 0;
        this.nextId = 0;
        this.isAiming = false;
        this.canDrop = true;

        // 4. Update UI via callbacks
        this.onScore(0, 0);
        this.onCombo(0);
        this.onFeverEnd();
        this.audio.setFrenzy(false); // Reset frenzy audio
        this.onJuiceUpdate(0, JUICE_MAX);
        this.onDanger(false, 0);
        this.onTimeUpdate(0);

        // 5. Restart Gameplay
        this.setPaused(false);
        // Seed Queue
        this.nextFruitQueue = [this.pickRandomFruit(FruitTier.CHERRY)];
        this.spawnNextFruit();

        if (this.settings.musicEnabled || this.settings.sfxEnabled) {
            this.audio.resume();
        }
    }

    getFloorY(x: number) {
        const baseY = this.height - 60;
        return baseY + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.04) * 5;
    }

    drawFloor() {
        this.floorGraphics.clear();

        // Calculate dynamic bottomY to ensure it covers the whole screen downwards
        // logic: (actualScreenHeight - containerY) / scaleFactor = virtualBottomInLocalSpace
        // Add some buffer (+200) just in case
        const actualH = this.app?.screen.height || this.height;
        const containerY = this.container.position.y || 0;
        const scale = this.scaleFactor || 1;
        const bottomY = ((actualH - containerY) / scale) + 200;

        const step = 5;
        this.floorGraphics.moveTo(0, bottomY);
        this.floorGraphics.lineTo(0, this.getFloorY(0));
        for (let x = 0; x <= this.width; x += step) {
            this.floorGraphics.lineTo(x, this.getFloorY(x));
        }
        this.floorGraphics.lineTo(this.width, this.getFloorY(this.width));
        this.floorGraphics.lineTo(this.width, bottomY);
        this.floorGraphics.closePath();
        this.floorGraphics.fill({ color: 0x76C043 });
        this.floorGraphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 });
        this.floorGraphics.circle(50, this.height, 15);
        this.floorGraphics.circle(80, this.height + 20, 20);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
        this.floorGraphics.circle(this.width - 100, this.height, 25);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
    }

    initTextures() {
        if (!this.app?.renderer) return;
        Object.values(FRUIT_DEFS).forEach(def => {
            const container = new PIXI.Container();
            // Use the centralized rendering logic
            def.renderPixiBody(container, def.radius);

            const texture = this.app!.renderer.generateTexture({ target: container });
            this.textures.set(def.tier, texture);
            container.destroy({ children: true });
        });
    }

    createFace(tier: FruitTier, radius: number): PIXI.Container {
        const def = FRUIT_DEFS[tier];
        if (def && def.renderPixiFace) {
            return def.renderPixiFace(radius);
        }
        return new PIXI.Container();
    }

    spawnNextFruit() {
        if (!this.canDrop) return;

        // Calculate max tier for difficulty scaling
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

        // 1. Get tier from Queue (or generate if empty - fallback)
        let tier = this.nextFruitQueue.shift();
        if (tier === undefined) tier = this.pickRandomFruit(maxTier);

        // 2. Replenish Queue (Next Lookahead)
        const nextLookahead = this.pickRandomFruit(maxTier);
        this.nextFruitQueue.push(nextLookahead);

        // 3. Update UI to show the *newly queued* fruit
        this.onNextFruit(nextLookahead);

        // 4. Spawn the *current* fruit (dequeued)
        this.nextFruitTier = tier;
        this.currentFruit = new Particle(
            this.width / 2,
            this.height * SPAWN_Y_PERCENT,
            FRUIT_DEFS[tier],
            this.nextId++
        );
        this.currentFruit.isStatic = true;
        this.dragAnchorX = this.width / 2;
        this.dragAnchorY = this.height * SPAWN_Y_PERCENT;
        this.createSprite(this.currentFruit);
    }

    forceCurrentFruit(tier: FruitTier) {
        if (!this.currentFruit) return;

        // Cleanup existing sprite
        const oldSprite = this.fruitSprites.get(this.currentFruit.id);
        if (oldSprite) {
            this.container.removeChild(oldSprite);
            oldSprite.destroy({ children: true });
            this.fruitSprites.delete(this.currentFruit.id);
        }

        this.nextFruitTier = tier;
        // Don't update "Next" preview when forcing current fruit (debug cheat)

        // Create new particle at same position
        this.currentFruit = new Particle(
            this.currentFruit.x,
            this.currentFruit.y,
            FRUIT_DEFS[tier],
            this.nextId++
        );
        this.currentFruit.isStatic = true;

        this.createSprite(this.currentFruit);
    }

    createSprite(p: Particle) {
        if (!this.textures.has(p.tier)) return;
        const tex = this.textures.get(p.tier)!;
        const sprite = new PIXI.Container();
        const body = new PIXI.Sprite(tex);
        body.anchor.set(0.5);
        sprite.addChild(body);
        const face = this.createFace(p.tier, p.radius);
        face.label = "face";
        sprite.addChild(face);
        this.fruitSprites.set(p.id, sprite);
        this.container.addChild(sprite);
    }

    getVirtualPos(globalX: number, globalY: number) {
        if (!this.app || !this.app.stage) return { x: globalX / this.scaleFactor, y: globalY / this.scaleFactor };
        const containerY = this.container.position.y;
        return {
            x: globalX / this.scaleFactor,
            y: (globalY - containerY) / this.scaleFactor
        };
    }

    onPointerDown(e: PIXI.FederatedPointerEvent) {
        if (this.paused) return;
        this.audio.resume();
        if (!this.currentFruit || !this.canDrop) return;
        this.isAiming = true;
        const p = this.getVirtualPos(e.global.x, e.global.y);
        this.updateAim(p.x, p.y);
        this.pointerHistory = [];
    }

    onPointerMove(e: PIXI.FederatedPointerEvent) {
        if (this.paused) return;
        if (!this.isAiming) return;
        const p = this.getVirtualPos(e.global.x, e.global.y);
        this.updateAim(p.x, p.y);
        const now = performance.now();
        this.pointerHistory.push({ x: p.x, y: p.y, time: now });
        if (this.pointerHistory.length > 8) this.pointerHistory.shift();
    }

    updateAim(x: number, y: number) {
        const r = this.currentFruit ? this.currentFruit.radius : 20;
        this.aimX = Math.max(r, Math.min(this.width - r, x));
        this.dragAnchorX = this.aimX;
        this.dragAnchorY = (this.height * SPAWN_Y_PERCENT) + (Math.min(y, this.height * 0.4) - this.height * 0.2) * 0.1;
    }

    onPointerUp(e: PIXI.FederatedPointerEvent) {
        if (this.paused) return;
        if (!this.isAiming || !this.currentFruit) return;
        this.isAiming = false;
        let vx = 0;
        let vy = 0;
        if (this.pointerHistory.length >= 2) {
            const newest = this.pointerHistory[this.pointerHistory.length - 1];
            const oldest = this.pointerHistory[0];
            const dt = newest.time - oldest.time;
            if (dt > 0) {
                // BOOSTED THROW POWER! (Was 15)
                vx = (newest.x - oldest.x) / dt * 22;
                vy = (newest.y - oldest.y) / dt * 22;
            }
        }
        const maxSpeed = 40; // INCREASED MAX SPEED (Was 25)
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > maxSpeed) {
            vx = (vx / len) * maxSpeed;
            vy = (vy / len) * maxSpeed;
        }
        if (vy < -15) vy = -15;

        // --- CHAIN COMBO LOGIC RESET ---
        // If the previous turn (drop) resulted in NO merges, reset the combo chain.
        if (!this.didMergeThisTurn) {
            this.comboChain = 0;
            this.onCombo(0);
        }
        // Reset flags for the upcoming turn
        this.didMergeThisTurn = false;

        this.currentFruit.isStatic = false;
        this.currentFruit.vx = vx;
        this.currentFruit.vy = vy;
        this.currentFruit.angularVelocity = vx * 0.05;
        this.fruits.push(this.currentFruit);
        this.currentFruit = null;
        this.canDrop = false;
        const config = DIFFICULTY_CONFIG[this.difficulty];
        setTimeout(() => {
            this.canDrop = true;
            this.spawnNextFruit();
        }, config.spawnDelay);
    }

    update(ticker: PIXI.Ticker) {
        if (this.paused) return;
        const dt = 1 / 60;
        this.updateGameLogic(dt * 1000);
        this.updatePhysics(dt);
        this.updateVisualEffects(dt);
        this.audio.update();
        this.drawDangerLine();
        this.renderSync();
    }

    spawnPassiveTomatoParticle(x: number, y: number, radius: number) {
        if (Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const r = radius * (0.8 + Math.random() * 0.3);
            const sx = x + Math.cos(angle) * r;
            const sy = y + Math.sin(angle) * r;

            const part = new EffectParticle(sx, sy, 0xFF6347, 'circle');
            // MUCH slower drift (buggy fast issue fix)
            part.vx = Math.cos(angle) * 0.1;
            part.vy = Math.sin(angle) * 0.1 - 0.1;
            part.life = 1.0;
            part.size = 1 + Math.random() * 2; // Start smaller, expand later
            part.alpha = 0.5;
            this.visualParticles.push(part);
        }
    }

    spawnTrailParticles(x: number, y: number, radius: number, parentVx: number, parentVy: number) {
        // "Poppy" trail logic
        for (let i = 0; i < 2; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius * 0.5;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;

            const part = new EffectParticle(px, py, 0xFF6347, 'circle');
            // Inherit 20% of parent velocity for "follow along" + small random drift
            part.vx = (parentVx * 0.2) + (Math.random() - 0.5) * 0.5;
            part.vy = (parentVy * 0.2) + (Math.random() - 0.5) * 0.5;
            part.life = 0.6; // Short life
            part.size = 3 + Math.random() * 3;
            part.alpha = 0.8;
            this.visualParticles.push(part);
        }
    }

    updateVisualEffects(dt: number) {
        this.effectGraphics.clear();
        const activeTomatoes = this.activeTomatoes;
        const hasActive = activeTomatoes.length > 0;

        // 1. SPAWN PARTICLES

        // A. Active Tomato "Event Horizon" Spawning
        if (hasActive) {
            if (this.visualParticles.filter(p => p.type === 'suck').length < 300) {
                for (const t of activeTomatoes) {
                    for (let i = 0; i < 3; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spawnR = 180 + Math.random() * 40;
                        const px = t.x + Math.cos(angle) * spawnR;
                        const py = t.y + Math.sin(angle) * spawnR;

                        const p = new EffectParticle(px, py, 0xFF4444, 'suck');
                        p.targetId = t.tomatoId;
                        p.life = 1.0;
                        p.size = 3 + Math.random() * 3;
                        p.alpha = 0; // Fade in
                        this.visualParticles.push(p);
                    }
                }
            }
        }

        // B. Passive Particles & Trails (Existing Fruits)
        for (const p of this.fruits) {
            if (p.isCaught) continue;

            // 1. Passive Particles (Floating around)
            if (p.tier === FruitTier.TOMATO) {
                this.spawnPassiveTomatoParticle(p.x, p.y, p.radius);
            } else if (p.tier === FruitTier.RAINBOW) {
                if (Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = p.radius * (0.8 + Math.random() * 0.4);
                    const px = p.x + Math.cos(angle) * r;
                    const py = p.y + Math.sin(angle) * r;
                    const color = Math.random() > 0.5 ? 0xFFD700 : 0xFFA500;
                    const part = new EffectParticle(px, py, color, Math.random() > 0.7 ? 'star' : 'circle');
                    part.vx = Math.cos(angle) * 0.2;
                    part.vy = Math.sin(angle) * 0.2 - 0.2;
                    part.life = 1.2;
                    part.size = 2 + Math.random() * 3;
                    part.alpha = 0.6;
                    this.visualParticles.push(part);
                }
            }

            // 2. Trails (Moving fast)
            if (!p.isStatic) {
                const speedSq = p.vx * p.vx + p.vy * p.vy;
                if (speedSq > 25) { // speed > 5
                    if (p.tier === FruitTier.TOMATO || p.tier === FruitTier.RAINBOW) {
                        this.spawnTrailParticles(p.x, p.y, p.radius, p.vx, p.vy);
                    }
                }
            }
        }

        // C. Current Fruit Passive Particles
        if (this.currentFruit) {
            if (this.currentFruit.tier === FruitTier.TOMATO) {
                this.spawnPassiveTomatoParticle(this.currentFruit.x, this.currentFruit.y, this.currentFruit.radius);
            } else if (this.currentFruit.tier === FruitTier.RAINBOW) {
                if (Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = this.currentFruit.radius * 1.2;
                    const px = this.currentFruit.x + Math.cos(angle) * r;
                    const py = this.currentFruit.y + Math.sin(angle) * r;
                    const color = Math.random() > 0.5 ? 0xFFD700 : 0xFFA500;
                    const part = new EffectParticle(px, py, color, Math.random() > 0.7 ? 'star' : 'circle');
                    part.vx = Math.cos(angle) * 0.2;
                    part.vy = Math.sin(angle) * 0.2 - 0.2;
                    part.life = 1.0; // shorter life for aimed fruit
                    part.size = 3 + Math.random() * 3;
                    part.alpha = 0.8;
                    this.visualParticles.push(part);
                }
            }
        }

        // D. Fever Particles
        if (this.feverActive) {
            if (Math.random() < 0.3) {
                const sparkle = new EffectParticle(Math.random() * this.width, this.height + 20, 0xFFD700, 'star');
                sparkle.vy = -Math.random() * 2 - 2;
                sparkle.vx = (Math.random() - 0.5) * 1;
                this.visualParticles.push(sparkle);
            }
        }

        // 2. UPDATE & RENDER PARTICLES
        for (let i = this.visualParticles.length - 1; i >= 0; i--) {
            const p = this.visualParticles[i];
            let targetTomato: TomatoEffect | null = null;

            // Find associated tomato for 'suck' particles
            if (p.type === 'suck' && hasActive && p.targetId !== undefined) {
                targetTomato = activeTomatoes.find(t => t.tomatoId === p.targetId) || null;
                if (!targetTomato) {
                    this.visualParticles.splice(i, 1);
                    continue;
                }
            }

            if (targetTomato) {
                // --- EVENT HORIZON MODE ---
                const dx = p.x - targetTomato.x;
                const dy = p.y - targetTomato.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const currentAngle = Math.atan2(dy, dx);

                if (dist < 20) {
                    this.visualParticles.splice(i, 1);
                    continue;
                }

                const radialSpeed = 3 + (200 / (dist + 10));
                const tangentialSpeed = 0.15;

                const nextAngle = currentAngle + tangentialSpeed;
                const nextRadius = dist - radialSpeed;

                p.x = targetTomato.x + Math.cos(nextAngle) * nextRadius;
                p.y = targetTomato.y + Math.sin(nextAngle) * nextRadius;
                p.color = 0xFF0000;
                if (p.alpha < 1.0) p.alpha += 0.05;

                this.effectGraphics.circle(p.x, p.y, p.size);
                this.effectGraphics.fill({ color: p.color, alpha: p.alpha });

            } else {
                // --- PASSIVE / STANDARD MODE ---
                if (p.type === 'bomb-ghost') {
                    p.size += 4;
                    p.alpha -= 0.04;
                    p.life -= 0.04;
                } else {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= dt;

                    if (p.type === 'circle') {
                        p.alpha = Math.min(0.6, p.life);
                        p.vx *= 0.96;
                        p.vy *= 0.96;
                        if (p.life > 0.5) p.size += 0.05;
                    } else if (p.type === 'star') {
                        p.alpha = Math.min(1, p.life);
                        p.rotation += 0.1;
                    } else if (p.type === 'suck') {
                        p.life = 0; // Orphaned suck particle
                    }
                }

                if (p.life <= 0 || p.alpha <= 0 || p.y < -100 || p.y > this.height + 100) {
                    this.visualParticles.splice(i, 1);
                    continue;
                }

                // Render
                if (p.type === 'star') {
                    this.effectGraphics.star(p.x, p.y, 5, p.size, p.size * 0.4, p.rotation);
                    this.effectGraphics.fill({ color: p.color, alpha: p.alpha });
                } else if (p.type === 'bomb-ghost') {
                    this.effectGraphics.circle(p.x, p.y, p.size);
                    this.effectGraphics.fill({ color: 0x212121, alpha: p.alpha });
                } else {
                    this.effectGraphics.circle(p.x, p.y, p.size);
                    this.effectGraphics.fill({ color: p.color, alpha: p.alpha });
                }
            }
        }
    }


    createMergeEffect(x: number, y: number, color: string) {
        for (let i = 0; i < 15; i++) {
            const p = new EffectParticle(x, y, color, Math.random() > 0.5 ? 'circle' : 'star');
            const angle = Math.random() * Math.PI * 2;
            const force = Math.random() * 10 + 5;
            p.vx = Math.cos(angle) * force;
            p.vy = Math.sin(angle) * force;
            this.visualParticles.push(p);
        }
    }

    updateGameLogic(dtMs: number) {
        this.stats.timePlayed += dtMs;
        this.onTimeUpdate(this.stats.timePlayed);

        for (let i = this.activeTomatoes.length - 1; i >= 0; i--) {
            const t = this.activeTomatoes[i];
            t.timer -= dtMs / 1000;
            const tomatoParticle = this.fruits.find(p => p.id === t.tomatoId);
            if (tomatoParticle) {
                t.x = tomatoParticle.x;
                t.y = tomatoParticle.y;
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
        for (const p of this.fruits) {
            if (p.cooldownTimer > 0) p.cooldownTimer -= dtMs / 1000;
        }
        // Removed old combo decay logic. Combo now controlled by drop chain.

        if (this.feverActive) {
            this.feverTimer -= dtMs;
            if (this.feverTimer <= 0) {
                this.feverActive = false;
                this.audio.setFrenzy(false); // Music normal
                this.juice = 0;
                this.onJuiceUpdate(0, JUICE_MAX);
                this.onFeverEnd();
            }
        } else {
            if (this.juice >= JUICE_MAX && !this.feverActive) {
                this.feverActive = true;
                this.audio.setFrenzy(true); // Music frenzy
                this.feverTimer = FEVER_DURATION_MS;
                this.stats.feverCount++;
                // Multiplier is Count + 1 (1st time = x2, 2nd = x3) IF we count from 0-based index logically, 
                // but stats.feverCount is purely how many times it happened. 
                // User requirement: "Increase by 1 every time".
                // First fever (count=1) -> x2. Second (count=2) -> x3.
                const mult = this.stats.feverCount + 1;
                this.onFeverStart(mult);
            }
        }
        const dangerY = this.height * DANGER_Y_PERCENT;
        let inDangerZone = false;
        for (const f of this.fruits) {
            if (!f.isStatic && f.y - f.radius < dangerY) {
                inDangerZone = true;
                break;
            }
        }
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

    // --- REFACTORED PHYSICS LOOP ---
    updatePhysics(dt: number) {
        const config = DIFFICULTY_CONFIG[this.difficulty];
        const gravity = config.gravity;
        const friction = config.friction;

        // 1. Reset Collision Flags
        for (const p of this.fruits) {
            if (!p.isCaught) p.ignoreCollisions = false;
        }

        // 2. Integration & Aiming
        if (this.currentFruit && this.isAiming) {
            const k = 0.1;
            const ax = this.dragAnchorX - this.currentFruit.x;
            const ay = this.dragAnchorY - this.currentFruit.y;
            this.currentFruit.vx += ax * k;
            this.currentFruit.vy += ay * k;
            this.currentFruit.vx *= 0.8;
            this.currentFruit.vy *= 0.8;
            this.currentFruit.x += this.currentFruit.vx;
            this.currentFruit.y += this.currentFruit.vy;
        }

        for (const p of this.fruits) {
            if (p.isStatic) continue;

            if (!p.isCaught) {
                p.vy += gravity;
                p.vx *= friction;
                p.vy *= friction;
            }

            // Apply Velocity
            p.x += p.vx;
            p.y += p.vy;

            // Rotation
            p.rotation += p.angularVelocity;
            p.angularVelocity *= 0.95; // Strong rotational drag

            p.blinkTimer -= 1;
            if (p.blinkTimer <= 0) {
                p.isBlinking = !p.isBlinking;
                p.blinkTimer = p.isBlinking ? 10 : 200 + Math.random() * 300;
            }
        }

        // 3. Tomato Logic (Tractor)
        this.updateTomatoPhysics();

        // 4. Solver Loop (Substeps)
        for (let s = 0; s < SUBSTEPS; s++) {
            this.updateContactCounts(); // NEW: Count contacts before resolving

            // --- GLOBAL LOCKING FRICTION ---
            // If a particle is touching > 1 things, we dampen it heavily here.
            // This stops sliding when wedged, regardless of collision angle.
            for (const p of this.fruits) {
                if (p.isStatic || p.isCaught) continue;

                if (p.contactCount > 1) {
                    // LOCK IT DOWN
                    p.vx *= FRICTION_LOCK;
                    p.vy *= FRICTION_LOCK;
                    p.angularVelocity *= 0.5; // Kill rotation
                }
            }

            this.resolveCollisions();
            this.resolveWalls();
        }
    }

    updateContactCounts() {
        // Reset counts
        for (const p of this.fruits) {
            p.contactCount = 0;
        }

        // Check floor
        for (const p of this.fruits) {
            if (p.isStatic || p.isCaught) continue;
            // Check if touching floor
            const groundY = this.getFloorY(p.x);
            if (p.y + p.radius >= groundY - 2) { // 2px epsilon
                p.contactCount++;
            }
        }

        // Check pairs
        for (let i = 0; i < this.fruits.length; i++) {
            for (let j = i + 1; j < this.fruits.length; j++) {
                const p1 = this.fruits[i];
                const p2 = this.fruits[j];
                if (p1.ignoreCollisions || p2.ignoreCollisions || p1.isStatic || p2.isStatic) continue;

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                const radSum = p1.radius + p2.radius;
                if (distSq < radSum * radSum) {
                    p1.contactCount++;
                    p2.contactCount++;
                }
            }
        }

        // Calculate Stability (Inertia)
        // > 1 Contact = Stable (Massive inertia)
        // <= 1 Contact = Unstable (Normal mass)
        for (const p of this.fruits) {
            if (p.contactCount > 1) {
                p.stability = 1.0;
            } else {
                p.stability = 0.0;
            }
        }
    }

    updateTomatoPhysics() {
        for (const t of this.activeTomatoes) {
            const tomato = this.fruits.find(p => p.id === t.tomatoId);
            if (!tomato) continue;

            for (const p of this.fruits) {
                if (p.id === t.tomatoId || p === this.currentFruit || p.isStatic) continue;

                if (p.tier === t.targetTier) {
                    p.isCaught = true;
                    p.ignoreCollisions = true;
                    if (!t.capturedIds.includes(p.id)) t.capturedIds.push(p.id);

                    const dx = tomato.x - p.x;
                    const dy = tomato.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) + (Math.PI / 9);
                    const speed = 15 + (1000 / (dist + 50));

                    p.vx = p.vx * 0.85 + Math.cos(angle) * speed * 0.15;
                    p.vy = p.vy * 0.85 + Math.sin(angle) * speed * 0.15;

                    const suckRadius = tomato.radius * 4;
                    if (dist < suckRadius) {
                        const scale = Math.max(0.1, dist / suckRadius);
                        p.scaleX = scale;
                        p.scaleY = scale;
                        p.alpha = scale;
                        p.rotation += 0.3;
                    }
                }
            }
        }
    }

    resolveWalls() {
        const width = this.width;
        for (const p of this.fruits) {
            if (p.isStatic || p.isCaught) continue;

            const groundY = this.getFloorY(p.x);

            // Strict Floor Clamp
            if (p.y + p.radius > groundY) {
                p.y = groundY - p.radius; // HARD RESET
                p.vy *= -FLOOR_DAMPING; // Bounce (Uses constant for bounciness)
                p.vx *= 0.85; // Floor Friction

                // Push out of slope if needed (simplified)
                // Just ensuring y is correct fixes 90% of tunneling
            }

            // Walls
            if (p.x - p.radius < 0) {
                p.x = p.radius;
                p.vx *= -WALL_DAMPING; // Bounce
            }
            if (p.x + p.radius > width) {
                p.x = width - p.radius;
                p.vx *= -WALL_DAMPING; // Bounce
            }
        }
    }

    resolveCollisions() {
        for (let i = 0; i < this.fruits.length; i++) {
            for (let j = i + 1; j < this.fruits.length; j++) {
                const p1 = this.fruits[i];
                const p2 = this.fruits[j];

                if (p1.ignoreCollisions || p2.ignoreCollisions) continue;
                if (p1.isStatic && p2.isStatic) continue;

                // Tomato Logic Pass-through
                const tEffect = this.activeTomatoes.find(t => t.tomatoId === p1.id || t.tomatoId === p2.id);
                if (tEffect) {
                    const other = p1.id === tEffect.tomatoId ? p2 : p1;
                    if (other.tier === tEffect.targetTier) continue;
                }

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                const radSum = p1.radius + p2.radius;

                if (distSq < radSum * radSum) {
                    const dist = Math.sqrt(distSq);

                    // --- SPECIAL LOGIC: BOMB ---
                    if (p1.tier === FruitTier.BOMB || p2.tier === FruitTier.BOMB) {
                        this.handleBombExplosion(p1.tier === FruitTier.BOMB ? p1 : p2);
                        return; // Explosion alters array, safest to return or break carefully. Returning is fine for this frame.
                    }

                    // --- SPECIAL LOGIC: RAINBOW (Wildcard) ---
                    let canMerge = false;

                    // Case 1: Normal Same Tier
                    if (p1.tier === p2.tier && p1.tier !== FruitTier.WATERMELON && p1.tier !== FruitTier.TOMATO && p1.tier !== FruitTier.RAINBOW) {
                        canMerge = true;
                    }
                    // Case 2: Rainbow + Anything (except specials)
                    else if ((p1.tier === FruitTier.RAINBOW || p2.tier === FruitTier.RAINBOW)) {
                        const validP1 = p1.tier < 90; // Not a special fruit
                        const validP2 = p2.tier < 90;

                        // Rainbow + Rainbow = Highest Tier? or just Watermelon? Let's say Watermelon.
                        if (p1.tier === FruitTier.RAINBOW && p2.tier === FruitTier.RAINBOW) {
                            // Merge to Watermelon directly? or just allow normal merge?
                            // Let's treat it as a "super merge" -> Clears screen? Or just makes watermelon. 
                            // Simplest: Treat as last tier merge.
                            // We construct a fake merge where tier is WATERMELON - 1 so result is WATERMELON.
                            // Hacky side effect: Force nextTier logic to handle it.
                            canMerge = true;
                        } else if (validP1 || validP2) {
                            canMerge = true;
                        }
                    }

                    if (canMerge) {
                        if (p1.cooldownTimer <= 0 && p2.cooldownTimer <= 0) {
                            this.merge(p1, p2);
                            i--;
                            break;
                        }
                    }

                    // --- RESTORED TOMATO LOGIC ---
                    if (p1.tier === FruitTier.TOMATO || p2.tier === FruitTier.TOMATO) {
                        this.handleTomatoCollision(p1, p2);
                        return;
                    }

                    if (dist === 0) continue;

                    // --- PHYSICS RESOLUTION (Weighted by Stability) ---
                    // ... (rest of physics resolution remains same)
                    const overlap = radSum - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const im1 = 1 / (p1.mass * (1 + p1.stability * 10));
                    const im2 = 1 / (p2.mass * (1 + p2.stability * 10));
                    const totalIm = im1 + im2;

                    const r1 = p1.isStatic ? 0 : (im1 / totalIm);
                    const r2 = p2.isStatic ? 0 : (im2 / totalIm);

                    if (!p1.isStatic) {
                        p1.x += nx * overlap * r1;
                        p1.y += ny * overlap * r1;
                    }
                    if (!p2.isStatic) {
                        p2.x -= nx * overlap * r2;
                        p2.y -= ny * overlap * r2;
                    }

                    // Impulse
                    const dvx = p1.vx - p2.vx;
                    const dvy = p1.vy - p2.vy;
                    const dot = dvx * nx + dvy * ny;

                    if (dot < 0) {
                        const restitution = 0.4;
                        const j = -(1 + restitution) * dot;

                        p1.vx += j * nx * r1;
                        p1.vy += j * ny * r1;
                        p2.vx -= j * nx * r2;
                        p2.vy -= j * ny * r2;

                        if (p1.contactCount <= 1) {
                            p1.vx *= FRICTION_SLIDE;
                            p1.vy *= FRICTION_SLIDE;
                        }
                        if (p2.contactCount <= 1) {
                            p2.vx *= FRICTION_SLIDE;
                            p2.vy *= FRICTION_SLIDE;
                        }
                    }
                }
            }
        }
    }

    handleBombExplosion(bomb: Particle) {
        // 1. Visuals
        // Create expanding ghost
        const ghost = new EffectParticle(bomb.x, bomb.y, 0x212121, 'bomb-ghost');
        ghost.size = bomb.radius;
        ghost.life = 1.0;
        ghost.alpha = 0.8;
        this.visualParticles.push(ghost);

        this.applyShockwave(bomb.x, bomb.y, 600, 40); // Push Power matches Tomato (600 range, 40 force)

        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        this.audio.playMergeSound(FruitTier.WATERMELON);

        // 2. Logic: Destroy low tier
        const range = 250;
        const destroyed: Particle[] = [];

        for (const p of this.fruits) {
            if (p === bomb || p.isStatic) continue;

            const dx = p.x - bomb.x;
            const dy = p.y - bomb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < range) {
                if (p.tier <= FruitTier.STRAWBERRY) {
                    destroyed.push(p);
                }
            }
        }

        // Remove Bomb
        this.removeParticle(bomb);

        // Remove destroyed & Spawn Fire Stars
        destroyed.forEach(p => {
            // Spawn Orange Red Fire Stars
            for (let k = 0; k < 8; k++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 2 + Math.random() * 4;
                const color = Math.random() > 0.5 ? 0xFF4500 : 0xFF6347; // OrangeRed / Tomato
                const sp = new EffectParticle(p.x, p.y, color, 'star');
                sp.vx = Math.cos(angle) * speed;
                sp.vy = Math.sin(angle) * speed;
                sp.life = 0.5 + Math.random() * 0.5;
                sp.size = 5 + Math.random() * 5;
                this.visualParticles.push(sp);
            }
            this.removeParticle(p);
        });
    }

    merge(p1: Particle, p2: Particle) {
        // Handle Logic for Rainbow
        let nextTier: number;

        if (p1.tier === FruitTier.RAINBOW && p2.tier === FruitTier.RAINBOW) {
            // Rainbow + Rainbow = Watermelon (Reward)
            nextTier = FruitTier.WATERMELON;
        } else if (p1.tier === FruitTier.RAINBOW) {
            nextTier = p2.tier + 1;
        } else if (p2.tier === FruitTier.RAINBOW) {
            nextTier = p1.tier + 1;
        } else {
            nextTier = p1.tier + 1;
        }

        // Cap at Watermelon
        if (nextTier > FruitTier.WATERMELON) nextTier = FruitTier.WATERMELON;
        // Or if we want to allow merging watermelons? For now cap.

        const basePoints = SCORE_BASE_MERGE * Math.pow(2, nextTier);
        // ... (Scoring and rest is same)
        this.comboChain++;
        this.didMergeThisTurn = true;
        this.onCombo(this.comboChain);

        const comboMult = 1 + Math.min(this.comboChain, 10);
        const feverMult = this.feverActive ? (this.stats.feverCount + 1) : 1;

        const totalPoints = basePoints * comboMult * feverMult;

        this.addScore(totalPoints);
        this.stats.bestCombo = Math.max(this.stats.bestCombo, this.comboChain);
        if (!this.feverActive) {
            this.juice = Math.min(JUICE_MAX, this.juice + 50);
            this.onJuiceUpdate(this.juice, JUICE_MAX);
        }
        this.removeParticle(p1);
        this.removeParticle(p2);

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const nextDef = FRUIT_DEFS[nextTier as FruitTier];
        const newP = new Particle(midX, midY, nextDef, this.nextId++);
        this.fruits.push(newP);
        this.createSprite(newP);
        this.createMergeEffect(midX, midY, nextDef.color);
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
        const sprite = this.fruitSprites.get(tomato.id);
        if (sprite) {
            sprite.alpha = 1;
        }
    }

    concludeTomatoEffect(effect: TomatoEffect) {
        const tomato = this.fruits.find(p => p.id === effect.tomatoId);
        let releaseX = effect.x;
        let releaseY = effect.y;
        if (tomato) {
            releaseX = tomato.x;
            releaseY = tomato.y;
            this.removeParticle(tomato);
            this.stats.tomatoUses++;
        }
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
        // Explosive visual release
        this.createMergeEffect(releaseX, releaseY, "#FF4444");
        this.applyShockwave(releaseX, releaseY, 600, 40);
        if (this.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 50]);
    }

    applyShockwave(x: number, y: number, radius: number, force: number) {
        for (const p of this.fruits) {
            const dx = p.x - x;
            const dy = p.y - y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < radius && d > 0) {
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

        const rand = Math.random();

        // Bomb disabled logic handled here if re-enabled
        // Rainbow Star: 1.5% Chance
        if (rand < 0.015) {
            return FruitTier.RAINBOW;
        } else if (rand < 0.030) {
            return FruitTier.TOMATO;
        } else {
            return possibleTiers[Math.floor(Math.random() * possibleTiers.length)];
        }
    }

    removeParticle(p: Particle) {
        const idx = this.fruits.indexOf(p);
        if (idx >= 0) this.fruits.splice(idx, 1);
        const sprite = this.fruitSprites.get(p.id);
        if (sprite) {
            this.container.removeChild(sprite);
            sprite.destroy();
            this.fruitSprites.delete(p.id);
        }
    }

    addScore(amt: number) {
        this.score += Math.floor(amt);
        this.stats.score = this.score;
        this.onScore(Math.floor(amt), this.score);
    }

    gameOver() {
        this.canDrop = false;
        this.app?.ticker.stop();
        this.audio.stop();
        this.onGameOver(this.stats);
    }

    drawDangerLine() {
        this.dangerLine.clear();
        const y = this.height * DANGER_Y_PERCENT;
        const width = this.width;
        this.dangerLine.moveTo(0, y);
        this.dangerLine.lineTo(width, y);
        if (this.dangerActive) {
            this.dangerLine.stroke({ width: 4, color: 0xFF4444, alpha: 0.8 }); // Solid line for now to fix type error
        } else {
            this.dangerLine.stroke({ width: 4, color: 0x000000, alpha: 0.2 });
        }
    }

    renderSync() {
        let rhythmicScaleX = 1;
        let rhythmicScaleY = 1;
        if (this.feverActive) {
            const time = Date.now();
            const pulse = Math.sin((time / 250) * Math.PI) * 0.05;
            rhythmicScaleX = 1 + pulse;
            rhythmicScaleY = 1 - pulse;
        }
        if (this.currentFruit) {
            const sprite = this.fruitSprites.get(this.currentFruit.id);
            if (sprite) {
                sprite.x = this.currentFruit.x;
                sprite.y = this.currentFruit.y;
                sprite.rotation = this.currentFruit.rotation;
            }
        }
        for (const p of this.fruits) {
            const sprite = this.fruitSprites.get(p.id);
            if (sprite) {
                sprite.x = p.x;
                sprite.y = p.y;
                sprite.rotation = p.rotation;
                sprite.alpha = p.alpha;
                sprite.scale.set(
                    p.scaleX * rhythmicScaleX,
                    p.scaleY * rhythmicScaleY
                );
                const face = sprite.getChildByLabel("face") as PIXI.Container;
                if (face) {
                    const eyes = face.getChildByLabel("eyes");
                    if (eyes) {
                        if (p.isBlinking) {
                            eyes.scale.y = 0.1;
                        } else {
                            eyes.scale.y = 1;
                        }
                    }
                    const lookX = Math.min(10, Math.max(-10, p.vx));
                    const lookY = Math.min(10, Math.max(-10, p.vy));
                    face.position.set(lookX * 0.5, lookY * 0.5);
                }
            }
        }
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
