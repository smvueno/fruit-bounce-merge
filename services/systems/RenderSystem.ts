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
    floorSprite: PIXI.Sprite;
    // Clouds
    cloudSprites: PIXI.Sprite[] = [];
    cloudTexture: PIXI.RenderTexture | null = null;
    cloudData: { yPercent: number, scale: number, opacity: number, duration: number, delay: number, currentX: number }[] = [];
    leftWallSprite: PIXI.Sprite;
    rightWallSprite: PIXI.Sprite;
    wallTexture: PIXI.Texture | null = null;
    floorTexture: PIXI.Texture | null = null;
    dangerLine: PIXI.Graphics;
    // Optimization: Only redraw danger line when active state changes
    private _lastDangerActive: boolean | null = null;

    constructor() {
        this.floorSprite = new PIXI.Sprite();
        this.leftWallSprite = new PIXI.Sprite();
        this.cloudSprites = [];
        this.cloudData = [
            { yPercent: 0.75, scale: 0.5, opacity: 0.3, duration: 30, delay: 0, currentX: 0 },
            { yPercent: 0.60, scale: 0.7, opacity: 0.4, duration: 25, delay: 5, currentX: 0 },
            { yPercent: 0.35, scale: 0.9, opacity: 0.5, duration: 20, delay: 2, currentX: 0 },
            { yPercent: 0.10, scale: 1.2, opacity: 0.6, duration: 15, delay: 0, currentX: 0 },
            { yPercent: 0.05, scale: 1.3, opacity: 0.55, duration: 12, delay: 8, currentX: 0 },
        ];
        for (let i = 0; i < this.cloudData.length; i++) {
            const sprite = new PIXI.Sprite();
            this.cloudSprites.push(sprite);
            // moved to initialize
        }
        this.rightWallSprite = new PIXI.Sprite();
        this.dangerLine = new PIXI.Graphics();
    }

    initialize(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;

        for (const sprite of this.cloudSprites) {
            container.addChild(sprite); // Add clouds behind everything else in the container
        }
        container.addChild(this.leftWallSprite);
        container.addChild(this.rightWallSprite);
        container.addChild(this.floorSprite);
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


        if (!this.app || !this.app.renderer) return;

        // Context Loss Check
        // @ts-ignore - accessing internal gl context
        const glContext = this.app.renderer.gl || this.app.renderer.context?.gl;
        if (glContext && glContext.isContextLost()) return;


        const overlap = 12 / scaleFactor;
        const wallWidth = 80;
        const logicWallWidth = wallWidth / scaleFactor;

        // Create texture if it doesn't exist
        if (!this.wallTexture) {
            const g = new PIXI.Graphics();

            // Draw a basic repeating wall tile
            g.rect(0, 0, wallWidth, 500);
            g.fill({ color: 0x4CAF50 });
            g.stroke({ width: 2.5, color: 0x1f6b23 });

            // Grass cap
            g.rect(0, 0, wallWidth, 40);
            g.fill({ color: 0x8BC34A });
            g.stroke({ width: 2.5, color: 0x1f6b23 });

            // Shadow
            g.rect(0, 40, wallWidth, 10);
            g.fill({ color: 0x2E7D32, alpha: 0.4 });

            const texSize = { width: wallWidth, height: 500 };
            const renderTexture = PIXI.RenderTexture.create({
                width: texSize.width,
                height: texSize.height,
                resolution: this.app.renderer.resolution || 2
            });

            this.app.renderer.render({ container: g, target: renderTexture });
            g.destroy();
            this.wallTexture = renderTexture;

            this.leftWallSprite.texture = this.wallTexture;
            this.rightWallSprite.texture = this.wallTexture;
        }

        const topMargin = -2000;
        const totalHeight = 4000;

        // Configure Left Wall
        this.leftWallSprite.x = -logicWallWidth + overlap;
        this.leftWallSprite.y = topMargin;
        this.leftWallSprite.width = logicWallWidth;
        this.leftWallSprite.height = totalHeight;

        // Configure Right Wall
        this.rightWallSprite.x = width - overlap;
        this.rightWallSprite.y = topMargin;
        this.rightWallSprite.width = logicWallWidth;
        this.rightWallSprite.height = totalHeight;

        // Mirror the right wall texture visually if desired, but here we just adjust position
        // so it looks like a wall on the right.
        this.rightWallSprite.scale.x = -Math.abs(this.rightWallSprite.scale.x);
        this.rightWallSprite.x += logicWallWidth;
    }

    drawClouds(width: number, height: number, scaleFactor: number, time: number) {
try {


        if (!this.app || !this.app.renderer) return;

        // Context Loss Check
        // @ts-ignore - accessing internal gl context
        const glContext = this.app.renderer.gl || this.app.renderer.context?.gl;
        if (glContext && glContext.isContextLost()) return;


        if (!this.cloudTexture) {
            const g = new PIXI.Graphics();
            g.fill({ color: 0xFFFFFF });

            // Draw simplified cloud shape (3 circles)
            // (0,0) is bottom-center of main circle
            g.circle(0, -20, 20);
            g.circle(30, -30, 28);
            g.circle(60, -20, 20);

            const texSize = { width: 100, height: 70 };
            const renderTexture = PIXI.RenderTexture.create({
                width: texSize.width,
                height: texSize.height,
                resolution: this.app.renderer.resolution || 2
            });

            // Shift graphics down and right to fit into texture bounds
            g.x = 25;
            g.y = 65;

            this.app.renderer.render({ container: g, target: renderTexture });
            g.destroy();
            this.cloudTexture = renderTexture;

            this.cloudSprites.forEach(sprite => {
                sprite.texture = this.cloudTexture;
                sprite.anchor.set(0.25, 1); // approximate anchor point for (0,0) of original graphics
            });
        }

        // Calculate Cloud Zone boundaries
        // Assuming top is roughly height * 0.1 or we use a fixed gameArea.top proxy
        // Since we don't have gameArea.top easily, we can use absolute screen values
        // or relative to the height. GameArea usually has top margin of 10-20vh.
        const zoneTop = -140; // Offset relative to game area top (which is 0 in Pixi local space if we are inside the game container)
        // Actually, RenderSystem's (0,0) is the top-left of the game area.
        // So zoneTop should be a bit negative. Let's use -140 like the original.
        const zoneHeight = 180;

        // Use a relative VW calculation for distance, roughly 100vw = width / scaleFactor?
        // Width here is the logical game width (e.g. 600). So 100vw depends on screen.
        // Let's use the actual logical width of the game area.
        // 100vw is roughly 100 * (window.innerWidth / 100).
        // Let's just use window.innerWidth for total distance.
        const vw = window.innerWidth / 100;
        const totalDistance = 160 * vw;
        const startX = -50 * vw;

        this.cloudData.forEach((cloud, index) => {
            const sprite = this.cloudSprites[index];
            const cycleTime = cloud.duration * 1000;
            const delayMs = cloud.delay * 1000;
            const totalTime = time - delayMs;

            let progress = (totalTime % cycleTime) / cycleTime;
            if (progress < 0) progress += 1;

            const currentX = startX + (totalDistance * progress);
            const canvasY = zoneTop + (cloud.yPercent * zoneHeight);

            // Convert window space to logical space
            sprite.x = currentX / scaleFactor;
            sprite.y = canvasY;
            sprite.scale.set(cloud.scale);
            sprite.alpha = cloud.opacity;
        });
    } catch (e) { console.error("Error in drawClouds:", e); } }

    drawFloor(width: number, height: number, scaleFactor: number) {


        if (!this.app || !this.app.renderer) return;

        // Context Loss Check
        // @ts-ignore - accessing internal gl context
        const glContext = this.app.renderer.gl || this.app.renderer.context?.gl;
        if (glContext && glContext.isContextLost()) return;


        // To make the wavy floor, we can still use a Graphic to generate the texture ONCE,
        // then render it as a Sprite.

        if (!this.floorTexture) {
            const g = new PIXI.Graphics();

            const texWidth = 1000;
            const texHeight = 200;
            const step = 5;

            g.moveTo(0, texHeight);

            // Wavy top edge
            const getFloorYLocal = (x: number) => {
                const baseY = 40;
                return baseY + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.04) * 5;
            };

            g.lineTo(0, getFloorYLocal(0));
            for (let x = 0; x <= texWidth; x += step) {
                g.lineTo(x, getFloorYLocal(x));
            }
            g.lineTo(texWidth, getFloorYLocal(texWidth));
            g.lineTo(texWidth, texHeight);
            g.closePath();
            g.fill({ color: 0x76C043 });

            // Stroke
            g.moveTo(0, getFloorYLocal(0));
            for (let x = 0; x <= texWidth; x += step) {
                g.lineTo(x, getFloorYLocal(x));
            }
            g.stroke({ width: 6, color: 0x2E5A1C });

            // Some decorations
            g.circle(150, 100, 15);
            g.circle(180, 120, 20);
            g.fill({ color: 0x558B2F, alpha: 0.2 });
            g.circle(800, 100, 25);
            g.fill({ color: 0x558B2F, alpha: 0.2 });

            const renderTexture = PIXI.RenderTexture.create({
                width: texWidth,
                height: texHeight,
                resolution: this.app.renderer.resolution || 2
            });

            this.app.renderer.render({ container: g, target: renderTexture });
            g.destroy();
            this.floorTexture = renderTexture;
            this.floorSprite.texture = this.floorTexture;
        }

        const startX = -200;
        const widthToCover = Math.max(width + 400, 1000);

        // We calculate floor height from GameEngine's height
        // BaseY in original was `height - 60`. In our texture, the top wave starts at ~40px down.
        // So we want the sprite's top wave (40px local) to align with `height - 60` globally.
        // sprite.y + 40 = height - 60  =>  sprite.y = height - 100

        this.floorSprite.x = startX;
        this.floorSprite.y = height - 100;

        // Stretch floor width to cover the screen
        this.floorSprite.width = widthToCover;
        // Keep proportional height or just fixed
        this.floorSprite.height = 400; // stretch it down
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
