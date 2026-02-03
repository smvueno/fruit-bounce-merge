import * as PIXI from 'pixi.js';
import { FruitTier } from '../../types';
import { Particle, EffectParticle } from '../../types/GameObjects';
import { FRUIT_DEFS, DANGER_Y_PERCENT } from '../../constants';
import { GroundRenderer } from './renderers/GroundRenderer';
import { WallRenderer } from './renderers/WallRenderer';
import { EffectRenderer } from './renderers/EffectRenderer';
import { FloatingTextRenderer } from './renderers/FloatingTextRenderer';
import { HUDRenderer } from './renderers/HUDRenderer';
import { OverlayRenderer } from './renderers/OverlayRenderer';

export interface RenderContext {
    fruits: Particle[];
    currentFruit: Particle | null;
    feverActive: boolean;
    scaleFactor: number;
    effectParticles?: EffectParticle[];
    dt: number;
    // HUD Data
    score: number;
    playTime: number;
    maxTier: FruitTier;
    nextFruit: FruitTier;
    savedFruit: FruitTier | null;
    // Overlay Data
    juice: number;
    dangerActive: boolean;
}

export class RenderSystem {
    app: PIXI.Application | undefined;
    rootContainer: PIXI.Container | undefined;
    gameContainer: PIXI.Container | undefined;
    backgroundContainer: PIXI.Container | undefined;
    effectContainer: PIXI.Container | undefined;
    floatingTextContainer: PIXI.Container | undefined; // NEW

    fruitSprites: Map<number, PIXI.Container> = new Map();
    textures: Map<FruitTier, PIXI.Texture> = new Map();
    effectTextures: Record<string, PIXI.Texture> = {};

    // Renderers
    groundRenderer: GroundRenderer | undefined;
    wallRenderer: WallRenderer | undefined;
    effectRenderer: EffectRenderer | undefined;
    floatingTextRenderer: FloatingTextRenderer | undefined;
    hudRenderer: HUDRenderer | undefined;
    overlayRenderer: OverlayRenderer | undefined;

    constructor() {
    }

    initialize(
        app: PIXI.Application,
        root: PIXI.Container,
        gameContainer: PIXI.Container,
        backgroundContainer: PIXI.Container,
        effectContainer: PIXI.Container,
        onSwap: () => void
    ) {
        this.app = app;
        this.rootContainer = root;
        this.gameContainer = gameContainer;
        this.backgroundContainer = backgroundContainer;
        this.effectContainer = effectContainer;

        this.initTextures();

        // Initialize Sub-Renderers
        // Order matters: Ground (0), Walls (1) inside backgroundContainer
        this.groundRenderer = new GroundRenderer(backgroundContainer);
        this.wallRenderer = new WallRenderer(backgroundContainer);
        this.effectRenderer = new EffectRenderer(effectContainer, this.effectTextures);

        // Overlay Renderer (Layer 5 - Below Fruits)
        // Juice/wave should be behind fruits but above background
        // Layer order: background(0) < overlay(5) < fruits(10) < effects(20) < text(30) < UI(40)
        const overlayContainer = new PIXI.Container();
        overlayContainer.zIndex = 5; // Behind Game (10), above Background (0)
        this.rootContainer.addChild(overlayContainer);

        this.overlayRenderer = new OverlayRenderer(app, overlayContainer);

        // Initialize Text Renderer (Layer 30 - Above Overlays)
        this.floatingTextContainer = new PIXI.Container();
        this.floatingTextContainer.label = 'floating_text';
        this.floatingTextContainer.zIndex = 30;
        this.rootContainer.addChild(this.floatingTextContainer);

        this.floatingTextRenderer = new FloatingTextRenderer(this.floatingTextContainer);

        // Initialize UI Container (Layer 40 - Topmost)
        const uiContainer = new PIXI.Container();
        uiContainer.label = 'ui_container';
        uiContainer.zIndex = 40;
        this.rootContainer.addChild(uiContainer);

        // Initialize HUD Renderer
        this.hudRenderer = new HUDRenderer(uiContainer, this.textures, onSwap);
    }

