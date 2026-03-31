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
    // Optimization: Cache face+eyes refs to avoid getChildByLabel() scan every frame
    faceRefs: Map<number, { face: PIXI.Container; eyes: PIXI.DisplayObject | null }> = new Map();
    textures: Map<FruitTier, PIXI.Texture> = new Map();
    floorGraphics: PIXI.Graphics;
    wallGraphics: PIXI.Graphics;
    dangerLine: PIXI.Graphics;
    // Optimization: Only redraw danger line when active state changes
    private _lastDangerActive: boolean | null = null;

    constructor() {
        this.floorGraphics = new PIXI.Graphics();
        this.wallGraphics = new PIXI.Graphics();
        this.dangerLine = new PIXI.Graphics();
    }

    initialize(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;

        container.addChild(this.wallGraphics);
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

        // Renderer reset block removed (Unsafe/Dead Code)

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

        // Optimization: Cache face+eyes refs so renderSync() avoids getChildByLabel() every frame
        const eyes = face.getChildByLabel ? face.getChildByLabel("eyes") : null;
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
        this._lastDangerActive = null; // Force danger line redraw after reset
        // floor graphics persist
        // wall graphics persist
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
    drawWalls(width: number, height: number, scaleFactor: number) {
        this.wallGraphics.clear();

        // Wall dimensions
        const wallWidth = 80;

        const topMargin = -2000; // extend far up
        const bottomEdge = 2000; // extend far down

        // Draw grass wall function translated to PixiJS Graphics API
        const drawGrassWall = (x: number, y: number, wallHeight: number, side: 'left' | 'right', logicWallWidth: number) => {
            const isRight = side === 'right';

            // X returns the mirrored x coordinate correctly based on the visual width
            // This ensures that the left and right walls are identical, just flipped.
            const X = (px: number) => {
                // px is [0, 80] visually
                // we scale it to [0, logicWallWidth]
                const scaledPx = px * (logicWallWidth / wallWidth);
                return isRight ? x + logicWallWidth - scaledPx : x + scaledPx;
            };

            // Draw Main Wall Body
            this.wallGraphics.moveTo(X(10), y + 35);
            this.wallGraphics.lineTo(X(10), y + wallHeight - 10);
            this.wallGraphics.quadraticCurveTo(X(10), y + wallHeight, X(20), y + wallHeight);
            this.wallGraphics.lineTo(X(60), y + wallHeight);
            this.wallGraphics.quadraticCurveTo(X(70), y + wallHeight, X(70), y + wallHeight - 10);
            this.wallGraphics.lineTo(X(70), y + 35);
            this.wallGraphics.closePath();

            this.wallGraphics.fill({ color: 0x4CAF50 });
            this.wallGraphics.stroke({ width: 2.5, color: 0x1f6b23, alignment: 0 });

            // Shadow under Grass Cap
            this.wallGraphics.moveTo(X(10), y + 35);
            this.wallGraphics.lineTo(X(70), y + 35);
            this.wallGraphics.lineTo(X(70), y + 50);
            this.wallGraphics.quadraticCurveTo(X(50), y + 55, X(40), y + 50);
            this.wallGraphics.quadraticCurveTo(X(30), y + 55, X(10), y + 50);
            this.wallGraphics.closePath();
            this.wallGraphics.fill({ color: 0x2E7D32, alpha: 0.4 });

            // Grass Cap (Complex Bezier)
            this.wallGraphics.moveTo(X(5), y + 35);
            this.wallGraphics.bezierCurveTo(X(2), y + 25, X(8), y + 18, X(15), y + 22);
            this.wallGraphics.bezierCurveTo(X(18), y + 12, X(28), y + 8, X(35), y + 18);
            this.wallGraphics.bezierCurveTo(X(40), y + 5, X(52), y + 5, X(58), y + 18);
            this.wallGraphics.bezierCurveTo(X(65), y + 10, X(78), y + 15, X(75), y + 35);
            this.wallGraphics.quadraticCurveTo(X(65), y + 42, X(55), y + 38);
            this.wallGraphics.quadraticCurveTo(X(45), y + 45, X(35), y + 38);
            this.wallGraphics.quadraticCurveTo(X(25), y + 42, X(15), y + 38);
            this.wallGraphics.quadraticCurveTo(X(8), y + 40, X(5), y + 35);
            this.wallGraphics.closePath();

            this.wallGraphics.fill({ color: 0x8BC34A });
            this.wallGraphics.stroke({ width: 2.5, color: 0x1f6b23, alignment: 0 });

            // Decorative Tufts
            const tufts = [
                // Left Column
                { bx: 20, by: 95, cp1x: 22, cp1y: 85, cp2x: 26, cp2y: 85, ex: 28, ey: 95 },
                { bx: 15, by: 200, cp1x: 17, cp1y: 190, cp2x: 21, cp2y: 190, ex: 23, ey: 200 },
                { bx: 22, by: 340, cp1x: 24, cp1y: 330, cp2x: 28, cp2y: 330, ex: 30, ey: 340 },
                { bx: 16, by: 470, cp1x: 18, cp1y: 460, cp2x: 22, cp2y: 460, ex: 24, ey: 470 },
                // Right Column
                { bx: 45, by: 120, cp1x: 47, cp1y: 110, cp2x: 51, cp2y: 110, ex: 53, ey: 120 },
                { bx: 55, by: 230, cp1x: 57, cp1y: 220, cp2x: 61, cp2y: 220, ex: 63, ey: 230 },
                { bx: 42, by: 360, cp1x: 44, cp1y: 350, cp2x: 48, cp2y: 350, ex: 50, ey: 360 },
                { bx: 58, by: 490, cp1x: 60, cp1y: 480, cp2x: 64, cp2y: 480, ex: 66, ey: 490 }
            ];

            tufts.forEach(tuft => {
                for (let ty = y; ty < y + wallHeight; ty += 500) {
                    if (ty + tuft.by < y + wallHeight) {
                        this.wallGraphics.moveTo(X(tuft.bx), ty + tuft.by);
                        this.wallGraphics.bezierCurveTo(
                            X(tuft.cp1x), ty + tuft.cp1y,
                            X(tuft.cp2x), ty + tuft.cp2y,
                            X(tuft.ex), ty + tuft.ey
                        );
                        this.wallGraphics.stroke({ width: 2.5, color: 0x1f6b23, alpha: 0.6, alignment: 0 });
                    }
                }
            });
        };

        const overlap = 12 / scaleFactor;
        const logicWallWidth = wallWidth / scaleFactor;

        // Logical coordinates of the left and right borders of the game area
        // Before we were doing `-wallWidth` which wasn't scaled, so it was too small.
        // It needs to be `-logicWallWidth`.
        const leftWallX = -logicWallWidth + overlap;
        const rightWallX = width - overlap;

        const totalHeight = bottomEdge - topMargin;

        drawGrassWall(leftWallX, topMargin, totalHeight, 'left', logicWallWidth);
        drawGrassWall(rightWallX, topMargin, totalHeight, 'right', logicWallWidth);
    }



    drawFloor(width: number, height: number, scaleFactor: number) {
        this.floorGraphics.clear();

        // The game physics operates in a V_WIDTH x V_HEIGHT (600x750) logical space.
        // We draw the floor inside the scaled container so it aligns perfectly with the physics engine.

        // We want the floor to stretch far to the left and right to cover the whole screen,
        // regardless of the aspect ratio. So we'll use large static logical bounds.
        const startX = -2000;
        const endX = 2600; // 600 + 2000
        const bottomY = 2000; // Stretch far down
        const step = 5;

        // 1. Fill the ground
        this.floorGraphics.moveTo(startX, bottomY);
        this.floorGraphics.lineTo(startX, this.getFloorY(startX, height));
        for (let x = startX; x <= endX; x += step) {
            this.floorGraphics.lineTo(x, this.getFloorY(x, height));
        }
        this.floorGraphics.lineTo(endX, this.getFloorY(endX, height));
        this.floorGraphics.lineTo(endX, bottomY);
        this.floorGraphics.closePath();
        this.floorGraphics.fill({ color: 0x76C043 });

        // 2. Stroke only the top edge
        this.floorGraphics.moveTo(startX, this.getFloorY(startX, height));
        for (let x = startX; x <= endX; x += step) {
            this.floorGraphics.lineTo(x, this.getFloorY(x, height));
        }
        this.floorGraphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 });

        // Decorations - keep relative to game area center
        this.floorGraphics.circle(50, height, 15);
        this.floorGraphics.circle(80, height + 20, 20);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
        this.floorGraphics.circle(width - 100, height, 25);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
    }



    drawDangerLine(width: number, height: number, active: boolean) {
        // Optimization: Skip redraw if state hasn't changed — PIXI.Graphics clear+draw is not free
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

                // Optimization: Use cached face/eyes refs — avoids getChildByLabel() O(N) scan per fruit per frame
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
    }

}
