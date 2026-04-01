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
        patternContainer.alpha = 0.2; // This is the 0.2 alpha that SVG originally had

        this.container.addChild(this.bgSprite);
        this.container.addChild(patternContainer);

        // 2. Pattern Layers
        const patternSizes = [100, 60, 80, 80];

        for (let i = 0; i < BACKGROUND_PATTERNS.length; i++) {
            const size = patternSizes[i];

            // PixiJS v8 handles dynamically updating textures on TilingSprite much better
            // if we start with an empty texture and just let Assets load it.
            // But using a WHITE texture is a safe fallback to ensure geometry is initialized
            const tilingSprite = new PIXI.TilingSprite({
                texture: PIXI.Texture.WHITE,
                width: window.innerWidth || 800,
                height: window.innerHeight || 600
            });
            // Make sure the placeholder doesn't show up before load
            tilingSprite.alpha = 0;

            this.patterns.push(tilingSprite);
            patternContainer.addChild(tilingSprite);

            // Load and apply
            PIXI.Assets.load(BACKGROUND_PATTERNS[i]).then((texture) => {
                if (texture.source) texture.source.scaleMode = 'linear';

                tilingSprite.texture = texture;
                tilingSprite.tileScale.set(80 / size);

                const currentW = this.width > 0 ? this.width : (window.innerWidth || 800);
                const currentH = this.height > 0 ? this.height : (window.innerHeight || 600);
                tilingSprite.width = currentW;
                tilingSprite.height = currentH;

                // Once loaded, set alpha depending on if it's the active pattern
                // (Note: we use 1.0 here because the patternContainer already has 0.2)
                tilingSprite.alpha = i === this.activePatternIndex ? 1.0 : 0;

            }).catch(e => {
                console.error(`Failed to load pattern ${BACKGROUND_PATTERNS[i]}:`, e);
            });
        }

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
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;

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
            // If the texture hasn't loaded (still WHITE), skip alpha crossfade
            // so we don't accidentally show a white/black block
            if (!pattern || pattern.texture === PIXI.Texture.WHITE) continue;

            // Scroll Position
            pattern.tilePosition.x = -wrappedScroll;

            // Opacity Crossfade (transition: opacity 1.5s ease-in-out)
            const targetAlpha = i === this.activePatternIndex ? 1.0 : 0;
            if (pattern.alpha !== targetAlpha) {
                const alphaDiff = targetAlpha - pattern.alpha;
                // Roughly matches a 1.5s transition
                pattern.alpha += alphaDiff * (1.0 / 1.5) * dtSeconds;

                // Snap if close
                if (Math.abs(pattern.alpha - targetAlpha) < 0.01) {
                    pattern.alpha = targetAlpha;
                }
            }
        }

        // 4. Update Background Color
        this.updateBackgroundColor(dtSeconds);
    }
}
