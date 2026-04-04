import * as PIXI from 'pixi.js';
import { FruitTier, GameSettings, GameStats } from '../../types';
import { FRUIT_DEFS, GAME_CONFIG, DANGER_TIME_MS, DANGER_Y_PERCENT, SPAWN_Y_PERCENT, FEVER_DURATION_MS, JUICE_MAX } from '../../constants';
import { GroundRenderer } from '../renderers/GroundRenderer';
import { WallRenderer } from '../renderers/WallRenderer';
import { CloudRenderer } from '../renderers/CloudRenderer';

// ─── CONSTANTS ─────────────────────────────────────────────────────
const V_WIDTH = 600;
const V_HEIGHT = 750;
const GRAVITY = 0.8;
const FRICTION = 0.98;
const WALL_DAMPING = 0.5;
const FLOOR_DAMPING = 0.4;
const FLOOR_Y = V_HEIGHT - 15;
const SUBSTEPS = 4;
const TARGET_FPS = 120;
const DT = 1 / TARGET_FPS;

// ─── TYPES ─────────────────────────────────────────────────────────
interface FruitBody {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    tier: number;
    particle: PIXI.Particle;
    cooldown: number;
    alpha: number;
    scaleX: number;
    scaleY: number;
}

interface MergeEffect {
    x: number;
    y: number;
    color: string;
    timer: number;
    maxTime: number;
    circles: { x: number; y: number; r: number; alpha: number }[];
}

// ─── ENGINE ────────────────────────────────────────────────────────
export class NewGameEngine {
    // Pixi
    private app: PIXI.Application | null = null;
    private gameContainer: PIXI.Container;
    private fruitPC: PIXI.ParticleContainer;
    private effectGraphics: PIXI.Graphics;

    // Renderers
    private groundRenderer: GroundRenderer | null = null;
    private wallRenderer: WallRenderer | null = null;
    private cloudRenderer: CloudRenderer | null = null;

    // Screen tracking
    private _screenWidth = 0;
    private _screenHeight = 0;
    private _containerLeft = 0;
    private _containerTop = 0;
    private _gameAreaWidth = 0;
    private _gameAreaHeight = 0;

    // Game state
    private fruits: FruitBody[] = [];
    private effects: MergeEffect[] = [];
    private nextId = 0;
    private scaleFactor = 1;
    private canvas: HTMLCanvasElement;
    private settings: GameSettings;

    // Current fruit
    private currentFruit: FruitBody | null = null;
    private canDrop = true;
    private spawnTimeout: any = null;

    // Fruit textures (normal + blink)
    private fruitTextures: Map<number, PIXI.Texture> = new Map();

    // Callbacks
    onGameOver: (stats: GameStats) => void = () => {};
    onScore: (amount: number, total: number) => void = () => {};
    onCombo: (count: number) => void = () => {};
    onFeverStart: (mult: number) => void = () => {};
    onFeverEnd: (finalScore?: number) => void = () => {};
    onDanger: (active: boolean, remainingMs: number) => void = () => {};
    onJuiceUpdate: (current: number, max: number) => void = () => {};
    onNextFruit: (tier: FruitTier) => void = () => {};
    onMaxFruit: (tier: FruitTier) => void = () => {};
    onTimeUpdate: (ms: number) => void = () => {};
    onCelebration: () => void = () => {};
    onPointEvent: (event: any) => void = () => {};
    onPopupUpdate: (data: any) => void = () => {};

    // Stats
    private score = 0;
    private combo = 0;
    private feverActive = false;
    private feverTimer = 0;
    private dangerTimer = 0;
    private dangerActive = false;
    private dangerAccumulator = 0;
    private isOverLimit = false;
    private timePlayed = 0;
    private timeUpdateAccum = 0;

    // Performance
    perfStats = { fps: 0, frameTimeMs: 0, fruitCount: 0 };
    private _perfLastTime = 0;
    private _perfFrames = 0;
    private _perfFpsAccum = 0;

    // Juice
    private juice = 0;
    private juiceMax = JUICE_MAX;

    // Pause
    private paused = false;
    private destroyed = false;

