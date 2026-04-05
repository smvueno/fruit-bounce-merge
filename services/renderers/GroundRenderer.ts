import * as PIXI from 'pixi.js';

/**
 * Renders the wavy ground floor inside the game container (virtual coords).
 * This ensures ground stays perfectly aligned with fruits at any screen size.
 * Ground extends beyond game area to cover screen edges.
 */
export class GroundRenderer {
    private fillGraphics: PIXI.Graphics;
    private strokeGraphics: PIXI.Graphics;

    constructor(parent: PIXI.Container) {
        this.fillGraphics = new PIXI.Graphics();
        this.strokeGraphics = new PIXI.Graphics();
        // Ground sits below fruits
        this.fillGraphics.zIndex = -100;
        this.strokeGraphics.zIndex = -100;
        parent.addChild(this.fillGraphics);
        parent.addChild(this.strokeGraphics);
    }

    /**
     * Draw the ground floor in virtual coordinates.
     * Ground extends to the bottom of the viewport on any screen size.
     */
    draw(viewWidth: number, viewHeight: number, gameAreaWidth: number, scaleFactor: number, containerLeft: number): void {
        this.fillGraphics.clear();
        this.strokeGraphics.clear();

        const V_WIDTH = 600;
        const V_HEIGHT = 750;

        // Physics floor is at V_HEIGHT - 15 = 735 in virtual coords
        const virtualFloorY = V_HEIGHT - 15;

        // How many virtual units the screen extends beyond the game area
        const screenVWidth = viewWidth / scaleFactor;
        const screenVHeight = Math.max(V_HEIGHT, viewHeight / scaleFactor);
        const gameCenter = V_WIDTH / 2;
        const startX = gameCenter - (screenVWidth / 2);
        const endX = gameCenter + (screenVWidth / 2);

        // Helper to get wave Y at virtual X
        const getWaveY = (virtualX: number): number => {
            const wave = Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
            return virtualFloorY + wave;
        };

        // Draw fill (closed polygon - no stroke)
        const step = 5;
        const fillPoints: number[] = [];
        fillPoints.push(startX, screenVHeight + 100);
        fillPoints.push(startX, getWaveY(startX));
        for (let x = startX; x <= endX; x += step) {
            fillPoints.push(x, getWaveY(x));
        }
        fillPoints.push(endX, getWaveY(endX));
        fillPoints.push(endX, screenVHeight + 100);

        this.fillGraphics.poly(fillPoints);
        this.fillGraphics.fill({ color: 0x76C043 });

        // Draw stroke as open line (top edge only, no bottom line)
        const strokePoints: number[] = [];
        for (let x = startX; x <= endX; x += step) {
            strokePoints.push(x, getWaveY(x));
        }
        if (strokePoints.length >= 4) {
            this.strokeGraphics.moveTo(strokePoints[0], strokePoints[1]);
            for (let i = 2; i < strokePoints.length; i += 2) {
                this.strokeGraphics.lineTo(strokePoints[i], strokePoints[i + 1]);
            }
        }
        this.strokeGraphics.stroke({ width: 4, color: 0x2E5A1C });

        // Decorative circles (in virtual coords, relative to game area)
        const addDecoration = (x: number, y: number, radius: number, alpha: number = 0.2) => {
            this.fillGraphics.circle(x, y, radius);
            this.fillGraphics.fill({ color: 0x558B2F, alpha });
        };

        addDecoration(50, virtualFloorY, 15);
        addDecoration(80, virtualFloorY + 20, 20);
        addDecoration(V_WIDTH - 100, virtualFloorY, 25);

        // Extra decorations for extended areas
        if (containerLeft > 100) {
            addDecoration(startX + 50, virtualFloorY + 10, 18);
        }
        if (viewWidth / scaleFactor - (containerLeft / scaleFactor + V_WIDTH) > 100) {
            addDecoration(endX - 50, virtualFloorY + 10, 18);
        }
    }
}
