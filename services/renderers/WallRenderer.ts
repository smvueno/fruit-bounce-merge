import * as PIXI from 'pixi.js';

/**
 * Renders the grass walls inside the game container (virtual coords).
 * Walls are positioned at the left and right edges of the game area,
 * extending from y=35 down to the bottom of the game area.
 * This ensures walls stay perfectly aligned with the game area at any screen size.
 */
export class WallRenderer {
    private leftWall: PIXI.Graphics;
    private rightWall: PIXI.Graphics;

    constructor(parent: PIXI.Container) {
        this.leftWall = new PIXI.Graphics();
        this.rightWall = new PIXI.Graphics();
        // Walls sit above ground but below fruits
        this.leftWall.zIndex = -50;
        this.rightWall.zIndex = -50;
        parent.addChild(this.leftWall);
        parent.addChild(this.rightWall);
    }

    /**
     * Draw both grass walls in virtual coordinates.
     * Walls overlap the game area by ~5px for a seamless framing effect.
     * @param viewWidth Viewport width in CSS pixels (for extending beyond game area)
     * @param scaleFactor Scale factor between virtual and screen coords
     * @param containerLeft Pixi container X position on screen (CSS pixels)
     */
    draw(viewWidth: number, scaleFactor: number, containerLeft: number): void {
        this.leftWall.clear();
        this.rightWall.clear();

        const V_WIDTH = 600;
        const V_HEIGHT = 750;
        const wallWidth = 80;
        const overlap = 5; // px overlap into game area

        // How many virtual units the screen extends beyond the game area
        const screenVWidth = viewWidth / scaleFactor;

        // Left wall: right edge overlaps game area by 5px
        this.leftWall.x = -wallWidth + overlap;
        this.leftWall.y = 35;
        this.drawWallShape(this.leftWall, V_HEIGHT - 35, 'left');

        // Right wall: left edge overlaps game area by 5px
        this.rightWall.x = V_WIDTH - overlap;
        this.rightWall.y = 35;
        this.drawWallShape(this.rightWall, V_HEIGHT - 35, 'right');
    }

    private drawWallShape(g: PIXI.Graphics, height: number, _side: 'left' | 'right'): void {
        // Main Wall Body
        g.poly([10, 35, 10, height - 10, 10, height, 60, height, 70, height - 10, 70, 35]);
        g.fill({ color: 0x4CAF50 });
        g.stroke({ width: 2.5, color: 0x1f6b23, join: 'round' });

        // Shadow under Grass Cap
        g.poly([10, 35, 70, 35, 70, 50, 50, 55, 40, 50, 30, 55, 10, 50]);
        g.fill({ color: 0x2E7D32, alpha: 0.4 });

        // Grass Cap
        g.poly([5, 35, 2, 25, 8, 18, 15, 22, 18, 12, 28, 8, 35, 18, 40, 5, 52, 5, 58, 18, 65, 10, 78, 15, 75, 35, 65, 42, 55, 38, 45, 45, 35, 38, 25, 42, 15, 38, 8, 40]);
        g.fill({ color: 0x8BC34A });
        g.stroke({ width: 2.5, color: 0x1f6b23, join: 'round' });

        // Decorative Tufts
        const tufts = [
            { x: 20, y: 95 }, { x: 15, y: 200 }, { x: 22, y: 340 }, { x: 16, y: 470 },
            { x: 45, y: 120 }, { x: 55, y: 230 }, { x: 42, y: 360 }, { x: 58, y: 490 },
        ];
        g.stroke({ width: 2.5, color: 0x1f6b23, cap: 'round', alpha: 0.6 });
        tufts.forEach(tuft => {
            if (tuft.y < height) {
                g.poly([tuft.x, tuft.y, tuft.x + 2, tuft.y - 10, tuft.x + 6, tuft.y - 10, tuft.x + 8, tuft.y]);
                g.stroke();
            }
        });
    }
}
