import React, { useEffect, useRef } from 'react';

interface WallCanvasProps {
    gameAreaWidth: number;
    gameAreaHeight: number;
    containerTop: number;
    containerLeft: number;
}

export const WallCanvas: React.FC<WallCanvasProps> = ({
    gameAreaWidth,
    gameAreaHeight,
    containerTop,
    containerLeft
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            // Use device pixel ratio for crisp rendering
            const dpr = window.devicePixelRatio || 1;

            // Set canvas to full viewport size
            const width = window.innerWidth;
            const height = window.innerHeight;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            // Scale context to account for device pixel ratio
            ctx.scale(dpr, dpr);

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Calculate positions
            const gameFloorOffset = 60; // Distance from bottom of game area
            const gameFloorY = containerTop + gameAreaHeight - gameFloorOffset;

            // Wall dimensions - Updated for new design
            const wallWidth = 80; // Width from SVG
            const topMargin = 60; // Space from top of screen
            const wallTop = topMargin;
            const wallHeight = height - wallTop; // Extend to bottom of viewport

            // Draw grass wall function (SVG based)
            const drawGrassWall = (x: number, y: number, height: number, side: 'left' | 'right') => {
                ctx.save();

                // Position the wall
                if (side === 'left') {
                    ctx.translate(x, y);
                } else {
                    // Mirror for right side so the "flat" side faces the game area
                    ctx.translate(x + wallWidth, y);
                    ctx.scale(-1, 1);
                }

                // 1. Main Wall Body (Green Fill)
                ctx.fillStyle = '#4CAF50';
                ctx.strokeStyle = '#1f6b23';
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                ctx.beginPath();
                ctx.moveTo(10, 35);
                ctx.lineTo(10, height - 10);
                ctx.quadraticCurveTo(10, height, 20, height);
                ctx.lineTo(60, height);
                ctx.quadraticCurveTo(70, height, 70, height - 10);
                ctx.lineTo(70, 35);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 2. Shadow under Grass Cap
                ctx.fillStyle = 'rgba(46, 125, 50, 0.4)'; // #2E7D32 with 0.4 opacity
                ctx.beginPath();
                ctx.moveTo(10, 35);
                ctx.lineTo(70, 35);
                ctx.lineTo(70, 50);
                ctx.quadraticCurveTo(50, 55, 40, 50);
                ctx.quadraticCurveTo(30, 55, 10, 50);
                ctx.closePath();
                ctx.fill();

                // 3. Grass Cap (Complex Bezier)
                ctx.fillStyle = '#8BC34A';
                // Stroke style inherited from above (width 2.5, color #1f6b23)

                ctx.beginPath();
                ctx.moveTo(5, 35);
                ctx.bezierCurveTo(2, 25, 8, 18, 15, 22);
                ctx.bezierCurveTo(18, 12, 28, 8, 35, 18);
                ctx.bezierCurveTo(40, 5, 52, 5, 58, 18);
                ctx.bezierCurveTo(65, 10, 78, 15, 75, 35);
                ctx.quadraticCurveTo(65, 42, 55, 38);
                ctx.quadraticCurveTo(45, 45, 35, 38);
                ctx.quadraticCurveTo(25, 42, 15, 38);
                ctx.quadraticCurveTo(8, 40, 5, 35);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // 4. Decorative Tufts ("M" shapes)
                ctx.strokeStyle = '#1f6b23';
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = 0.6;
                ctx.lineCap = 'round';

                // Tuft data from SVG
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
                    // Only draw if within current wall height
                    if (tuft.y < height) {
                        ctx.beginPath();
                        ctx.moveTo(tuft.x, tuft.y);
                        ctx.bezierCurveTo(tuft.cp1x, tuft.cp1y, tuft.cp2x, tuft.cp2y, tuft.ex, tuft.ey);
                        ctx.stroke();
                    }
                });

                ctx.restore();
            };

            // Calculate Positions
            const overlap = 17; // Slight overlap over the game area (12 + 5)

            // Left wall: to the left of container + overlap
            const leftWallX = containerLeft - wallWidth + overlap;
            drawGrassWall(leftWallX, wallTop, wallHeight, 'left');

            // Right wall: to the right of container - overlap
            const rightWallX = containerLeft + gameAreaWidth - overlap;
            drawGrassWall(rightWallX, wallTop, wallHeight, 'right');
        };

        // Initial render
        resizeCanvas();

        // Re-render on window resize
        window.addEventListener('resize', resizeCanvas);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [gameAreaWidth, gameAreaHeight, containerTop, containerLeft]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 20 }}
        />
    );
};
