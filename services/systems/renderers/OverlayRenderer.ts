import * as PIXI from 'pixi.js';
import { DANGER_Y_PERCENT } from '../../../constants';

export class OverlayRenderer {
    container: PIXI.Container;
    app: PIXI.Application;

    // Juice - Simple unified approach
    private juiceContainer: PIXI.Container;
    private juiceGraphics: PIXI.Graphics;

    private readonly WAVE_AMPLITUDE = 8;  // Height of wave peaks
    private readonly WAVE_FREQUENCY = 0.04; // How many waves across the width
    private readonly GAME_HEIGHT = 750; // Virtual Height
    private readonly GAME_WIDTH = 600; // Virtual Width

    // Danger
    private dangerContainer: PIXI.Container;
    private dangerLine: PIXI.Graphics;
    private dangerGlow: PIXI.Graphics;

    // Animation state
    private waveOffset = 0;

    constructor(app: PIXI.Application, container: PIXI.Container) {
        this.app = app;
        this.container = container;

        // --- Juice Setup ---
        // Use a single Graphics object for the entire juice area (wave + fill)
        this.juiceContainer = new PIXI.Container();
        this.juiceContainer.label = 'juice_overlay';
        this.juiceContainer.alpha = 0.4; // Semi-transparent
        this.container.addChild(this.juiceContainer);

        this.juiceGraphics = new PIXI.Graphics();
        this.juiceContainer.addChild(this.juiceGraphics);

        // --- Danger Setup ---
        this.dangerContainer = new PIXI.Container();
        this.dangerContainer.label = 'danger_overlay';
        this.container.addChild(this.dangerContainer);

        this.dangerGlow = new PIXI.Graphics();
        this.dangerGlow.filters = [new PIXI.BlurFilter({ strength: 10, quality: 2 })];
        this.dangerContainer.addChild(this.dangerGlow);

        this.dangerLine = new PIXI.Graphics();
        this.dangerContainer.addChild(this.dangerLine);
    }

    update(dt: number, juice: number, fever: boolean, dangerActive: boolean, width: number, height: number) {
        // --- Update Wave Animation ---
        this.waveOffset += dt * 50; // Smooth scrolling animation

        // --- Update Juice ---
        const color = fever ? 0xA855F7 : 0x60A5FA; // Purple for fever, blue normally

        // Height Calculation
        // Danger line is at DANGER_Y_PERCENT from top
        // Juice fills from bottom UP TO danger line when at 100%
        const dangerY = height * DANGER_Y_PERCENT;
        const maxJuiceHeight = height - dangerY;

        // juice is a raw value (0-1500), convert to percentage (0-100)
        // JUICE_MAX = 1500, so percentage = (juice / 1500) * 100
        const JUICE_MAX = 1500; // Match constants.ts
        const juicePercent = Math.min(100, Math.max(0, (juice / JUICE_MAX) * 100));
        const targetHeight = (juicePercent / 100) * maxJuiceHeight;

        // Clear and redraw
        this.juiceGraphics.clear();

        if (targetHeight <= 0.1) {
            this.juiceContainer.visible = false;
        } else {
            this.juiceContainer.visible = true;

            // Calculate juice top position
            let juiceTop = height - targetHeight;
            // Clamp to never go above danger line
            juiceTop = Math.max(dangerY, juiceTop);

            // Draw the juice as a single path: wavy top + filled body
            this.juiceGraphics.beginPath();

            // Start at bottom-left
            this.juiceGraphics.moveTo(0, height);

            // Go up to the left edge of the wave
            const leftEdgeY = juiceTop + Math.sin(this.waveOffset * this.WAVE_FREQUENCY) * this.WAVE_AMPLITUDE;
            this.juiceGraphics.lineTo(0, leftEdgeY);

            // Draw wavy top edge across the width
            const step = 8; // Draw point every 8 pixels for smoothness
            for (let x = 0; x <= width; x += step) {
                // Sinusoidal wave animation
                const waveY = juiceTop + Math.sin((x + this.waveOffset) * this.WAVE_FREQUENCY) * this.WAVE_AMPLITUDE;
                this.juiceGraphics.lineTo(x, waveY);
            }

            // Ensure we reach the right edge
            const rightEdgeY = juiceTop + Math.sin((width + this.waveOffset) * this.WAVE_FREQUENCY) * this.WAVE_AMPLITUDE;
            this.juiceGraphics.lineTo(width, rightEdgeY);

            // Go down to bottom-right and close
            this.juiceGraphics.lineTo(width, height);
            this.juiceGraphics.closePath();

            // Fill with the juice color
            this.juiceGraphics.fill({ color });
        }

        // --- Update Danger ---
        const y = height * DANGER_Y_PERCENT;

        // Glow (subtle red glow)
        this.dangerGlow.clear();
        this.dangerGlow.moveTo(0, y).lineTo(width, y).stroke({ width: 6, color: 0xFF0000, alpha: 0.6 });

        // Line
        this.dangerLine.clear();
        this.dangerLine.moveTo(0, y).lineTo(width, y);
        if (dangerActive) {
            this.dangerLine.stroke({ width: 4, color: 0xFF0000, alpha: 0.8 });
        } else {
            this.dangerLine.stroke({ width: 4, color: 0x000000, alpha: 0.2 });
        }
    }
}
