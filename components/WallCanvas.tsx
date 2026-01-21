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

            // Wall dimensions - with margins from top and bottom
            const wallWidth = 40; // Width of each wall
            const topMargin = 60; // Space from top of screen
            const extendBelowGround = 50; // Extend footer below the ground for better visual foundation
            const wallTop = topMargin; // Start with margin from top
            const wallHeight = gameFloorY - wallTop + extendBelowGround;
            const cornerRadius = 15; // Rounded corner radius
            const footerHeight = 25; // Height of the decorative footer
            const footerWidth = wallWidth + 20; // Footer is wider than the wall

            // Draw stone wall with footer function
            const drawStoneWall = (x: number, y: number, width: number, height: number, side: 'left' | 'right') => {
                const stoneHeight = 20;
                const stoneWidth = 35;
                const mortarThickness = 3;

                // Save context for clipping
                ctx.save();

                // Create rounded rectangle path for clipping (main wall)
                ctx.beginPath();
                ctx.moveTo(x + cornerRadius, y);
                ctx.lineTo(x + width - cornerRadius, y);
                ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
                ctx.lineTo(x + width, y + height - footerHeight);
                ctx.lineTo(x, y + height - footerHeight);
                ctx.lineTo(x, y + cornerRadius);
                ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
                ctx.closePath();
                ctx.clip();

                // Background (mortar color - gray)
                ctx.fillStyle = '#5A5A5A'; // Gray mortar
                ctx.fillRect(x, y, width, height - footerHeight);

                // Draw stones
                let offsetToggle = false;
                for (let row = 0; row < Math.ceil((height - footerHeight) / stoneHeight); row++) {
                    const rowY = y + row * stoneHeight;
                    const offset = offsetToggle ? stoneWidth / 2 : 0;
                    offsetToggle = !offsetToggle;

                    for (let col = -1; col < Math.ceil((width + offset) / stoneWidth) + 1; col++) {
                        const stoneX = x + col * stoneWidth + offset;
                        const stoneY = rowY;

                        // Skip if stone is completely outside the wall
                        if (stoneX + stoneWidth < x || stoneX > x + width) continue;

                        // Clip stone to wall boundaries
                        const clippedX = Math.max(stoneX, x);
                        const clippedWidth = Math.min(stoneX + stoneWidth, x + width) - clippedX;
                        const clippedHeight = Math.min(stoneHeight - mortarThickness, (height - footerHeight) - (stoneY - y));

                        if (clippedWidth <= 0 || clippedHeight <= 0) continue;

                        // Randomize stone color for variation (gray tones)
                        const colorVariation = Math.floor(Math.random() * 30) - 15;
                        const grayValue = Math.min(255, Math.max(0, 140 + colorVariation));

                        // Main stone color (gray)
                        ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
                        ctx.fillRect(clippedX, stoneY, clippedWidth, clippedHeight);

                        // Add highlight for 3D effect
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.fillRect(clippedX, stoneY, clippedWidth, 4);

                        // Add shadow for 3D effect
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                        ctx.fillRect(clippedX, stoneY + clippedHeight - 4, clippedWidth, 4);
                    }
                }

                ctx.restore();

                // Draw rounded border for main wall
                ctx.beginPath();
                ctx.moveTo(x + cornerRadius, y);
                ctx.lineTo(x + width - cornerRadius, y);
                ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
                ctx.lineTo(x + width, y + height - footerHeight);
                ctx.lineTo(x, y + height - footerHeight);
                ctx.lineTo(x, y + cornerRadius);
                ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
                ctx.closePath();
                ctx.strokeStyle = '#3A3A3A'; // Dark gray border
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw decorative footer/base aligned with inner edge
                const footerY = y + height - footerHeight;
                let footerX: number;

                // Align footer based on wall side
                if (side === 'left') {
                    // Left wall: inner edge is on the right, expand left
                    footerX = x - (footerWidth - width);
                } else {
                    // Right wall: inner edge is on the left, expand right
                    footerX = x;
                }

                // Footer shadow for depth
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(footerX + 2, footerY + 2, footerWidth, footerHeight);

                // Footer main body (darker stone)
                const footerGradient = ctx.createLinearGradient(footerX, footerY, footerX, footerY + footerHeight);
                footerGradient.addColorStop(0, '#6A6A6A');
                footerGradient.addColorStop(0.5, '#5A5A5A');
                footerGradient.addColorStop(1, '#4A4A4A');
                ctx.fillStyle = footerGradient;
                ctx.fillRect(footerX, footerY, footerWidth, footerHeight);

                // Footer top highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.fillRect(footerX, footerY, footerWidth, 3);

                // Footer decorative lines (like molding)
                ctx.strokeStyle = '#3A3A3A';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(footerX, footerY + 5);
                ctx.lineTo(footerX + footerWidth, footerY + 5);
                ctx.stroke();

                // Footer border
                ctx.strokeStyle = '#2A2A2A';
                ctx.lineWidth = 2;
                ctx.strokeRect(footerX, footerY, footerWidth, footerHeight);
            };

            // Left wall - always render even if partially off-screen
            const leftWallX = containerLeft - wallWidth;
            drawStoneWall(leftWallX, wallTop, wallWidth, wallHeight, 'left');

            // Right wall - always render even if partially off-screen
            const rightWallX = containerLeft + gameAreaWidth;
            drawStoneWall(rightWallX, wallTop, wallWidth, wallHeight, 'right');
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
            style={{ zIndex: 6 }}
        />
    );
};
