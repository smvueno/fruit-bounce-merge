import * as PIXI from 'pixi.js';

/**
 * Renders the wavy ground floor in Pixi screen-space.
 * Aligned to the physics floor: y = V_HEIGHT - 15 = 735 in virtual coords.
 * Uses the Pixi container's position (not DOM) for accurate alignment.
 */
export class GroundRenderer {
    private fillGraphics: PIXI.Graphics;
    private strokeGraphics: PIXI.Graphics;
    private container: PIXI.Container;

    constructor(stage: PIXI.Container) {
        this.container = new PIXI.Container();
        this.fillGraphics = new PIXI.Graphics();
        this.strokeGraphics = new PIXI.Graphics();
        this.container.addChild(this.fillGraphics);
        this.container.addChild(this.strokeGraphics);
        this.container.zIndex = 5;
        stage.addChild(this.container);
    }

    /**
     * Draw the ground floor in screen coordinates.
     * @param viewWidth Viewport width in CSS pixels
     * @param viewHeight Viewport height in CSS pixels
     * @param gameAreaWidth Game area width in CSS pixels
     * @param gameAreaHeight Game area height in CSS pixels
     * @param containerTop Pixi container Y position on screen (CSS pixels) — NOT DOM position
     * @param containerLeft Pixi container X position on screen (CSS pixels) — NOT DOM position
     * @param scaleFactor Scale factor between virtual and screen coords
     */
    draw(viewWidth: number, viewHeight: number, gameAreaWidth: number, gameAreaHeight: number, containerTop: number, containerLeft: number, scaleFactor: number): void {
        this.fillGraphics.clear();
        this.strokeGraphics.clear();

        const V_HEIGHT = 750;

        // Physics floor is at V_HEIGHT - 15 = 735 in virtual coords
        // Convert to screen Y using the Pixi container's position
        const virtualFloorY = V_HEIGHT - 15;
        const gameFloorY = containerTop + (virtualFloorY * scaleFactor);

        // Helper to get wave Y at screen X (relative to game area)
        const getWaveY = (screenX: number): number => {
            const visualRelX = screenX - containerLeft;
            const virtualX = visualRelX / scaleFactor;
            const virtualWaveHeight = Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
            const visualWaveHeight = virtualWaveHeight * scaleFactor;
            return gameFloorY + visualWaveHeight;
        };

        // Draw fill (closed polygon - no stroke)
        const step = 5;
        const fillPoints: number[] = [];
        fillPoints.push(0, viewHeight);
        fillPoints.push(0, getWaveY(0));
        for (let x = 0; x <= viewWidth; x += step) {
            fillPoints.push(x, getWaveY(x));
        }
        fillPoints.push(viewWidth, getWaveY(viewWidth));
        fillPoints.push(viewWidth, viewHeight);

        this.fillGraphics.poly(fillPoints);
        this.fillGraphics.fill({ color: 0x76C043 });

        // Draw stroke as open line (top edge only, no bottom line)
        // Use moveTo/lineTo instead of poly() to avoid auto-closing
        const strokePoints: number[] = [];
        for (let x = 0; x <= viewWidth; x += step) {
            strokePoints.push(x, getWaveY(x));
        }
        if (strokePoints.length >= 4) {
            this.strokeGraphics.moveTo(strokePoints[0], strokePoints[1]);
            for (let i = 2; i < strokePoints.length; i += 2) {
                this.strokeGraphics.lineTo(strokePoints[i], strokePoints[i + 1]);
            }
        }
        this.strokeGraphics.stroke({ width: 4, color: 0x2E5A1C });

        // Decorative circles
        const addDecoration = (x: number, y: number, radius: number, alpha: number = 0.2) => {
            this.fillGraphics.circle(x, y, radius);
            this.fillGraphics.fill({ color: 0x558B2F, alpha });
        };

        addDecoration(containerLeft + 50, gameFloorY, 15);
        addDecoration(containerLeft + 80, gameFloorY + 20, 20);
        addDecoration(containerLeft + gameAreaWidth - 100, gameFloorY, 25);

        if (containerLeft > 100) {
            addDecoration(50, gameFloorY + 10, 18);
        }
        if (viewWidth - (containerLeft + gameAreaWidth) > 100) {
            addDecoration(viewWidth - 50, gameFloorY + 10, 18);
        }
    }
}
