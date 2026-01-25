import * as PIXI from 'pixi.js';
import { FruitTier } from '../../types';
import { Particle, EffectParticle } from '../../types/GameObjects';
import { FRUIT_DEFS, DANGER_Y_PERCENT } from '../../constants';

export interface RenderContext {
    fruits: Particle[];
    currentFruit: Particle | null;
    feverActive: boolean;
    scaleFactor: number;
    juice: number;
    juiceMax: number;
}

export class RenderSystem {
    app: PIXI.Application | undefined;

    // Core Render Objects
    fruitSprites: Map<number, PIXI.Container> = new Map();
    textures: Map<FruitTier, PIXI.Texture> = new Map();
    floorGraphics: PIXI.Graphics;
    dangerLine: PIXI.Graphics;

    // Layers
    gameLayer: PIXI.Container | undefined;
    backgroundLayer: PIXI.Container | undefined;
    groundLayer: PIXI.Container | undefined;
    wallLayer: PIXI.Container | undefined;
    effectLayer: PIXI.Container | undefined;

    wallGraphics: PIXI.Graphics;
    juiceGraphics: PIXI.Graphics;

    // Effects
    effectSprites: Map<EffectParticle, PIXI.Graphics> = new Map();

    constructor() {
        this.floorGraphics = new PIXI.Graphics();
        this.dangerLine = new PIXI.Graphics();
        this.wallGraphics = new PIXI.Graphics();
        this.juiceGraphics = new PIXI.Graphics();
    }

    initialize(
        app: PIXI.Application,
        gameLayer: PIXI.Container,
        backgroundLayer: PIXI.Container,
        groundLayer: PIXI.Container,
        wallLayer: PIXI.Container,
        effectLayer: PIXI.Container
    ) {
        this.app = app;
        this.gameLayer = gameLayer;
        this.backgroundLayer = backgroundLayer;
        this.groundLayer = groundLayer;
        this.wallLayer = wallLayer;
        this.effectLayer = effectLayer;

        this.groundLayer.addChild(this.floorGraphics);
        this.gameLayer.addChild(this.dangerLine); // Danger line stays with game
        this.wallLayer.addChild(this.wallGraphics);

        // Initialize Background Sprite
        this.tilingSprite = new PIXI.TilingSprite({
            texture: PIXI.Texture.EMPTY,
            width: app.screen.width,
            height: app.screen.height
        });

        this.nextTilingSprite = new PIXI.TilingSprite({
            texture: PIXI.Texture.EMPTY,
            width: app.screen.width,
            height: app.screen.height
        });
        this.nextTilingSprite.alpha = 0;

        this.bgGraphics = new PIXI.Graphics();

        this.backgroundLayer.addChild(this.bgGraphics);
        this.backgroundLayer.addChild(this.tilingSprite);
        this.backgroundLayer.addChild(this.nextTilingSprite);

        // Juice/Liquid Level
        this.juiceGraphics = new PIXI.Graphics();
        this.backgroundLayer.addChild(this.juiceGraphics);

        this.initTextures();
    }