    // Fruit map for O(1) lookups
    private _fruitMap = new Map<number, FruitBody>();

    constructor(canvas: HTMLCanvasElement, settings: GameSettings) {
        this.canvas = canvas;
        this.settings = settings;
        this.gameContainer = new PIXI.Container();
        this.fruitPC = new PIXI.ParticleContainer({
            dynamicProperties: { position: true, scale: true, rotation: false, color: false },
        });
        this.effectGraphics = new PIXI.Graphics();
    }

    async initialize() {
        if (this.destroyed) return;

        this.app = new PIXI.Application();
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        const cappedDpr = isMobile ? Math.min(window.devicePixelRatio || 1, 2) : (window.devicePixelRatio || 1);

        await this.app.init({
            canvas: this.canvas,
            backgroundAlpha: 0,
            width: this.canvas.clientWidth || window.innerWidth,
            height: this.canvas.clientHeight || window.innerHeight,
            antialias: !isMobile,
            resolution: cappedDpr,
            autoDensity: true,
            preference: 'webgl',
            resizeTo: this.canvas,
        });

        if (this.destroyed) { this.app.destroy({ removeView: false }); return; }

        // Generate fruit textures
        await this.generateFruitTextures();

        // Build scene graph
        this.app.stage.addChild(this.gameContainer);
        this.gameContainer.addChild(this.fruitPC);
        this.gameContainer.addChild(this.effectGraphics);

        // Initialize screen-space renderers
        this.groundRenderer = new GroundRenderer(this.app.stage);
        this.wallRenderer = new WallRenderer(this.app.stage);
        this.cloudRenderer = new CloudRenderer(this.app.stage, this.app.renderer);

        // Resize handler
        this.app.renderer.on('resize', () => this.handleResize());
        this.handleResize();

        // Input
        this.app.stage.eventMode = 'static';
        if (this.app.screen) this.app.stage.hitArea = this.app.screen;
        this.app.stage.on('pointerdown', this.onPointerDown.bind(this));
        this.app.stage.on('pointermove', this.onPointerMove.bind(this));
        this.app.stage.on('pointerup', this.onPointerUp.bind(this));
        this.app.stage.on('pointerupoutside', this.onPointerUp.bind(this));

        // Start — 120fps uncapped
        this.app.ticker.maxFPS = 0; // 0 = uncapped
        this.app.ticker.add(this.update.bind(this));

        // Spawn first fruit
        this.spawnNextFruit();

        console.log('[NewGameEngine] Initialized — 120fps uncapped, ParticleContainer fruits');
    }

    private async generateFruitTextures() {
        if (!this.app) return;
        const normalTiers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        for (const tier of normalTiers) {
            const def = FRUIT_DEFS[tier as FruitTier];
            if (!def) continue;

            // Normal face
            const g = new PIXI.Graphics();
            g.circle(0, 0, def.radius);
            g.fill({ color: this.hexColor(def.color) });
            // Eyes
            const eyeR = def.radius * 0.12;
            const eyeOff = def.radius * 0.25;
            g.circle(-eyeOff, -def.radius * 0.15, eyeR);
            g.circle(eyeOff, -def.radius * 0.15, eyeR);
            g.fill({ color: 0x000000 });
            // Pupils
            g.circle(-eyeOff + 1, -def.radius * 0.15, eyeR * 0.5);
            g.circle(eyeOff + 1, -def.radius * 0.15, eyeR * 0.5);
            g.fill({ color: 0xFFFFFF });
            // Mouth
            g.arc(0, def.radius * 0.1, def.radius * 0.2, 0, Math.PI);
            g.stroke({ width: 2, color: 0x000000 });

            const size = def.radius * 2 + 20;
            const tex = this.app.renderer.generateTexture({ target: g, resolution: 2, antialias: true });
            g.destroy();
            this.fruitTextures.set(tier, tex);

            // Blink face
            const gb = new PIXI.Graphics();
            gb.circle(0, 0, def.radius);
            gb.fill({ color: this.hexColor(def.color) });
            // Blinking eyes (thin lines)
            const blinkY = -def.radius * 0.15;
            gb.moveTo(-eyeOff - eyeR, blinkY);
            gb.lineTo(-eyeOff + eyeR, blinkY);
            gb.stroke({ width: 3, color: 0x000000 });
            gb.moveTo(eyeOff - eyeR, blinkY);
            gb.lineTo(eyeOff + eyeR, blinkY);
            gb.stroke({ width: 3, color: 0x000000 });
            // Mouth
            gb.arc(0, def.radius * 0.1, def.radius * 0.2, 0, Math.PI);
            gb.stroke({ width: 2, color: 0x000000 });

            const texB = this.app.renderer.generateTexture({ target: gb, resolution: 2, antialias: true });
            gb.destroy();
            // Store blink as tier + 100
            this.fruitTextures.set(tier + 100, texB);
        }
    }

