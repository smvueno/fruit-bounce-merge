import * as PIXI from 'pixi.js';

/**
 * Renders the wavy ground floor in Pixi screen-space.
 * Replaces GroundCanvas.tsx — draws in screen coordinates on the Pixi stage.
 * Extends beyond game area to cover screen edges, matching original behavior.
 */
export class GroundRenderer {
    private graphics: PIXI.Graphics;
    private container: PIXI.Container;

    constructor(stage: PIXI.Container) {
        this.container = new PIXI.Container();
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        this.container.zIndex = 5; // Same z-index as original GroundCanvas
        stage.addChild(this.container);
    }

    /**
     * Draw the ground floor in screen coordinates.
     * @param viewWidth Viewport width in CSS pixels
     * @param viewHeight Viewport height in CSS pixels
     * @param gameAreaWidth Game area width in CSS pixels
     * @param gameAreaHeight Game area height in CSS pixels
     * @param containerTop Container Y position on screen (CSS pixels)
     * @param containerLeft Container X position on screen (CSS pixels)
     */
    draw(viewWidth: number, viewHeight: number, gameAreaWidth: number, gameAreaHeight: number, containerTop: number, containerLeft: number): void {
        this.graphics.clear();

        const V_WIDTH = 600;
        const scaleFactor = gameAreaWidth / V_WIDTH;

        // Game floor position in viewport coordinates
        // Original: virtualFloorOffset = 15, gameFloorOffset = 15 * scaleFactor
        const virtualFloorOffset = 15;
        const gameFloorOffset = virtualFloorOffset * scaleFactor;
        const gameFloorY = containerTop + gameAreaHeight - gameFloorOffset;

        // Helper to get wave Y at screen X
        const getWaveY = (screenX: number): number => {
            const visualRelX = screenX - containerLeft;
            const virtualX = visualRelX / scaleFactor;
            const virtualWaveHeight = Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
            const visualWaveHeight = virtualWaveHeight * scaleFactor;
            return gameFloorY + visualWaveHeight;
        };

        // Build the ground shape
        const step = 5;
        const points: number[] = [];

        // Start at bottom-left
        points.push(0, viewHeight);
        // Go up to wave start at left edge
        points.push(0, getWaveY(0));

        // Draw wave across the full viewport width
        for (let x = 0; x <= viewWidth; x += step) {
            points.push(x, getWaveY(x));
        }

        // Close the shape at bottom-right
        points.push(viewWidth, getWaveY(viewWidth));
        points.push(viewWidth, viewHeight);

        this.graphics.poly(points);
        this.graphics.fill({ color: 0x76C043 });

        // Border stroke on top edge
        const strokePoints: number[] = [];
        for (let x = 0; x <= viewWidth; x += step) {
            strokePoints.push(x, getWaveY(x));
        }
        this.graphics.poly(strokePoints);
        this.graphics.stroke({ width: 4, color: 0x2E5A1C });

        // Decorative circles
        const addDecoration = (x: number, y: number, radius: number, alpha: number = 0.2) => {
            this.graphics.circle(x, y, radius);
            this.graphics.fill({ color: 0x558B2F, alpha });
        };

        // Left decorations (relative to game area)
        addDecoration(containerLeft + 50, gameFloorY, 15);
        addDecoration(containerLeft + 80, gameFloorY + 20, 20);

        // Right decorations
        addDecoration(containerLeft + gameAreaWidth - 100, gameFloorY, 25);

        // Extra decorations for extended areas
        if (containerLeft > 100) {
            addDecoration(50, gameFloorY + 10, 18);
        }
        if (viewWidth - (containerLeft + gameAreaWidth) > 100) {
            addDecoration(viewWidth - 50, gameFloorY + 10, 18);
        }
    }
}
