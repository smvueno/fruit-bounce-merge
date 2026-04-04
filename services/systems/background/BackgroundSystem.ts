import * as PIXI from 'pixi.js';

const BACKGROUND_PATTERNS = [
    '/assets/patterns/pattern_0.png',
    '/assets/patterns/pattern_1.png',
    '/assets/patterns/pattern_2.png',
    '/assets/patterns/pattern_3.png'
];

const BASE_SPEED = 20;
const FEVER_SPEED = 100;

export class BackgroundSystem {
    public container: PIXI.Container;
    private app: PIXI.Application;

    // Background Layer
    private bgSprite: PIXI.Sprite;
    private targetBgColor: number = 0xFFF8E1;

    // Track colors as floats to prevent Math.round stalling
    private currentR: number = 0xFF;
    private currentG: number = 0xF8;
    private currentB: number = 0xE1;

    // Tiling Patterns
    private patterns: PIXI.TilingSprite[] = [];
    private activePatternIndex: number = 0;

    // Gradient Mask Layer
    private gradientSprite: PIXI.Sprite;

    // State Variables
    private scrollPos: number = 0;
    private currentSpeed: number = BASE_SPEED;
    private feverActive: boolean = false;

    private width: number = 0;
    private height: number = 0;

    constructor(app: PIXI.Application) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.interactive = false;
        this.container.interactiveChildren = false;

        // 1. Solid Background Color
        this.bgSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        // Ensure background itself is transparent if needed, or colored.
        this.bgSprite.alpha = 1.0;

        // Let's create a main layer for patterns to handle alpha correctly
        const patternContainer = new PIXI.Container();
        // The pattern container itself needs a base color if we want to multiply.
        // Let's match the old React setup.
        // The old React setup was:
        // <div bg="#FFF8E1" (or dynamic color) opacity=0.35>
        //   <div gradient="rgba(255,255,255,0.9)" />
        //   <div pattern opacity=0.2 />
        // </div>

        // This means the BASE background is always behind the 0.35 opacity layer!
        // We need a base background!

        // Let's rethink the structure:
        // 1. Base Layer: Solid color (e.g., #FFF8E1)
        // 2. Dynamic Color Layer: bgSprite, opacity 0.35
        // 3. Gradient Layer: White vignette
        // 4. Pattern Layer: Black patterns, opacity 0.2

        // Add a base sprite that is always #FFF8E1
        const baseSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        baseSprite.tint = 0xFFF8E1;
        this.container.addChild(baseSprite);

        // The bgSprite is the dynamic colored one, opacity 0.35
        this.bgSprite.alpha = 0.35;
        this.container.addChild(this.bgSprite);

        // 3. Gradient Mask Overlay
        const gradCanvas = document.createElement('canvas');
        gradCanvas.width = 1;
        gradCanvas.height = 256;
        const ctx = gradCanvas.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.8, 'rgba(255,255,255,0)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        const gradTexture = PIXI.Texture.from(gradCanvas);
        this.gradientSprite = new PIXI.Sprite(gradTexture);
        this.gradientSprite.anchor.set(0, 0);
        this.container.addChild(this.gradientSprite);

        patternContainer.alpha = 0.5; // Base opacity for patterns layer
        this.container.addChild(patternContainer);

        // 2. Pattern Layers
        const patternSizes = [100, 60, 80, 80];

