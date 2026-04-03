import * as PIXI from 'pixi.js';

export class WaterSystem {
    public container: PIXI.Container;
    private app: PIXI.Application;

    private waterGraphics: PIXI.Graphics;
    private waveSprite: PIXI.TilingSprite | null = null;

    private juiceLevel: number = 0;
    private isFever: boolean = false;

    // Config
    private baseColorNormal = 0x60A5FA;
    private baseColorFever = 0xA855F7;

    private elapsed: number = 0;

    // Bounds
    private gameAreaWidth: number = 0;
    private gameAreaHeight: number = 0;
    private gameAreaTop: number = 0;
    private gameAreaLeft: number = 0;

    constructor(app: PIXI.Application) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.interactive = false;
        this.container.interactiveChildren = false;
        this.container.alpha = 0.4;

        this.waterGraphics = new PIXI.Graphics();
        this.container.addChild(this.waterGraphics);

        this.initWaveTexture();
    }

    private async initWaveTexture() {
        // Create an SVG data URL for the wave
        const svgData = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z' fill='white' /%3E%3C/svg%3E`;

        try {
            const texture = await PIXI.Assets.load(svgData);

            // Create a tiling sprite for the wave top
            this.waveSprite = new PIXI.TilingSprite({
                texture,
                width: this.app.screen.width,
                height: 24, // 1.5rem / 6 in tailwind
            });

            // Default tint
            this.waveSprite.tint = this.baseColorNormal;
            this.container.addChild(this.waveSprite);

            this.resize(this.gameAreaWidth, this.gameAreaHeight, this.gameAreaTop, this.gameAreaLeft);
        } catch (e) {
            console.error("Failed to load wave texture", e);
        }
    }

    public updateState(juiceLevel: number, isFever: boolean) {
        this.juiceLevel = juiceLevel;
        this.isFever = isFever;
        this.drawWater();
    }

    public resize(width: number, height: number, top: number, left: number) {
        this.gameAreaWidth = width;
        this.gameAreaHeight = height;
        this.gameAreaTop = top;
        this.gameAreaLeft = left;

        if (this.waveSprite) {
            this.waveSprite.width = width;
        }

        this.drawWater();
    }

    private drawWater() {
        if (!this.gameAreaHeight || !this.gameAreaWidth) return;

        const currentColor = this.isFever ? this.baseColorFever : this.baseColorNormal;

        // Match React Logic:
        // BOTTOM_BUFFER = 12% (to hide when 0)
        // VISIBLE_HEIGHT = (1 - dangerYPercent) * 100 = 87%
        // Total Height = 99% of Game Area

        const totalMaxHeight = this.gameAreaHeight * (0.87 + 0.12);
        const currentHeight = (this.juiceLevel / 100) * totalMaxHeight;

        // Starts below game area
        const bottomY = this.gameAreaTop + this.gameAreaHeight + (this.gameAreaHeight * 0.12);
        const topY = bottomY - currentHeight;

        this.waterGraphics.clear();
        this.waterGraphics.rect(this.gameAreaLeft, topY, this.gameAreaWidth, currentHeight);
        this.waterGraphics.fill(currentColor);

        if (this.waveSprite) {
            this.waveSprite.x = this.gameAreaLeft;
            this.waveSprite.y = topY - 24; // Draw wave above the rect block
            this.waveSprite.width = this.gameAreaWidth;
            this.waveSprite.tint = currentColor;
            // The wave texture viewBox is 100 20, let's scale X so one cycle is ~100px wide
            this.waveSprite.tileScale.x = 100 / this.waveSprite.texture.width;
            this.waveSprite.tileScale.y = 24 / this.waveSprite.texture.height;
        }
    }

    public update(dtSeconds: number) {
        this.elapsed += dtSeconds;

        if (this.waveSprite && this.juiceLevel > 0) {
            // Animate wave. The original had 3000ms transition...
            // We can just scroll it to the left to simulate waves
            this.waveSprite.tilePosition.x -= 30 * dtSeconds;

            // Optional: gently bob the water level up and down slightly
            const bobOffset = Math.sin(this.elapsed * 2) * 2;
            const currentHeight = (this.juiceLevel / 100) * (this.gameAreaHeight * 0.99);
            const bottomY = this.gameAreaTop + this.gameAreaHeight + (this.gameAreaHeight * 0.12);
            let topY = bottomY - currentHeight + bobOffset;

            // Adjust graphics and sprite positions
            const currentColor = this.isFever ? this.baseColorFever : this.baseColorNormal;
            this.waterGraphics.clear();
            this.waterGraphics.rect(this.gameAreaLeft, topY, this.gameAreaWidth, currentHeight - bobOffset);
            this.waterGraphics.fill(currentColor);

            this.waveSprite.y = topY - 24;
        }
    }
}