    generateAllTextures(): Map<FruitTier, PIXI.Texture> {
        const map = new Map<FruitTier, PIXI.Texture>();
        if (!this.app || !this.app.renderer) {
            console.warn('[RenderSystem] app or renderer is missing!');
            return map;
        }

        // Context Loss Check
        // @ts-ignore - accessing internal gl context
        const gl = this.app.renderer.gl || (this.app.renderer.context && this.app.renderer.context.gl);
        if (gl && gl.isContextLost && gl.isContextLost()) {
            console.warn('[RenderSystem] Cannot generate textures: WebGL Context is lost.');
            return map;
        }

        // Fruit Textures
        Object.values(FRUIT_DEFS).forEach(def => {
            try {
                const container = new PIXI.Container();
                def.renderPixiBody(container, def.radius);

                const size = (def.radius * 2) + 20;
                const texture = PIXI.RenderTexture.create({
                    width: size,
                    height: size,
                    resolution: this.app!.renderer.resolution || 2
                });

                container.position.set(size / 2, size / 2);
                this.app!.renderer.render({ container, target: texture });

                map.set(def.tier, texture);
                container.destroy({ children: true });
            } catch (e) {
                console.error(`[RenderSystem] Failed to generate texture for tier ${def.tier}: `, e);
            }
        });

        // Effect Textures
        this.generateEffectTextures();

        return map;
    }

    generateEffectTextures() {
        if (!this.app || !this.app.renderer) return;

        const createTexture = (draw: (g: PIXI.Graphics) => void, width: number, height: number): PIXI.Texture => {
            const g = new PIXI.Graphics();
            draw(g);
            const texture = PIXI.RenderTexture.create({ width, height, resolution: this.app!.renderer.resolution || 2 });
            // Center graphics in texture
            g.position.set(width / 2, height / 2);
            this.app!.renderer.render({ container: g, target: texture });
            return texture;
        };

        // 1. Circle/Glow (White filled circle, used for particles and tinting)
        this.effectTextures['circle'] = createTexture((g) => {
            g.circle(0, 0, 32);
            g.fill({ color: 0xFFFFFF });
        }, 64, 64);

        // 2. Star
        this.effectTextures['star'] = createTexture((g) => {
            g.star(0, 0, 5, 32, 14); // 5 points, outer 32, inner 14
            g.fill({ color: 0xFFFFFF });
        }, 64, 64);

        // Update renderer if it exists
        if (this.effectRenderer) {
            this.effectRenderer.textures = this.effectTextures;
        }
    }

    initTextures() {
        const newTextures = this.generateAllTextures();
        newTextures.forEach((v, k) => this.textures.set(k, v));
    }

    createFace(tier: FruitTier, radius: number): PIXI.Container {
        const def = FRUIT_DEFS[tier];
        if (def && def.renderPixiFace) {
            return def.renderPixiFace(radius);
        }
        return new PIXI.Container();
    }

    createSprite(p: Particle) {
        if (!this.gameContainer || !this.textures.has(p.tier)) return;
        const tex = this.textures.get(p.tier)!;
        const sprite = new PIXI.Container();
        const body = new PIXI.Sprite(tex);
        body.anchor.set(0.5);
        sprite.addChild(body);
        const face = this.createFace(p.tier, p.radius);
        face.label = "face";
        sprite.addChild(face);
        this.fruitSprites.set(p.id, sprite);
        this.gameContainer.addChild(sprite);
    }

    removeSprite(p: Particle) {
        const sprite = this.fruitSprites.get(p.id);
        if (sprite) {
            if (sprite.parent) sprite.parent.removeChild(sprite);
            sprite.destroy();
            this.fruitSprites.delete(p.id);
        }
    }

    reset() {
        this.fruitSprites.forEach((sprite) => {
            if (sprite && sprite.parent) {
                sprite.parent.removeChild(sprite);
                sprite.destroy({ children: true });
            }
        });
        this.fruitSprites.clear();
        // groundRenderer handles its own clear/draw via resize
    }

    refreshGraphics(): boolean {
        try {
            console.log('[RenderSystem] Refreshing graphics...');
            const newTextures = this.generateAllTextures();

            if (newTextures.size > 0) {
                // 1. Destroy all current textures to free GPU memory
                this.textures.forEach(tex => {
                    if (tex.destroy) tex.destroy(true);
                });
                this.textures.clear();

                // 2. Swap in new textures
                newTextures.forEach((v, k) => this.textures.set(k, v));

                // 3. Reset sprites (re-create them with new textures)
                this.reset();

                console.log(`[RenderSystem] Graphics refreshed.Textures count: ${this.textures.size} `);
                return true;
            } else {
                console.error('[RenderSystem] Failed to regenerate textures. Keeping old textures.');
                return false;
            }
        } catch (e) {
            console.error('[RenderSystem] Error refreshing graphics:', e);
            return false;
        }
    }

