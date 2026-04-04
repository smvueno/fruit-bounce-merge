import * as PIXI from 'pixi.js';

/**
 * Renders the grass walls in Pixi.
 * Replaces WallCanvas.tsx — draws left and right grass walls.
 */
export class WallRenderer {
    private leftWall: PIXI.Graphics;
    private rightWall: PIXI.Graphics;

    constructor(parent: PIXI.Container) {
        this.leftWall = new PIXI.Graphics();
        this.rightWall = new PIXI.Graphics();
        this.leftWall.zIndex = -50;
        this.rightWall.zIndex = -50;
        parent.addChild(this.leftWall);
        parent.addChild(this.rightWall);
    }

    /**
     * Draw both grass walls.
     * @param vHeight Virtual height of the game area
     * @param scaleFactor Current scale factor
     * @param gameAreaWidth Game area width in CSS pixels
     */
    draw(vHeight: number, scaleFactor: number, gameAreaWidth: number): void {
        this.leftWall.clear();
        this.rightWall.clear();

        const wallWidth = 80;
        const wallHeight = vHeight;

        // Left wall at x=0
        this.drawWallShape(this.leftWall, wallHeight, false);

        // Right wall at x=vWidth, mirrored
        const vWidth = gameAreaWidth / scaleFactor;
        this.rightWall.x = vWidth;
        this.rightWall.scale.x = -1;
        this.drawWallShape(this.rightWall, wallHeight, false);
    }

    private drawWallShape(g: PIXI.Graphics, wallHeight: number, _side: boolean): void {
        // Main Wall Body
        g.poly([
            10, 35,
            10, wallHeight - 10,
            10, wallHeight,
            60, wallHeight,
            70, wallHeight - 10,
            70, 35,
        ]);
        g.fill({ color: 0x4CAF50 });
        g.stroke({ width: 2.5, color: 0x1f6b23, join: 'round' });

        // Shadow under Grass Cap
        g.poly([
            10, 35,
            70, 35,
            70, 50,
            50, 55,
            40, 50,
            30, 55,
            10, 50,
        ]);
        g.fill({ color: 0x2E7D32, alpha: 0.4 });

        // Grass Cap (Bezier approximation with line segments)
        g.poly([
            5, 35, 2, 25, 8, 18, 15, 22,
            18, 12, 28, 8, 35, 18,
            40, 5, 52, 5, 58, 18,
            65, 10, 78, 15, 75, 35,
            65, 42, 55, 38, 45, 45,
            35, 38, 25, 42, 15, 38, 8, 40,
        ]);
        g.fill({ color: 0x8BC34A });
        g.stroke({ width: 2.5, color: 0x1f6b23, join: 'round' });

        // Decorative Tufts
        const tufts = [
            { x: 20, y: 95 }, { x: 15, y: 200 }, { x: 22, y: 340 }, { x: 16, y: 470 },
            { x: 45, y: 120 }, { x: 55, y: 230 }, { x: 42, y: 360 }, { x: 58, y: 490 },
        ];

        g.stroke({ width: 2.5, color: 0x1f6b23, cap: 'round', alpha: 0.6 });
        tufts.forEach(tuft => {
            if (tuft.y < wallHeight) {
                g.poly([
                    tuft.x, tuft.y,
                    tuft.x + 2, tuft.y - 10,
                    tuft.x + 6, tuft.y - 10,
                    tuft.x + 8, tuft.y,
                ]);
                g.stroke();
            }
        });
    }
}