        // Create initial placeholder TilingSprites to ensure order and avoid async loading issues
        for (let i = 0; i < BACKGROUND_PATTERNS.length; i++) {
            const size = patternSizes[i];

            const tilingSprite = new PIXI.TilingSprite({
                texture: PIXI.Texture.WHITE,
                width: this.width > 0 ? this.width : (window.innerWidth || 800),
                height: this.height > 0 ? this.height : (window.innerHeight || 600)
            });

            tilingSprite.tileScale.set(80 / size);
            tilingSprite.alpha = 0; // Hide until loaded
            tilingSprite.blendMode = 'normal';

            this.patterns[i] = tilingSprite;
            patternContainer.addChild(tilingSprite);

            PIXI.Assets.load(BACKGROUND_PATTERNS[i]).then((texture) => {
                if (texture.source) texture.source.scaleMode = 'linear';

                // Recreate TilingSprite with new texture to fix WebGL caching bug on first load
                const newTilingSprite = new PIXI.TilingSprite({
                    texture: texture,
                    width: this.width > 0 ? this.width : (window.innerWidth || 800),
                    height: this.height > 0 ? this.height : (window.innerHeight || 600)
                });
                newTilingSprite.tileScale.set(80 / size);
                newTilingSprite.alpha = 0; // Initialize as invisible
                newTilingSprite.blendMode = 'normal';

                // Ensure the pattern is visually distinct by slightly boosting contrast
                // The pattern is black (0,0,0) with varying alpha
                const filter = new PIXI.ColorMatrixFilter();
                filter.matrix = [
                    0,  0,  0,  0,  0,  // R
                    0,  0,  0,  0,  0,  // G
                    0,  0,  0,  0,  0,  // B
                    0,  0,  0,  1.5, 0  // Alpha multiplier to increase visibility of the pattern
                ];
                newTilingSprite.filters = [filter];

                const index = patternContainer.getChildIndex(this.patterns[i]);
                patternContainer.addChildAt(newTilingSprite, index);
                patternContainer.removeChild(this.patterns[i]);

                this.patterns[i] = newTilingSprite;

            }).catch(e => {
                console.error(`Failed to load pattern ${BACKGROUND_PATTERNS[i]}:`, e);
            });
        }
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;

        // The base Sprite is at index 0
        const baseSprite = this.container.children[0] as PIXI.Sprite;
        if (baseSprite) {
            baseSprite.width = width;
            baseSprite.height = height;
        }

        // Resize Background Sprite
        this.bgSprite.width = width;
        this.bgSprite.height = height;

        // Resize Tiling Sprites
        for (const pattern of this.patterns) {
            if (pattern) {
                pattern.width = width;
                pattern.height = height;
            }
        }

        // Resize Gradient Overlay
        this.gradientSprite.width = width;
        this.gradientSprite.height = height;
    }

    public setFever(active: boolean) {
        this.feverActive = active;
    }

    public setPatternIndex(index: number) {
        this.activePatternIndex = Math.abs(index) % BACKGROUND_PATTERNS.length;
    }

    public setBackgroundColor(colorHex: string) {
        // Remove '#' if present and parse as hex
        const cleanHex = colorHex.replace('#', '');
        this.targetBgColor = parseInt(cleanHex, 16);
    }

    private updateBackgroundColor(dtSeconds: number) {
        const targetR = (this.targetBgColor >> 16) & 0xFF;
        const targetG = (this.targetBgColor >> 8) & 0xFF;
        const targetB = this.targetBgColor & 0xFF;

        const t = dtSeconds * 1.5; // Roughly 2s transition

        this.currentR += (targetR - this.currentR) * t;
        this.currentG += (targetG - this.currentG) * t;
        this.currentB += (targetB - this.currentB) * t;

        const r = Math.round(this.currentR);
        const g = Math.round(this.currentG);
        const b = Math.round(this.currentB);

        this.bgSprite.tint = (r << 16) | (g << 8) | b;
    }

    public update(dtSeconds: number) {
        // 1. Update Speed
        const targetSpeed = this.feverActive ? FEVER_SPEED : BASE_SPEED;
        const speedDiff = targetSpeed - this.currentSpeed;
        this.currentSpeed += speedDiff * 3.0 * dtSeconds;

        // 2. Update Scroll Position
        this.scrollPos += this.currentSpeed * dtSeconds;
        const wrappedScroll = this.scrollPos % 80;

        // 3. Update Patterns
        for (let i = 0; i < this.patterns.length; i++) {
            const pattern = this.patterns[i];

            if (!pattern) continue;

            // Scroll Position (Vertical)
            pattern.tilePosition.y = wrappedScroll;

            // Alpha crossfade
            const targetAlpha = (i === this.activePatternIndex) ? 1.0 : 0.0;
            pattern.alpha += (targetAlpha - pattern.alpha) * dtSeconds * 3.0; // 3.0 speed
        }

        // 4. Update Background Color
        this.updateBackgroundColor(dtSeconds);
    }
}