    private hexColor(css: string): number {
        return parseInt(css.replace('#', ''), 16);
    }

    handleResize() {
        if (!this.app || !this.app.screen) return;

        const actualW = this.app.screen.width;
        const actualH = this.app.screen.height;

        if (this._gameAreaWidth > 0 && this._gameAreaHeight > 0) {
            this.scaleFactor = Math.min(this._gameAreaWidth / V_WIDTH, this._gameAreaHeight / V_HEIGHT);
        } else {
            const viewW = actualW / 1.4;
            const viewH = actualH / 1.4;
            this.scaleFactor = Math.min(viewW / V_WIDTH, viewH / V_HEIGHT);
        }

        this.gameContainer.scale.set(this.scaleFactor);
        const logicalW = V_WIDTH * this.scaleFactor;
        const logicalH = V_HEIGHT * this.scaleFactor;
        const xOffset = (actualW - logicalW) / 2;
        const yOffset = (actualH - logicalH) / 2;
        this.gameContainer.position.set(xOffset, yOffset);

        this._screenWidth = actualW;
        this._screenHeight = actualH;
        this._containerTop = this._gameAreaHeight > 0 ? (actualH - this._gameAreaHeight) / 2 : yOffset;
        this._containerLeft = this._gameAreaWidth > 0 ? (actualW - this._gameAreaWidth) / 2 : xOffset;

        this.groundRenderer?.draw(actualW, actualH, this._gameAreaWidth, this._gameAreaHeight, this._containerTop, this._containerLeft);
        this.wallRenderer?.draw(this._gameAreaWidth, this._gameAreaHeight, this._containerTop, this._containerLeft, actualH);
    }

    updateGameAreaRect(left: number, top: number, width: number, height: number) {
        if (!this.app || !this.app.screen) return;
        this._containerLeft = left;
        this._containerTop = top;
        this._gameAreaWidth = width;
        this._gameAreaHeight = height;
        this._screenWidth = this.app.screen.width;
        this._screenHeight = this.app.screen.height;
        this.scaleFactor = Math.min(width / V_WIDTH, height / V_HEIGHT);
        this.gameContainer.scale.set(this.scaleFactor);
        const logicalW = V_WIDTH * this.scaleFactor;
        const logicalH = V_HEIGHT * this.scaleFactor;
        this.gameContainer.position.set(
            (this._screenWidth - logicalW) / 2,
            (this._screenHeight - logicalH) / 2
        );
        this.groundRenderer?.draw(this._screenWidth, this._screenHeight, width, height, top, left);
        this.wallRenderer?.draw(width, height, top, left, this._screenHeight);
    }

    // ─── INPUT ─────────────────────────────────────────────────────
    private dragX = V_WIDTH / 2;

    private onPointerDown(e: PIXI.FederatedPointerEvent) {
        if (this.paused || !this.canDrop || !this.currentFruit) return;
        const pos = this.screenToVirtual(e.global.x, e.global.y);
        this.dragX = Math.max(this.currentFruit.radius, Math.min(V_WIDTH - this.currentFruit.radius, pos.x));
    }

    private onPointerMove(e: PIXI.FederatedPointerEvent) {
        if (!this.currentFruit || !this.canDrop) return;
        const pos = this.screenToVirtual(e.global.x, e.global.y);
        this.dragX = Math.max(this.currentFruit.radius, Math.min(V_WIDTH - this.currentFruit.radius, pos.x));
        this.currentFruit.x = this.dragX;
    }

