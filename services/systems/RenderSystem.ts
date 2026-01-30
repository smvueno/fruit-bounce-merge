import * as PIXI from 'pixi.js';
import { FruitTier } from '../../types';
import { Particle, EffectParticle } from '../../types/GameObjects';
import { FRUIT_DEFS, DANGER_Y_PERCENT } from '../../constants';

export interface RenderContext {
    fruits: Particle[];
    currentFruit: Particle | null;
    feverActive: boolean;
    scaleFactor: number;
}

export class RenderSystem {
    app: PIXI.Application | undefined;
    container: PIXI.Container | undefined;
    fruitSprites: Map<number, PIXI.Container> = new Map();
    textures: Map<FruitTier, PIXI.Texture> = new Map();
    floorGraphics: PIXI.Graphics;
    dangerLine: PIXI.Graphics;

    constructor() {
        this.floorGraphics = new PIXI.Graphics();
        this.dangerLine = new PIXI.Graphics();
    }

    initialize(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;

        container.addChild(this.floorGraphics);
        container.addChild(this.dangerLine);

        this.initTextures();
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

        // Attempt to reset renderer to ensure fresh state
        try {
            // @ts-ignore - reset method might exist on some renderer versions
            if (this.app.renderer.reset) {
                // @ts-ignore
                this.app.renderer.reset();
            }
        } catch (e) {
            console.warn('[RenderSystem] Failed to reset renderer:', e);
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
        this.floorGraphics.clear(); // Will need redraw
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

    getFloorY(x: number, height: number) {
        const baseY = height - 60;
        return baseY + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.04) * 5;
    }

    drawFloor(width: number, height: number, scaleFactor: number, screenHeight: number, containerY: number, screenWidth: number) {
        this.floorGraphics.clear();

        const bottomY = ((screenHeight - containerY) / scaleFactor) + 200;

        // Calculate extended width to cover full screen
        const virtualScreenWidth = screenWidth / scaleFactor;
        const gameCenter = width / 2;
        const startX = gameCenter - (virtualScreenWidth / 2);
        const endX = gameCenter + (virtualScreenWidth / 2);

        const step = 5;
        this.floorGraphics.moveTo(startX, bottomY);
        this.floorGraphics.lineTo(startX, this.getFloorY(startX, height));
        for (let x = startX; x <= endX; x += step) {
            this.floorGraphics.lineTo(x, this.getFloorY(x, height));
        }
        this.floorGraphics.lineTo(endX, this.getFloorY(endX, height));
        this.floorGraphics.lineTo(endX, bottomY);
        this.floorGraphics.closePath();
        this.floorGraphics.fill({ color: 0x76C043 });
        this.floorGraphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 });

        // Decorations - keep relative to game area center
        this.floorGraphics.circle(50, height, 15);
        this.floorGraphics.circle(80, height + 20, 20);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
        this.floorGraphics.circle(width - 100, height, 25);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
    }

    drawDangerLine(width: number, height: number, active: boolean) {
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
