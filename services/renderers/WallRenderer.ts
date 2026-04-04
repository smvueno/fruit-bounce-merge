import * as PIXI from 'pixi.js';

/**
 * Renders the grass walls in Pixi screen-space.
 * Replaces WallCanvas.tsx — draws left and right grass walls at screen coordinates.
 */
export class WallRenderer {
    private leftWall: PIXI.Container;
    private rightWall: PIXI.Container;

    constructor(stage: PIXI.Container) {
        this.leftWall = new PIXI.Container();
        this.rightWall = new PIXI.Container();
        this.leftWall.zIndex = 5;
        this.rightWall.zIndex = 5;
        stage.addChild(this.leftWall);
        stage.addChild(this.rightWall);
    }

    /**
     * Draw both grass walls in screen coordinates.
     */
    draw(gameAreaWidth: number, _gameAreaHeight: number, containerTop: number, containerLeft: number, screenHeight: number): void {
        this.leftWall.removeChildren();
        this.rightWall.removeChildren();

        const wallWidth = 80;
        const wallHeight = screenHeight - 60;
        const topMargin = 60;

        const drawWallShape = (): PIXI.Graphics => {
            const g = new PIXI.Graphics();

            // Main Wall Body
            g.poly([10, 35, 10, wallHeight - 10, 10, wallHeight, 60, wallHeight, 70, wallHeight - 10, 70, 35]);
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
                if (tuft.y < wallHeight) {
                    g.poly([tuft.x, tuft.y, tuft.x + 2, tuft.y - 10, tuft.x + 6, tuft.y - 10, tuft.x + 8, tuft.y]);
                    g.stroke();
                }
            });

            return g;
        };

        // Left wall
        this.leftWall.x = containerLeft;
        this.leftWall.y = topMargin;
        const leftGraphics = drawWallShape();
        this.leftWall.addChild(leftGraphics);

        // Right wall (mirrored: flat side faces game area)
        this.rightWall.x = containerLeft + gameAreaWidth;
        this.rightWall.y = topMargin;
        this.rightWall.scale.x = -1;
        const rightGraphics = drawWallShape();
        this.rightWall.addChild(rightGraphics);
    }
}
