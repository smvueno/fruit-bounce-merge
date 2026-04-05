import * as PIXI from 'pixi.js';

/**
 * Renders the grass walls inside the game container (virtual coords).
 * Uses bezier curves for smooth, beautiful wall shapes — matching the original 2D canvas design.
 * Walls overlap the game area by ~5px for a seamless framing effect.
 */
export class WallRenderer {
    private leftWall: PIXI.Graphics;
    private rightWall: PIXI.Graphics;

    constructor(parent: PIXI.Container) {
        this.leftWall = new PIXI.Graphics();
        this.rightWall = new PIXI.Graphics();
        // Walls sit ABOVE fruits
        this.leftWall.zIndex = 50;
        this.rightWall.zIndex = 50;
        parent.addChild(this.leftWall);
        parent.addChild(this.rightWall);
    }

    /**
     * Draw both grass walls in virtual coordinates.
     * Walls overlap the game area by ~5px for a seamless framing effect.
     */
    draw(_viewWidth: number, _viewHeight: number, scaleFactor: number, _containerLeft: number): void {
        this.leftWall.clear();
        this.rightWall.clear();

        const V_WIDTH = 600;
        const V_HEIGHT = 750;
        const overlap = 5; // px overlap into game area

        // Left wall: inner edge (local x=70) positioned at x=overlap
        this.leftWall.x = overlap - 70;
        this.leftWall.y = 35;
        this.drawWallShape(this.leftWall, V_HEIGHT - 35, 'left');

        // Right wall: mirrored, inner edge at V_WIDTH with grass cap overlap
        this.rightWall.x = V_WIDTH + 70;
        this.rightWall.y = 35;
        this.rightWall.scale.x = -1;
        this.drawWallShape(this.rightWall, V_HEIGHT - 35, 'right');
    }

    private drawWallShape(g: PIXI.Graphics, height: number, _side: 'left' | 'right'): void {

        // 1. Main Wall Body — with quadratic curves for rounded bottom corners
        g.beginPath();
        g.moveTo(10, 35);
        g.lineTo(10, height - 10);
        g.quadraticCurveTo(10, height, 20, height);
        g.lineTo(60, height);
        g.quadraticCurveTo(70, height, 70, height - 10);
        g.lineTo(70, 35);
        g.closePath();
        g.fill({ color: 0x4CAF50 });
        g.stroke({ width: 2.5, color: 0x1f6b23, join: 'round' });

        // 2. Shadow under Grass Cap — with quadratic curve
        g.beginPath();
        g.moveTo(10, 35);
        g.lineTo(70, 35);
        g.lineTo(70, 50);
        g.quadraticCurveTo(50, 55, 40, 50);
        g.quadraticCurveTo(30, 55, 10, 50);
        g.closePath();
        g.fill({ color: 0x2E7D32, alpha: 0.4 });

        // 3. Grass Cap — bezier curves for smooth organic shape
        g.beginPath();
        g.moveTo(5, 35);
        g.bezierCurveTo(2, 25, 8, 18, 15, 22);
        g.bezierCurveTo(18, 12, 28, 8, 35, 18);
        g.bezierCurveTo(40, 5, 52, 5, 58, 18);
        g.bezierCurveTo(65, 10, 78, 15, 75, 35);
        g.quadraticCurveTo(65, 42, 55, 38);
        g.quadraticCurveTo(45, 45, 35, 38);
        g.quadraticCurveTo(25, 42, 15, 38);
        g.quadraticCurveTo(8, 40, 5, 35);
        g.closePath();
        g.fill({ color: 0x8BC34A });
        g.stroke({ width: 2.5, color: 0x1f6b23, join: 'round' });

        // 4. Decorative Tufts — "M" shapes with quadratic curves
        const tufts = [
            { x: 20, y: 95 }, { x: 15, y: 200 }, { x: 22, y: 340 }, { x: 16, y: 470 },
            { x: 45, y: 120 }, { x: 55, y: 230 }, { x: 42, y: 360 }, { x: 58, y: 490 },
        ];
        g.stroke({ width: 2.5, color: 0x1f6b23, cap: 'round', alpha: 0.6 });
        tufts.forEach(tuft => {
            if (tuft.y < height) {
                g.beginPath();
                g.moveTo(tuft.x, tuft.y);
                g.lineTo(tuft.x + 2, tuft.y - 10);
                g.quadraticCurveTo(tuft.x + 4, tuft.y - 12, tuft.x + 6, tuft.y - 10);
                g.lineTo(tuft.x + 8, tuft.y);
                g.stroke();
            }
        });
    }
}