    resize(width: number, height: number, scaleFactor: number, screenWidth: number, screenHeight: number, containerY: number, containerX: number) {
        // Common Layout Calculations
        const gameWidthScreen = width * scaleFactor;
        // const containerLeft = (screenWidth - gameWidthScreen) / 2; // OLD Centered Logic
        const containerLeft = containerX; // NEW Explicit Logic

        if (this.groundRenderer) {
            this.groundRenderer.draw(width, height, scaleFactor, screenHeight, containerY, containerLeft, screenWidth);
        }
        if (this.wallRenderer) {
            this.wallRenderer.draw(gameWidthScreen, height * scaleFactor, containerY, containerLeft, screenWidth, screenHeight);
        }

        // Sync EffectContainer to match GameContainer
        if (this.effectContainer) {
            this.effectContainer.scale.set(scaleFactor);
            this.effectContainer.position.set(containerLeft, containerY);
        }

        // Sync FloatingTextContainer
        if (this.floatingTextContainer) {
            this.floatingTextContainer.scale.set(scaleFactor);
            this.floatingTextContainer.position.set(containerLeft, containerY);
        }

        // Sync OverlayContainer (Juice/Danger)
        if (this.overlayRenderer && this.overlayRenderer.container) {
            this.overlayRenderer.container.scale.set(scaleFactor);
            this.overlayRenderer.container.position.set(containerLeft, containerY);
        }

        // Resize HUD (Screen Space, but aligned to Game Container)
        // User Requirement: "Restriction inside safe area"
        if (this.hudRenderer) {
            // Logic: Scale UI to match game scale
            this.hudRenderer.container.scale.set(scaleFactor);

            // Position at Top-Left of GAME CONTAINER (Safe Area)
            // This ensures HUD elements stay within the V_WIDTH x V_HEIGHT box.
            this.hudRenderer.container.position.set(containerLeft, containerY);

            // Pass VIRTUAL Dimensions (V_WIDTH, V_HEIGHT) so layout logic works on 600x750 basis
            this.hudRenderer.resize(width, height, scaleFactor, screenWidth, screenHeight);
        }
    }

    // --- Rendering Logic ---

    spawnFloatingText(x: number, y: number, points: number, tier: FruitTier) {
        if (this.floatingTextRenderer) {
            this.floatingTextRenderer.spawn(x, y, points, tier);
        }
    }

    renderSync(ctx: RenderContext) {
        let rhythmicScaleX = 1;
        let rhythmicScaleY = 1;
        if (ctx.feverActive) {
            const time = Date.now();
            const pulse = Math.sin((time / 250) * Math.PI) * 0.05;
            rhythmicScaleX = 1 + pulse;
            rhythmicScaleY = 1 - pulse;
        }

        if (this.effectRenderer && ctx.effectParticles) {
            this.effectRenderer.render(ctx.effectParticles);
        }

        if (this.hudRenderer) {
            this.hudRenderer.update(
                ctx.dt,
                ctx.score,
                ctx.playTime,
                ctx.maxTier,
                ctx.nextFruit,
                ctx.savedFruit
            );
        }

        // Overlays
        if (this.overlayRenderer) {
            // We need Width/Height. Assume V_WIDTH/V_HEIGHT or screen?
            // Since Juice is tied to Game Area, we should pass Game Dimensions.
            // But RenderSystem doesn't easily store them except in resize.
            // We can use 600/750 consts or derived.
            const w = 600;
            const h = 750;
            this.overlayRenderer.update(ctx.dt, ctx.juice, ctx.feverActive, ctx.dangerActive, w, h);
        }

        if (this.floatingTextRenderer) {
            this.floatingTextRenderer.update(ctx.dt);
        }

        // Current Fruit
        if (ctx.currentFruit) {
            const sprite = this.fruitSprites.get(ctx.currentFruit.id);
            if (sprite) {
                sprite.x = ctx.currentFruit.x;
                sprite.y = ctx.currentFruit.y;
                sprite.rotation = ctx.currentFruit.rotation;
            }
        }

        // All Fruits
        for (const p of ctx.fruits) {
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
}
