import * as PIXI from 'pixi.js';
import { FruitTier } from '../../types';
import { Particle } from '../../types/GameObjects';
import { FRUIT_DEFS, DANGER_Y_PERCENT } from '../../constants';
import { GroundRenderer } from '../renderers/GroundRenderer';
import { WallRenderer } from '../renderers/WallRenderer';
import { EffectRenderer } from '../renderers/EffectRenderer';
import { EffectParticle } from '../../types/GameObjects';

export interface RenderContext {
    fruits: Particle[];
    currentFruit: Particle | null;
    feverActive: boolean;
    scaleFactor: number;
    effectParticles?: EffectParticle[];
}

export class RenderSystem {
    app: PIXI.Application | undefined;
    container: PIXI.Container | undefined;
    fruitSprites: Map<number, PIXI.Container> = new Map();
    faceRefs: Map<number, { face: PIXI.Container; eyes: PIXI.Container | null }> = new Map();
    textures: Map<FruitTier, PIXI.Texture> = new Map();
    dangerLine: PIXI.Graphics;
    private _lastDangerActive: boolean | null = null;

    // Pixi renderers (replacing separate 2D canvases)
    private groundRenderer: GroundRenderer | null = null;
    private wallRenderer: WallRenderer | null = null;
    private effectRenderer: EffectRenderer | null = null;

    // Screen dimensions for ground/wall rendering
    private _screenWidth = 0;
    private _screenHeight = 0;

    constructor() {
        this.dangerLine = new PIXI.Graphics();
    }

    initialize(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;

        // Initialize new Pixi-based renderers
        this.groundRenderer = new GroundRenderer(container);
        this.wallRenderer = new WallRenderer(container);
        this.effectRenderer = new EffectRenderer(container);

        container.addChild(this.dangerLine);

        this.initTextures();
    }

    /**
     * Called when screen dimensions change (from GameEngine.handleResize).
     */
    updateEnvironment(screenWidth: number, screenHeight: number, vWidth: number, vHeight: number, scaleFactor: number): void {
        this._screenWidth = screenWidth;
        this._screenHeight = screenHeight;

        // Redraw ground and walls with new dimensions
        if (this.groundRenderer) {
            this.groundRenderer.draw(vWidth, vHeight, screenWidth, scaleFactor, 0);
        }
        if (this.wallRenderer) {
            this.wallRenderer.draw(vHeight, scaleFactor, vWidth);
        }
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
                console.error(`[RenderSystem] Failed to generate texture for tier ${def.tier}:`, e);
            }
        });
        return map;
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
        if (!this.container || !this.textures.has(p.tier)) return;
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

        // Cache face+eyes refs
        const eyes = face.getChildByLabel ? (face.getChildByLabel("eyes") as PIXI.Container) : null;
        this.faceRefs.set(p.id, { face, eyes });
    }

    removeSprite(p: Particle) {
        const sprite = this.fruitSprites.get(p.id);
        if (sprite) {
            if (sprite.parent) sprite.parent.removeChild(sprite);
            sprite.destroy();
            this.fruitSprites.delete(p.id);
            this.faceRefs.delete(p.id);
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
        this.faceRefs.clear();
        this._lastDangerActive = null;
        this.dangerLine.clear();
    }

    refreshGraphics(): boolean {
        try {
            console.log('[RenderSystem] Refreshing graphics...');
            const newTextures = this.generateAllTextures();

            if (newTextures.size > 0) {
                this.textures.forEach(tex => {
                    if (tex.destroy) tex.destroy(true);
                });
                this.textures.clear();

                newTextures.forEach((v, k) => this.textures.set(k, v));

                this.reset();

                // Redraw environment
                if (this.app && this.container) {
                    this.updateEnvironment(
                        this._screenWidth, this._screenHeight,
                        600, 750,
                        this.container.scale.x
                    );
                }

                console.log(`[RenderSystem] Graphics refreshed. Textures count: ${this.textures.size}`);
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

    // --- Rendering Logic ---

    drawDangerLine(width: number, height: number, active: boolean) {
        // Optimization: Skip redraw if state hasn't changed
        if (this._lastDangerActive === active) return;
        this._lastDangerActive = active;

        this.dangerLine.clear();
        const y = height * DANGER_Y_PERCENT;
        this.dangerLine.moveTo(0, y);
        this.dangerLine.lineTo(width, y);
        if (active) {
            this.dangerLine.stroke({ width: 4, color: 0xFF4444, alpha: 0.8 });
        } else {
            this.dangerLine.stroke({ width: 4, color: 0x000000, alpha: 0.2 });
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

                // Use cached face/eyes refs
                const refs = this.faceRefs.get(p.id);
                if (refs) {
                    const { face, eyes } = refs;
                    if (eyes) {
                        eyes.scale.y = p.isBlinking ? 0.1 : 1;
                    }
                    const lookX = Math.min(10, Math.max(-10, p.vx));
                    const lookY = Math.min(10, Math.max(-10, p.vy));
                    face.position.set(lookX * 0.5, lookY * 0.5);
                }
            }
        }

        // Render effect particles (merge bursts, stars, suck particles, bomb ghosts)
        if (this.effectRenderer && ctx.effectParticles) {
            this.effectRenderer.render(ctx.effectParticles);
        }
    }

}
