import * as PIXI from 'pixi.js';

/**
 * Renders the wavy ground floor in Pixi.
 * Replaces GroundCanvas.tsx — draws in virtual coordinates within the game container.
 * Extends beyond game area to cover screen edges.
 */
export class GroundRenderer {
    private graphics: PIXI.Graphics;

    constructor(parent: PIXI.Container) {
        this.graphics = new PIXI.Graphics();
        // Ground sits below all game objects
        this.graphics.zIndex = -100;
        parent.addChild(this.graphics);
    }

    /**
     * Calculate wavy floor Y offset (matches PhysicsSystem LUT exactly).
     * @param virtualX X position in virtual coordinates
     */
    private getFloorOffset(virtualX: number): number {
        return Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
    }

    /**
     * Draw the ground floor.
     * @param vWidth Virtual width of the game area (600)
     * @param vHeight Virtual height of the game area (750)
     * @param screenPixelWidth Actual screen width in CSS pixels
     * @param scaleFactor Current scale factor (screen pixels per virtual unit)
     * @param containerX X position of the container on screen
     */
    draw(vWidth: number, vHeight: number, screenPixelWidth: number, scaleFactor: number, containerX: number): void {
        this.graphics.clear();

        // How many virtual units the screen extends beyond the game area on each side
        const screenVWidth = screenPixelWidth / scaleFactor;
        const gameCenter = vWidth / 2;
        const startX = gameCenter - (screenVWidth / 2);
        const endX = gameCenter + (screenVWidth / 2);

        // Floor base Y in virtual coordinates (matches RenderSystem.getFloorY)
        const baseY = vHeight - 60;

        // Bottom of the fill — extend well below the game area
        const bottomY = baseY + 200;

        // Build the ground shape
        const step = 5;
        const points: number[] = [];

        // Start at bottom-left
        points.push(startX, bottomY);
        // Go up to wave start
        points.push(startX, baseY + this.getFloorOffset(startX));

        // Draw wave across the full screen width
        for (let x = startX; x <= endX; x += step) {
            points.push(x, baseY + this.getFloorOffset(x));
        }

        // Close the shape at bottom-right
        points.push(endX, baseY + this.getFloorOffset(endX));
        points.push(endX, bottomY);

        this.graphics.poly(points);
        this.graphics.fill({ color: 0x76C043 });
        this.graphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 });

        // Decorative circles (matching original GroundCanvas)
        this.graphics.circle(50, vHeight, 15);
        this.graphics.circle(80, vHeight + 20, 20);
        this.graphics.fill({ color: 0x558B2F, alpha: 0.2 });
        this.graphics.circle(vWidth - 100, vHeight, 25);
        this.graphics.fill({ color: 0x558B2F, alpha: 0.2 });
    }
}