    initTextures() {
        if (!this.app || !this.app.renderer) return;

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

    createSprite(p: Particle) {
        if (!this.gameLayer || !this.textures.has(p.tier)) return;
        const tex = this.textures.get(p.tier)!;
        const sprite = new PIXI.Container();
        const body = new PIXI.Sprite(tex);
        body.anchor.set(0.5);
        sprite.addChild(body);
        const face = this.createFace(p.tier, p.radius);
        face.label = "face";
        sprite.addChild(face);
        this.fruitSprites.set(p.id, sprite);
        this.gameLayer.addChild(sprite);
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

    // --- Rendering Logic ---

    // NEW: Update Layout Method
    updateLayout(layout: { width: number, height: number, top: number, left: number }, scaleFactor: number, screenWidth: number, screenHeight: number) {
        // Redraw Ground and Walls based on new layout
        // The logical game area is 600x750 * scaleFactor
        // It is centered in the layout rect
        // Ground and walls should be drawn relative to this.

        // Actually WallCanvas was purely overlay. Pixi Graphics need to be positioned.
        // WallLayer and GroundLayer are children of 'container' which is now at 0,0 (Fullscreen).
        // So we just draw them in screen coordinates? Assumed so.
        // Wait, in GameEngine handleResize, we positioned gameLayer.
        // But what about wallLayer/groundLayer?
        // Let's assume we want to draw them such that they align with the gameLayer.

        const gameW = 600 * scaleFactor;
        const gameH = 750 * scaleFactor;

        // Calculate the Top-Left of the actual game area on screen
        const gameX = layout.left + (layout.width - gameW) / 2;
        const gameY = layout.top + (layout.height - gameH) / 2;

        this.drawGround(gameX, gameY, gameW, gameH, screenWidth, screenHeight);
        this.drawWalls(gameX, gameY, gameW, gameH, screenWidth, screenHeight);
    }



    drawGround(gameX: number, gameY: number, gameW: number, gameH: number, screenW: number, screenH: number) {
        this.floorGraphics.clear();

        // Ground is complex. It needs to match the physics floor inside the game.
        // Physics floor is at V_HEIGHT - 60 (virtual).
        // So visual floor is at gameY + gameH - (60 * scaleFactor).

        // But we want the ground to extend to the bottom of the screen.
        // And wave across.

        // 1. Fill Bottom color
        const groundY = gameY + gameH - 60; // Approximate visual top of ground 
        // Note: Logic in getFloorY used local coords.
        // Let's use screen coords.

        const getVFloor = (sx: number) => {
            // Just some wave function
            const offset = 0;
            const baseY = gameY + gameH - 60; // Base floor line
            // Map screen x to virtual x for consistency?
            // Not strictly needed for visual loop
            return baseY + Math.sin(sx * 0.015) * 10 + Math.cos(sx * 0.04) * 5;
        };

        this.floorGraphics.moveTo(0, screenH);
        this.floorGraphics.lineTo(0, getVFloor(0));

        for (let x = 0; x <= screenW; x += 10) {
            this.floorGraphics.lineTo(x, getVFloor(x));
        }

        this.floorGraphics.lineTo(screenW, screenH);
        this.floorGraphics.closePath();

        this.floorGraphics.fill({ color: 0x76C043 });
        this.floorGraphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 });
    }

    drawWalls(gameX: number, gameY: number, gameW: number, gameH: number, screenW: number, screenH: number) {
        this.wallGraphics.clear();

        // Wall styles
        const wallWidth = 20;
        const grassColor = 0x558B2F;
        const grassDark = 0x33691E;

        // Visual Wall positions
        const leftWallX = gameX - wallWidth;
        const rightWallX = gameX + gameW;

        // Use a simple textured look or just jagged lines
        const drawGrassWall = (x: number, width: number, height: number, facingRight: boolean) => {
            this.wallGraphics.rect(x, gameY, width, height);
            this.wallGraphics.fill({ color: grassColor });

            // Detail lines
            this.wallGraphics.stroke({ width: 4, color: grassDark });

            // Grass Tufts
            const tuftCount = 10;
            for (let i = 0; i < tuftCount; i++) {
                const y = gameY + (height / tuftCount) * i + Math.random() * 20;
                if (facingRight) {
                    this.wallGraphics.circle(x + width, y, 5);
                } else {
                    this.wallGraphics.circle(x, y, 5);
                }
                this.wallGraphics.fill({ color: grassDark });
            }
        };

        // Left Wall
        drawGrassWall(leftWallX, wallWidth, gameH, true);

        // Right Wall
        drawGrassWall(rightWallX, wallWidth, gameH, false);
    }

    // --- Background Impl ---

    tilingSprite: PIXI.TilingSprite | null = null;
    nextTilingSprite: PIXI.TilingSprite | null = null;
    bgGraphics: PIXI.Graphics | null = null;

    // State for smooth transitions
    currentPatternIdx: number = -1;
    nextPatternIdx: number = -1;
    transitionProgress: number = 0; // 0 to 1
    isTransitioning: boolean = false;

    // State for smooth speed
    currentScrollSpeed: number = 20;

    // State for smooth color
    currentColor: number = 0xFFF8E1;
    targetColor: number = 0xFFF8E1;

