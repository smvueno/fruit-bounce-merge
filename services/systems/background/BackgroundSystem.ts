import * as PIXI from 'pixi.js';

const BACKGROUND_PATTERNS = [
    `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L70 70 L10 70 Z' fill='black' /%3E%3C/svg%3E`
];

const BASE_SPEED = 20;
const FEVER_SPEED = 100;

export class BackgroundSystem {
    public container: PIXI.Container;
    private app: PIXI.Application;

    // Background Layer
    private bgSprite: PIXI.Sprite;
    private targetBgColor: number = 0xFFF8E1;
    private currentBgColor: number = 0xFFF8E1;

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
        this.bgSprite.alpha = 0.35; // from React CSS
        this.container.addChild(this.bgSprite);

        // 2. Pattern Layers
        // To avoid Base64 / SVG loading issues in PixiJS v8, we parse SVGs via DOM and draw to canvas.
        const svgStrings = [
            `<svg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><g fill='black'><circle cx='50' cy='50' r='40' /></g></svg>`,
            `<svg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'><path d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /></svg>`,
            `<svg width='80' height='80' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='black' /></svg>`,
            `<svg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'><path d='M40 10 L70 70 L10 70 Z' fill='black' /></svg>`
        ];

        const patternSizes = [100, 60, 80, 80];

        for (let i = 0; i < svgStrings.length; i++) {
            const size = patternSizes[i];
            const tilingSprite = new PIXI.TilingSprite({
                texture: PIXI.Texture.EMPTY,
                width: 100,
                height: 100
            });
            tilingSprite.alpha = i === 0 ? 0.2 : 0;
            this.patterns.push(tilingSprite);
            this.container.addChild(tilingSprite);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, size, size);

                const texture = PIXI.Texture.from(canvas);
                if (texture.source) texture.source.scaleMode = 'linear';

                tilingSprite.texture = texture;

                // Keep the visual size of the tiles to 80px
                tilingSprite.tileScale.set(80 / size);

                // Explicitly sync the dimensions again, avoiding reset to base texture size
                if (this.width > 0 && this.height > 0) {
                    tilingSprite.width = this.width;
                    tilingSprite.height = this.height;
                } else {
                    tilingSprite.width = window.innerWidth;
                    tilingSprite.height = window.innerHeight;
                }
            };
            const svg64 = btoa(svgStrings[i]);
            img.src = `data:image/svg+xml;base64,${svg64}`;
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
            pattern.width = width;
            pattern.height = height;
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

    private lerpColor(start: number, end: number, t: number): number {
        if (start === end) return end;

        const r1 = (start >> 16) & 0xFF;
        const g1 = (start >> 8) & 0xFF;
        const b1 = start & 0xFF;

        const r2 = (end >> 16) & 0xFF;
        const g2 = (end >> 8) & 0xFF;
        const b2 = end & 0xFF;

        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);

        return (r << 16) | (g << 8) | b;
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

            // Scroll Position
            pattern.tilePosition.x = -wrappedScroll;

            // Opacity Crossfade (transition: opacity 1.5s ease-in-out)
            const targetAlpha = i === this.activePatternIndex ? 0.2 : 0;
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

        // 4. Update Background Color (transition: background-color 2s ease)
        if (this.currentBgColor !== this.targetBgColor) {
            // Rough approximation of 2s transition with lerp
            this.currentBgColor = this.lerpColor(this.currentBgColor, this.targetBgColor, dtSeconds * 1.5);
            this.bgSprite.tint = this.currentBgColor;

            // Snap if close enough (hard to detect exactly with hex, but this is fine for visual)
            if (Math.abs(this.currentBgColor - this.targetBgColor) < 5) {
                this.currentBgColor = this.targetBgColor;
                this.bgSprite.tint = this.currentBgColor;
            }
        }
    }
}
