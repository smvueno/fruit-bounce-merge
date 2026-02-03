import * as PIXI from 'pixi.js';
import { DANGER_Y_PERCENT } from '../../../constants';

export class OverlayRenderer {
    container: PIXI.Container;
    app: PIXI.Application;

    // Juice
    private juiceContainer: PIXI.Container;
    private waveSprite: PIXI.TilingSprite;
    private juiceFill: PIXI.Graphics;
    private waveTexture: PIXI.Texture;

    private readonly WAVE_HEIGHT = 20;
    private readonly GAME_HEIGHT = 750; // Virtual Height
    private readonly GAME_WIDTH = 600; // Virtual Width

    // Danger
    private dangerContainer: PIXI.Container;
    private dangerLine: PIXI.Graphics;
    private dangerGlow: PIXI.Graphics;

    constructor(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;

        // --- Juice Setup ---
        this.juiceContainer = new PIXI.Container();
        this.juiceContainer.label = 'juice_overlay';
        this.juiceContainer.alpha = 0.4; // Match React opacity-40
        this.container.addChild(this.juiceContainer);

        // Generate Wave Texture
        this.waveTexture = this.generateWaveTexture();

        this.waveSprite = new PIXI.TilingSprite({
            texture: this.waveTexture,
            width: this.GAME_WIDTH,
            height: this.WAVE_HEIGHT
        });

        this.juiceFill = new PIXI.Graphics();

        this.juiceContainer.addChild(this.juiceFill);
        this.juiceContainer.addChild(this.waveSprite);

        // --- Danger Setup ---
        this.dangerContainer = new PIXI.Container();
        this.dangerContainer.label = 'danger_overlay';
        this.container.addChild(this.dangerContainer);

        this.dangerGlow = new PIXI.Graphics();
        this.dangerGlow.filters = [new PIXI.BlurFilter({ strength: 10, quality: 2 })]; // Glow effect
        this.dangerContainer.addChild(this.dangerGlow);

        this.dangerLine = new PIXI.Graphics();
        this.dangerContainer.addChild(this.dangerLine);
    }

    private generateWaveTexture(): PIXI.Texture {
        const w = 100;
        const h = 20;
        const g = new PIXI.Graphics();
        g.moveTo(0, h);
        g.lineTo(0, h / 2);
        // SVG Input: M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z
        // In Pixi quadraticCurveTo(cpX, cpY, toX, toY)
        // Q25 0 50 10 -> Start (0,10), Control(25,0), End(50,10)
        g.moveTo(0, 10);
        g.quadraticCurveTo(25, 3, 50, 10); // Tweaked control point y=3 to keep inside bounds? SVG was 0 is top.
        // T100 10 -> Smooth curve to 100,10.
        // Implicit control point is reflection of previous relative to current point.
        // Prev CP was (25,0) relative to (0,10)? No, abs is (25,0). Previous point (0,10).
        // Current point (50,10). Reflected CP is (75, 20).
        g.quadraticCurveTo(75, 17, 100, 10);

        g.lineTo(100, 20);
        g.lineTo(0, 20);
        g.fill({ color: 0xFFFFFF });

        const texture = this.app.renderer.generateTexture(g);
        return texture;
    }

    update(dt: number, juice: number, fever: boolean, dangerActive: boolean, width: number, height: number) {
        // --- Update Juice ---
        // Color
        const color = fever ? 0xA855F7 : 0x60A5FA;
        this.juiceFill.tint = color;
        this.waveSprite.tint = color;

        // Animation
        this.waveSprite.tilePosition.x += dt * 60; // speed

        // Height Calc
        const dangerY = height * DANGER_Y_PERCENT;
        const visibleHeight = height - dangerY;
        const targetHeight = (juice / 100) * visibleHeight;

        if (targetHeight <= 0.1) {
            this.juiceContainer.visible = false;
        } else {
            this.juiceContainer.visible = true;

            // Position
            // Fill Rect from bottom to (top - waveHeight)
            const fillHeight = Math.max(0, targetHeight - this.WAVE_HEIGHT);
            const fillTop = height - fillHeight;

            this.juiceFill.clear().rect(0, fillTop, width, fillHeight).fill({ color: 0xFFFFFF }); // White, tinted by container/sprite tint? No, Graphics tint works differently. 
            // Actually Graphics can't easily be tinted unless we use tint property on the instance.
            // But we set this.juiceFill.tint = color above. So drawing white is correct.

            // Wave on top
            this.waveSprite.width = width;
            this.waveSprite.y = fillTop - this.WAVE_HEIGHT + 1; // +1 to overlap
            this.waveSprite.visible = true;

            // If juice is very low, maybe hide wave or clip?
            if (targetHeight < this.WAVE_HEIGHT) {
                // simple hack: hide wave if very small
                this.waveSprite.visible = false;
                this.juiceFill.clear().rect(0, height - targetHeight, width, targetHeight).fill(0xFFFFFF);
            }
        }

        // --- Update Danger ---
        const y = height * DANGER_Y_PERCENT;

        // Glow
        this.dangerGlow.clear();
        this.dangerGlow.moveTo(0, y).lineTo(width, y).stroke({ width: 6, color: 0xFF0000, alpha: 0.6 });

        // Line
        this.dangerLine.clear();
        this.dangerLine.moveTo(0, y).lineTo(width, y);
        if (dangerActive) {
            // Pulse opacity?
            const pulse = 0.5 + Math.sin(Date.now() / 100) * 0.5;
            this.dangerLine.stroke({ width: 4, color: 0xFF0000, alpha: 0.8 });
        } else {
            this.dangerLine.stroke({ width: 4, color: 0x000000, alpha: 0.2 });
        }
    }
}
