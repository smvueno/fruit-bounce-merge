import * as PIXI from 'pixi.js';
import { FruitTier } from '../../types';
import { Particle } from '../../types/GameObjects';
import { FRUIT_DEFS, DANGER_Y_PERCENT } from '../../constants';
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
    // Optimized: Direct Sprites, no Container wrappers, no Graphics faces
    fruitSprites: Map<number, PIXI.Sprite> = new Map();
    // Texture maps: normal and blink versions
    normalTextures: Map<FruitTier, PIXI.Texture> = new Map();
    blinkTextures: Map<FruitTier, PIXI.Texture> = new Map();
    dangerLine: PIXI.Graphics;
    private _lastDangerActive: boolean | null = null;
    private _lastFeverActive: boolean | null = null;

    // Pixi renderers (replacing separate 2D canvases)
    private effectRenderer: EffectRenderer | null = null;

    constructor() {
        this.dangerLine = new PIXI.Graphics();
    }

    initialize(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;
        this.effectRenderer = new EffectRenderer(container);
        container.addChild(this.dangerLine);
        this.initTextures();
    }

    updateEnvironment(_sw: number, _sh: number, _vw: number, _vh: number, _sf: number): void {}

    // --- Texture Generation: Bake body + face into single texture per fruit ---

    generateAllTextures(): { normal: Map<FruitTier, PIXI.Texture>; blink: Map<FruitTier, PIXI.Texture> } {
        const normalMap = new Map<FruitTier, PIXI.Texture>();
        const blinkMap = new Map<FruitTier, PIXI.Texture>();
        if (!this.app || !this.app.renderer) return { normal: normalMap, blink: blinkMap };

        // @ts-ignore
        const gl = this.app.renderer.gl || (this.app.renderer.context && this.app.renderer.context.gl);
        if (gl && gl.isContextLost && gl.isContextLost()) return { normal: normalMap, blink: blinkMap };

        // Generate textures using generateTexture() — same approach as clouds for crisp vector rendering
        // generateTexture() auto-fits bounds, so the fruit is centered and rendered at 4x resolution
        for (const def of Object.values(FRUIT_DEFS)) {
            try {
                // Normal: body + face with open eyes
                const normC = new PIXI.Container();
                def.renderPixiBody(normC, def.radius);
                const normFace = this.createFace(def.tier, def.radius);
                normC.addChild(normFace);
                const normTex = this.app.renderer.generateTexture({
                    target: normC,
                    resolution: 4,
                    antialias: true,
                });
                normalMap.set(def.tier, normTex);
                normC.destroy({ children: true });

                // Blink: body + face with closed eyes
                const blinkC = new PIXI.Container();
                def.renderPixiBody(blinkC, def.radius);
                const blinkFace = this.createFace(def.tier, def.radius, true);
                blinkC.addChild(blinkFace);
                const blinkTex = this.app.renderer.generateTexture({
                    target: blinkC,
                    resolution: 4,
                    antialias: true,
                });
                blinkMap.set(def.tier, blinkTex);
                blinkC.destroy({ children: true });
            } catch (e) {
                console.error(`[RenderSystem] Failed to generate texture for tier ${def.tier}:`, e);
            }
        }
        return { normal: normalMap, blink: blinkMap };
    }

    initTextures() {
        const { normal, blink } = this.generateAllTextures();
        normal.forEach((v, k) => this.normalTextures.set(k, v));
        blink.forEach((v, k) => this.blinkTextures.set(k, v));
    }

    // --- Face creation for texture baking ---

    createFace(tier: FruitTier, radius: number, blink = false): PIXI.Container {
        const def = FRUIT_DEFS[tier];
        if (def && def.renderPixiFace) {
            return def.renderPixiFace(radius, blink);
        }
        return new PIXI.Container();
    }

    // --- Sprite management ---

    createSprite(p: Particle) {
        if (!this.container || !this.normalTextures.has(p.tier)) return;
        const tex = this.normalTextures.get(p.tier)!;
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.x = p.x;
        sprite.y = p.y;
        sprite.rotation = p.rotation;
        sprite.alpha = p.alpha;
        sprite.scale.set(p.scaleX, p.scaleY);
        this.fruitSprites.set(p.id, sprite);
        this.container.addChild(sprite);
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
        this._lastDangerActive = null;
        this._lastFeverActive = null;
        this.dangerLine.clear();
    }

    refreshGraphics(): boolean {
        try {
            console.log('[RenderSystem] Refreshing graphics...');
            const { normal, blink } = this.generateAllTextures();

            if (normal.size > 0) {
                this.normalTextures.forEach(tex => { if (tex.destroy) tex.destroy(true); });
                this.blinkTextures.forEach(tex => { if (tex.destroy) tex.destroy(true); });
                this.normalTextures.clear();
                this.blinkTextures.clear();
                normal.forEach((v, k) => this.normalTextures.set(k, v));
                blink.forEach((v, k) => this.blinkTextures.set(k, v));
                this.reset();
                console.log(`[RenderSystem] Graphics refreshed. Textures count: ${this.normalTextures.size}`);
                return true;
            } else {
                console.error('[RenderSystem] Failed to regenerate textures.');
                return false;
            }
        } catch (e) {
            console.error('[RenderSystem] Error refreshing graphics:', e);
            return false;
        }
    }

    // --- Rendering Logic ---

    drawDangerLine(width: number, height: number, active: boolean) {
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
            // Use performance.now() instead of Date.now() — higher resolution, monotonic
            const time = performance.now();
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
                // Swap to blink texture if needed
                const tex = ctx.currentFruit.isBlinking
                    ? this.blinkTextures.get(ctx.currentFruit.tier)
                    : this.normalTextures.get(ctx.currentFruit.tier);
                if (tex && sprite.texture !== tex) sprite.texture = tex;
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
                sprite.scale.set(p.scaleX * rhythmicScaleX, p.scaleY * rhythmicScaleY);

                // Swap texture for blinking (no per-frame face updates needed)
                const targetTex = p.isBlinking
                    ? this.blinkTextures.get(p.tier)
                    : this.normalTextures.get(p.tier);
                if (targetTex && sprite.texture !== targetTex) sprite.texture = targetTex;
            }
        }

        // Render effect particles
        if (this.effectRenderer && ctx.effectParticles) {
            this.effectRenderer.render(ctx.effectParticles);
        }
    }

}