    private onPointerUp(_e: PIXI.FederatedPointerEvent) {
        if (!this.currentFruit || !this.canDrop) return;
        this.dropFruit();
    }

    private screenToVirtual(screenX: number, screenY: number) {
        return {
            x: (screenX - this.gameContainer.position.x) / this.scaleFactor,
            y: (screenY - this.gameContainer.position.y) / this.scaleFactor,
        };
    }

    // ─── GAME LOGIC ────────────────────────────────────────────────
    private spawnNextFruit() {
        if (!this.canDrop) return;

        let maxTier = 0;
        for (const f of this.fruits) {
            if (f.tier >= 0 && f.tier <= 9 && f.tier > maxTier) maxTier = f.tier;
        }
        this.onMaxFruit(maxTier as FruitTier);

        const tier = Math.floor(Math.random() * Math.min(5, maxTier + 1)) as FruitTier;
        const def = FRUIT_DEFS[tier];
        if (!def) return;

        this.onNextFruit(tier);

        const particle = new PIXI.Particle(this.fruitTextures.get(tier)!);
        particle.anchorX = 0.5;
        particle.anchorY = 0.5;

        this.currentFruit = {
            id: this.nextId++,
            x: V_WIDTH / 2,
            y: V_HEIGHT * SPAWN_Y_PERCENT,
            vx: 0, vy: 0,
            radius: def.radius,
            tier,
            particle,
            cooldown: 0,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
        };

        this.fruitPC.addParticle(particle);
    }

    private dropFruit() {
        if (!this.currentFruit) return;
        this.currentFruit.vy = 2;
        this.currentFruit.vx = 0;
        this.fruits.push(this.currentFruit);
        this.canDrop = false;
        this.currentFruit = null;

        if (this.spawnTimeout) clearTimeout(this.spawnTimeout);
        this.spawnTimeout = setTimeout(() => {
            this.canDrop = true;
            this.spawnNextFruit();
        }, GAME_CONFIG.spawnDelay);
    }

    private removeFruit(fruit: FruitBody) {
        const idx = this.fruits.indexOf(fruit);
        if (idx >= 0) this.fruits.splice(idx, 1);
        this.fruitPC.removeParticle(fruit.particle as any);
    }