    updateBackgroundAnimation(dt: number, fever: boolean, patternIdx: number, targetColorHex: string) {
        if (!this.app || !this.tilingSprite || !this.bgGraphics || !this.nextTilingSprite) return;

        // 1. Smooth Scroll Speed (Physics)
        const targetSpeed = fever ? 150 : 20;
        // Increase Lerp to 3.0 for more responsive "lighter" feel
        const speedK = 3.0;
        const speedDiff = targetSpeed - this.currentScrollSpeed;
        this.currentScrollSpeed += speedDiff * speedK * dt;

        // 2. Scroll Sprites
        const move = this.currentScrollSpeed * dt;
        this.tilingSprite.tilePosition.x -= move;
        this.tilingSprite.tilePosition.y -= move;
        this.nextTilingSprite.tilePosition.x -= move;
        this.nextTilingSprite.tilePosition.y -= move;

        // Prevent Float Drift (Ghosting Fix)
        // Wrap around at 100px (Texture Size) to keep precision high
        // We use 800 just to be safe multiple of pattern sizes if we change them, but 100 is current size.
        // Let's use 1000 to be safe.
        const WRAP = 1000;
        if (Math.abs(this.tilingSprite.tilePosition.x) > WRAP) {
            this.tilingSprite.tilePosition.x %= 100;
            this.tilingSprite.tilePosition.y %= 100;
            this.nextTilingSprite.tilePosition.x %= 100;
            this.nextTilingSprite.tilePosition.y %= 100;
        }

        // 3. Smooth Color Transition
        const newTargetColor = parseInt(targetColorHex.replace('#', ''), 16);
        if (this.targetColor !== newTargetColor) {
            this.targetColor = newTargetColor;
        }

        if (this.currentColor !== this.targetColor) {
            const colorK = 2.0 * dt;

            const r1 = (this.currentColor >> 16) & 0xFF;
            const g1 = (this.currentColor >> 8) & 0xFF;
            const b1 = this.currentColor & 0xFF;

            const r2 = (this.targetColor >> 16) & 0xFF;
            const g2 = (this.targetColor >> 8) & 0xFF;
            const b2 = (this.targetColor & 0xFF);

            const r = Math.round(r1 + (r2 - r1) * colorK);
            const g = Math.round(g1 + (g2 - g1) * colorK);
            const b = Math.round(b1 + (b2 - b1) * colorK);

            this.currentColor = (r << 16) | (g << 8) | b;

            // Apply
            this.bgGraphics.clear();
            this.bgGraphics.rect(0, 0, this.app.screen.width, this.app.screen.height);
            this.bgGraphics.fill({ color: 0xFFF8E1 }); // Base
            this.bgGraphics.rect(0, 0, this.app.screen.width, this.app.screen.height);
            this.bgGraphics.fill({ color: this.currentColor, alpha: 0.25 }); // Tint
        }

        // 4. Pattern Transition Logic
        if (this.currentPatternIdx !== patternIdx && !this.isTransitioning) {
            this.isTransitioning = true;
            this.nextPatternIdx = patternIdx;
            this.transitionProgress = 0;

            const texture = this.generatePatternTexture(patternIdx);
            this.nextTilingSprite.texture = texture;
            this.nextTilingSprite.visible = true;
            this.nextTilingSprite.alpha = 0;

            // Sync EXACTLY
            this.nextTilingSprite.tilePosition.copyFrom(this.tilingSprite.tilePosition);
        }

        if (this.isTransitioning) {
            this.transitionProgress += 1.0 * dt;

            if (this.transitionProgress >= 1) {
                this.isTransitioning = false;
                this.currentPatternIdx = this.nextPatternIdx;
                this.tilingSprite.texture = this.nextTilingSprite.texture;
                this.tilingSprite.alpha = 0.15;

                // Hide and Reset Next
                this.nextTilingSprite.alpha = 0;
                this.nextTilingSprite.visible = false;
            } else {
                this.nextTilingSprite.alpha = this.transitionProgress * 0.15;
                this.tilingSprite.alpha = (1 - this.transitionProgress) * 0.15;
            }
        } else {
            this.tilingSprite.alpha = 0.15;
            this.nextTilingSprite.visible = false; // Ensure hidden
        }
    }

