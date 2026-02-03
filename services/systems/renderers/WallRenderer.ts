import * as PIXI from 'pixi.js';

export class WallRenderer {
    container: PIXI.Container;
    leftWall: PIXI.Graphics;
    rightWall: PIXI.Graphics;

    constructor(parentContainer: PIXI.Container) {
        this.container = new PIXI.Container();
        parentContainer.addChild(this.container);

        this.leftWall = new PIXI.Graphics();
        this.rightWall = new PIXI.Graphics();

        this.container.addChild(this.leftWall);
        this.container.addChild(this.rightWall);
    }

    draw(gameAreaWidth: number, gameAreaHeight: number, containerTop: number, containerLeft: number, screenWidth: number, screenHeight: number) {
        this.leftWall.clear();
        this.rightWall.clear();

        // Constants from WallCanvas.tsx
        const wallWidth = 80;
        const topMargin = 60;
        const wallTop = topMargin;
        const wallHeight = screenHeight - wallTop;
        const overlap = 12;

        // Draw Function (Generates instructions for one wall)
        // We will draw to leftWall, and then maybe clone geometry? 
        // Or just draw to both since it's immediate mode graphics mostly.
        // Actually, for optimization, we could draw to one and share geometry if Pixi allows, 
        // but simple drawing twice is fast enough for resize events.

        // Let's implement 'drawWallShape' that takes a Graphics context
        const drawWallShape = (g: PIXI.Graphics) => {
            // 1. Main Wall Body (Green Fill)
            // Styles are applied in fill/stroke calls

            g.beginPath();
            g.moveTo(10, 35);
            g.lineTo(10, wallHeight - 10);
            g.quadraticCurveTo(10, wallHeight, 20, wallHeight);
            g.lineTo(60, wallHeight);
            g.quadraticCurveTo(70, wallHeight, 70, wallHeight - 10);
            g.lineTo(70, 35);
            g.closePath();
            g.fill({ color: 0x4CAF50 });
            g.stroke({ width: 2.5, color: 0x1f6b23, cap: 'round', join: 'round' });

            // 2. Shadow under Grass Cap
            // rgba(46, 125, 50, 0.4) -> 0x2E7D32
            g.beginPath();
            g.moveTo(10, 35);
            g.lineTo(70, 35);
            g.lineTo(70, 50);
            g.quadraticCurveTo(50, 55, 40, 50);
            g.quadraticCurveTo(30, 55, 10, 50);
            g.closePath();
            g.fill({ color: 0x2E7D32, alpha: 0.4 });

            // 3. Grass Cap (Complex Bezier)
            // fill #8BC34A, stroke inherited (#1f6b23, 2.5)
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
            g.stroke({ width: 2.5, color: 0x1f6b23, cap: 'round', join: 'round' });

            // 4. Decorative Tufts
            // stroke #1f6b23, width 2.5, alpha 0.6
            // Tufts need to be repeated down the wall? 
            // WallCanvas has fixed tuft data. Let's copy it.
            const tufts = [
                // Left Column
                { x: 20, y: 95, cp1x: 22, cp1y: 85, cp2x: 26, cp2y: 85, ex: 28, ey: 95 },
                { x: 15, y: 200, cp1x: 17, cp1y: 190, cp2x: 21, cp2y: 190, ex: 23, ey: 200 },
                { x: 22, y: 340, cp1x: 24, cp1y: 330, cp2x: 28, cp2y: 330, ex: 30, ey: 340 },
                { x: 16, y: 470, cp1x: 18, cp1y: 460, cp2x: 22, cp2y: 460, ex: 24, ey: 470 },
                // Right Column
                { x: 45, y: 120, cp1x: 47, cp1y: 110, cp2x: 51, cp2y: 110, ex: 53, ey: 120 },
                { x: 55, y: 230, cp1x: 57, cp1y: 220, cp2x: 61, cp2y: 220, ex: 63, ey: 230 },
                { x: 42, y: 360, cp1x: 44, cp1y: 350, cp2x: 48, cp2y: 350, ex: 50, ey: 360 },
                { x: 58, y: 490, cp1x: 60, cp1y: 480, cp2x: 64, cp2y: 480, ex: 66, ey: 490 }
            ];

            tufts.forEach(tuft => {
                if (tuft.y < wallHeight) {
                    g.beginPath();
                    g.moveTo(tuft.x, tuft.y);
                    g.bezierCurveTo(tuft.cp1x, tuft.cp1y, tuft.cp2x, tuft.cp2y, tuft.ex, tuft.ey);
                    g.stroke({ width: 2.5, color: 0x1f6b23, alpha: 0.6, cap: 'round' });
                }
            });
        };

        // Draw Left Wall
        // Position: containerLeft - wallWidth + overlap
        const leftWallX = containerLeft - wallWidth + overlap;
        this.leftWall.position.set(leftWallX, wallTop);
        drawWallShape(this.leftWall);

        // Draw Right Wall
        // Position: containerLeft + gameAreaWidth - overlap (plus wallWidth because we scale -1 relative to origin)
        // Wait, if we scale -1 around origin (0,0 of the graphics):
        // Visual X becomes -X.
        // We want visual start to be at 'rightWallX'.
        // If we translate to T, and scale -1:
        // Rendered at T - x_local.
        // We want the "flat side" (Left side of drawing 10px) to be the one facing the game area?

        // Left Wall: Flat side is at x=70? No, checking drawing:
        // moveTo(10, 35) ... lineTo(10, height-10). The 10 x-coord is the straight line (mostly).
        // lineTo(60, ...) .. 70.
        // So x=10 is Left side, x=70 is Right side.

        // For Left Wall: x=10 (Left) is Outer edge? x=70 (Right) is Inner Edge (facing game)?
        // WallCanvas:
        // Left Wall: placed at leftWallX.
        // leftWallX = containerLeft - 80 + 12.
        // So the rightmost part (x=70) is at containerLeft - 80 + 12 + 70 = containerLeft + 2.
        // So the "Right" side of the Left Wall (x=70) faces the Game.

        // Right Wall:
        // ctx.translate(x + wallWidth, y);
        // ctx.scale(-1, 1);
        // x argument was 'rightWallX'.
        // rightWallX = containerLeft + gameAppWidth - 12.
        // origin at rightWallX + 80.
        // x-axis is flipped.
        // So "Positive X" in drawing goes Leftwards on screen.
        // Drawing x=10 (Left side of drawing) -> Screen x = Origin - 10 = rightWallX + 70.
        // Drawing x=70 (Right side of drawing) -> Screen x = Origin - 70 = rightWallX + 10.

        // Wait, 'flat side' needs to face game area.
        // Game area is to the LEFT of Right Wall.
        // So we want the "Inner Edge" (x=70 for Left Wall) to be on the Left for Right Wall?
        // If we mirror, x=10 becomes Right (Outer) and x=70 becomes Left (Inner)?

        // Let's trust the WallCanvas logic:
        // ctx.translate(x + wallWidth, y); ctx.scale(-1, 1);

        const rightWallX = containerLeft + gameAreaWidth - overlap;
        this.rightWall.position.set(rightWallX + wallWidth, wallTop);
        this.rightWall.scale.set(-1, 1);

        // We can reuse the draw command if we target the graphics instance!
        drawWallShape(this.rightWall);
    }
}