    private createMergeEffect(x: number, y: number, color: string) {
        const circles = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            circles.push({ x: Math.cos(angle) * 15, y: Math.sin(angle) * 15, r: 6, alpha: 1 });
        }
        this.effects.push({ x, y, color, timer: 0, maxTime: 0.5, circles });
    }

    // ─── PHYSICS ───────────────────────────────────────────────────
    private physicsStep() {
        for (const f of this.fruits) {
            f.vy += GRAVITY;
            f.vx *= FRICTION;
            f.vy *= FRICTION;
            f.x += f.vx;
            f.y += f.vy;

            if (f.cooldown > 0) f.cooldown -= DT;

            // Floor
            if (f.y + f.radius > FLOOR_Y) {
                f.y = FLOOR_Y - f.radius;
                f.vy *= -FLOOR_DAMPING;
                f.vx *= 0.9;
            }

            // Walls
            if (f.x - f.radius < 0) { f.x = f.radius; f.vx *= -WALL_DAMPING; }
            if (f.x + f.radius > V_WIDTH) { f.x = V_WIDTH - f.radius; f.vx *= -WALL_DAMPING; }
        }

        // Collisions
        for (let i = 0; i < this.fruits.length; i++) {
            for (let j = i + 1; j < this.fruits.length; j++) {
                const a = this.fruits[i];
                const b = this.fruits[j];
                if (!a || !b || a.cooldown > 0 || b.cooldown > 0) continue;

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = a.radius + b.radius;

                if (dist < minDist && dist > 0) {
                    if (a.tier === b.tier && a.tier >= 0 && a.tier < 9) {
                        this.mergeFruits(a, b);
                        continue;
                    }

                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    a.x -= nx * overlap * 0.5;
                    a.y -= ny * overlap * 0.5;
                    b.x += nx * overlap * 0.5;
                    b.y += ny * overlap * 0.5;

                    const dvx = a.vx - b.vx;
                    const dvy = a.vy - b.vy;
                    const dvDotN = dvx * nx + dvy * ny;
                    if (dvDotN > 0) {
                        const mA = a.radius * a.radius;
                        const mB = b.radius * b.radius;
                        const total = mA + mB;
                        const impulse = 2 * dvDotN / total;
                        a.vx -= impulse * mB * nx * 0.8;
                        a.vy -= impulse * mB * ny * 0.8;
                        b.vx += impulse * mA * nx * 0.8;
                        b.vy += impulse * mA * ny * 0.8;
                    }
                }
            }
        }
    }

    private mergeFruits(a: FruitBody, b: FruitBody) {
        const nextTier = a.tier + 1;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;

        this.removeFruit(a);
        this.removeFruit(b);

        const def = FRUIT_DEFS[nextTier as FruitTier];
        if (!def) return;

        const points = Math.pow(2, nextTier) * 2;
        this.score += points;
        this.combo++;
        this.onScore(points, this.score);
        this.onCombo(this.combo);

        // Juice
        this.juice = Math.min(this.juiceMax, this.juice + 50);
        this.onJuiceUpdate(this.juice, this.juiceMax);

        // Fever check
        if (this.combo >= 5 && !this.feverActive) {
            this.feverActive = true;
            this.feverTimer = FEVER_DURATION_MS;
            this.onFeverStart(2);
            this.combo = 0;
        }

        const particle = new PIXI.Particle(this.fruitTextures.get(nextTier)!);
        particle.anchorX = 0.5;
        particle.anchorY = 0.5;

        const newFruit: FruitBody = {
            id: this.nextId++,
            x: mx, y: my,
            vx: 0, vy: 0,
            radius: def.radius,
            tier: nextTier,
            particle,
            cooldown: 0.3,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
        };
        this.fruits.push(newFruit);
        this.fruitPC.addParticle(particle);

        this.createMergeEffect(mx, my, def.color);
    }

    // ─── UPDATE LOOP ───────────────────────────────────────────────
    update() {
        if (this.paused) return;

        // Performance tracking
        const now = performance.now();
        this._perfFrames++;
        this._perfFpsAccum += now - (this._perfLastTime || now);
        if (this._perfFpsAccum >= 500) {
            this.perfStats.fps = Math.round((this._perfFrames * 1000) / this._perfFpsAccum);
            this.perfStats.frameTimeMs = Math.round(this._perfFpsAccum / this._perfFrames * 10) / 10;
            this._perfFpsAccum = 0;
            this._perfFrames = 0;
        }
        this._perfLastTime = now;
        this.perfStats.fruitCount = this.fruits.length;

        // Time tracking
        const dtMs = DT * 1000;
        this.timePlayed += dtMs;
        this.timeUpdateAccum += dtMs;
        if (this.timeUpdateAccum >= 250) {
            this.timeUpdateAccum = 0;
            this.onTimeUpdate(this.timePlayed);
        }

        // Fever timer
        if (this.feverActive) {
            this.feverTimer -= dtMs;
            if (this.feverTimer <= 0) {
                this.feverActive = false;
                this.onFeverEnd(this.score);
            }
        }

        // Danger logic
        const dangerY = V_HEIGHT * DANGER_Y_PERCENT;
        let inDanger = false;
        for (const f of this.fruits) {
            if (!f.particle || f.y - f.radius < dangerY) { inDanger = true; break; }
        }
        this.isOverLimit = inDanger;
        if (inDanger) {
            this.dangerAccumulator += dtMs;
            if (this.dangerAccumulator > 3000 && !this.dangerActive) {
                this.dangerActive = true;
                this.dangerTimer = DANGER_TIME_MS;
            }
        } else {
            this.dangerAccumulator = 0;
            this.dangerActive = false;
            this.onDanger(false, 0);
        }
        if (this.dangerActive) {
            this.dangerTimer -= dtMs;
            this.onDanger(true, this.dangerTimer);
            if (this.dangerTimer <= 0) this.gameOver();
        }

        // Physics (substeps)
        for (let s = 0; s < SUBSTEPS; s++) {
            this.physicsStep();
        }

        // Sync fruit positions to particles
        for (const f of this.fruits) {
            f.particle.x = f.x;
            f.particle.y = f.y;
            if (f.scaleX !== 1 || f.scaleY !== 1) {
                f.particle.scaleX = f.scaleX;
                f.particle.scaleY = f.scaleY;
            }
            if (f.alpha !== 1) f.particle.alpha = f.alpha;
        }

        // Update current fruit position
        if (this.currentFruit) {
            this.currentFruit.particle.x = this.currentFruit.x;
            this.currentFruit.particle.y = this.currentFruit.y;
        }

        // Render effects
        this.renderEffects();

        // Update clouds
        this.cloudRenderer?.update(this._screenWidth, this._containerTop);
    }

    private renderEffects() {
        this.effectGraphics.clear();

        for (let i = this.effects.length - 1; i >= 0; i--) {
            const eff = this.effects[i];
            eff.timer += DT;
            const progress = eff.timer / eff.maxTime;

            if (progress >= 1) {
                this.effects.splice(i, 1);
                continue;
            }

            const alpha = 1 - progress;
            const radius = 20 + progress * 40;

            for (const c of eff.circles) {
                const cx = eff.x + c.x * (1 + progress * 2);
                const cy = eff.y + c.y * (1 + progress * 2);
                this.effectGraphics.circle(cx, cy, c.r * (1 - progress * 0.5));
                this.effectGraphics.fill({ color: this.hexColor(eff.color), alpha: alpha * 0.8 });
            }

            // Ring
            this.effectGraphics.circle(eff.x, eff.y, radius);
            this.effectGraphics.stroke({ width: 3 * (1 - progress), color: this.hexColor(eff.color), alpha: alpha * 0.6 });
        }

        // Danger line
        this.effectGraphics.moveTo(0, V_HEIGHT * DANGER_Y_PERCENT);
        this.effectGraphics.lineTo(V_WIDTH, V_HEIGHT * DANGER_Y_PERCENT);
        if (this.isOverLimit) {
            this.effectGraphics.stroke({ width: 4, color: 0xFF4444, alpha: 0.8 });
        } else {
            this.effectGraphics.stroke({ width: 4, color: 0x000000, alpha: 0.2 });
        }
    }

    // ─── GAME CONTROL ──────────────────────────────────────────────
    setPaused(paused: boolean) {
        this.paused = paused;
        if (paused) this.app?.ticker.stop();
        else this.app?.ticker.start();
    }

    gameOver() {
        this.canDrop = false;
        this.app?.ticker.stop();
        this.onGameOver({
            score: this.score,
            bestCombo: this.combo,
            feverCount: 0,
            tomatoUses: 0,
            dangerSaves: 0,
            timePlayed: this.timePlayed,
            maxTier: 0 as FruitTier,
        });
    }

    reset() {
        // Clear fruits
        for (const f of this.fruits) {
            this.fruitPC.removeParticle(f.particle as any);
        }
        this.fruits = [];
        this.effects = [];
        this.effectGraphics.clear();

        // Clear current fruit
        if (this.currentFruit) {
            this.fruitPC.removeParticle(this.currentFruit.particle as any);
            this.currentFruit = null;
        }

        // Reset state
        this.score = 0;
        this.combo = 0;
        this.feverActive = false;
        this.dangerActive = false;
        this.dangerAccumulator = 0;
        this.isOverLimit = false;
        this.timePlayed = 0;
        this.juice = 0;
        this.nextId = 0;
        this.canDrop = true;

        if (this.spawnTimeout) { clearTimeout(this.spawnTimeout); this.spawnTimeout = null; }

        this.onScore(0, 0);
        this.onDanger(false, 0);
        this.onTimeUpdate(0);
        this.onJuiceUpdate(0, this.juiceMax);

        this.setPaused(false);
        this.app?.ticker.start();

        this.spawnNextFruit();
    }

    cleanup() {
        this.destroyed = true;
        if (this.spawnTimeout) clearTimeout(this.spawnTimeout);
        if (this.app) {
            try { this.app.destroy({ removeView: false }); } catch {}
            this.app = null;
        }
    }
}