    generatePatternTexture(index: number): PIXI.Texture {
        if (!this.app) return PIXI.Texture.EMPTY;

        const size = 100; // Increased tile size
        const center = size / 2;
        const gfx = new PIXI.Graphics();
        const color = 0x000000;
        const alpha = 1;

        const safeIndex = Math.abs(index) % 4;

        if (safeIndex === 0) {
            // Dots: BIGGER (Reduce gap)
            // Radius 40 gives 80px diameter in 100px box. 10px gap on sides.
            gfx.circle(center, center, 40);
            gfx.fill({ color, alpha });
        }
        else if (safeIndex === 1) {
            // Diamond/Crystal: Fill the box mostly
            // Points at 10% and 90%
            gfx.poly([
                center, 10,
                size - 10, center,
                center, size - 10,
                10, center
            ]);
            gfx.fill({ color, alpha });
        }
        else if (safeIndex === 2) {
            // Heart: Make it fill the tile
            const s = size * 0.01;
            // Custom heart path scaling
            gfx.beginPath();
            // Start top center-ish
            gfx.moveTo(50 * s, 30 * s);
            gfx.bezierCurveTo(50 * s, 25 * s, 40 * s, 10 * s, 25 * s, 10 * s);
            gfx.bezierCurveTo(5 * s, 10 * s, 5 * s, 45 * s, 50 * s, 85 * s);
            gfx.bezierCurveTo(95 * s, 45 * s, 95 * s, 10 * s, 75 * s, 10 * s);
            gfx.bezierCurveTo(60 * s, 10 * s, 50 * s, 25 * s, 50 * s, 30 * s);
            gfx.fill({ color, alpha });
        }
        else {
            // Chevrons: Thicker, tighter
            const strokeW = 12;
            const pad = 15;

            gfx.moveTo(pad, pad);
            gfx.lineTo(center, center);
            gfx.lineTo(size - pad, pad);
            gfx.stroke({ width: strokeW, color, alpha, cap: 'round', join: 'round' });

            // Second chevron closer
            const off = 40;
            gfx.moveTo(pad, pad + off);
            gfx.lineTo(center, center + off);
            gfx.lineTo(size - pad, pad + off);
            gfx.stroke({ width: strokeW, color, alpha, cap: 'round', join: 'round' });
        }

        const texture = this.app.renderer.generateTexture({
            target: gfx,
            frame: new PIXI.Rectangle(0, 0, size, size)
        });

        gfx.destroy();
        return texture;
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

    renderEffects(particles: EffectParticle[]) {
        if (!this.effectLayer) return;

        // 1. Remove dead sprites
        // A simple way is to check if sprite exists for a particle not in the list?
        // Or just iterate list and create/update.

        // Optimization: Rebuild or Pool?
        // Given complexity, let's just clear and redraw simple shapes (PIXI Graphics is fast at batching) 
        // OR maintain a map.

        // For distinct objects like Juice, separate sprites is better.
        // Let's iterate visualParticles.

        const activeIds = new Set<number>();

        particles.forEach(p => {
            // We need IDs for particles to map them reliably? 
            // EffectParticle doesn't have ID by default?
            // Let's assume we can map by object ref if Map supports it (it does).
            // activeIds.add(p.id);

            let gfx = this.effectSprites.get(p);
            if (!gfx) {
                gfx = new PIXI.Graphics();
                this.effectSprites.set(p, gfx);
                this.effectLayer!.addChild(gfx);
            }

            gfx.clear();
            gfx.position.set(p.x, p.y);
            gfx.alpha = p.alpha;
            gfx.rotation = p.rotation || 0;

            if (p.type === 'circle' || p.type === 'suck') {
                gfx.circle(0, 0, p.size);
                gfx.fill({ color: p.color });
            } else if (p.type === 'star') {
                // Draw star
                const r = p.size;
                gfx.star(0, 0, 5, r, r / 2); // PIXI 8 might support star or poly
                gfx.fill({ color: p.color });
            } else if (p.type === 'bomb-ghost') {
                gfx.circle(0, 0, p.size);
                gfx.fill({ color: 0x000000, alpha: 0.2 });
                gfx.stroke({ width: 2, color: 0xFFFFFF });
            }
        });

        // Cleanup dead sprites
        for (const [p, gfx] of this.effectSprites) {
            if (!particles.includes(p)) {
                this.effectLayer.removeChild(gfx);
                gfx.destroy();
                this.effectSprites.delete(p);
            }
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

        // Draw Juice
        this.drawJuice(ctx.juice, ctx.juiceMax, this.app?.screen.width || 0, this.app?.screen.height || 0);
    }

    drawJuice(current: number, max: number, width: number, height: number) {
        this.juiceGraphics.clear();
        if (max <= 0 || current <= 0) return;

        const pct = Math.min(1, current / max);
        const liquidH = height * pct * 0.5;

        const y = height - liquidH;

        this.juiceGraphics.rect(0, y, width, liquidH);
        this.juiceGraphics.fill({ color: 0x4FC3F7, alpha: 0.3 }); // Light Blue

        // Wave Line top
        this.juiceGraphics.stroke({ width: 2, color: 0x0288D1, alpha: 0.5 });
    }

}
