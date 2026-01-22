import React, { useEffect, useRef } from 'react';

interface GroundCanvasProps {
    gameAreaWidth: number;
    gameAreaHeight: number;
    containerTop: number;
    containerLeft: number;
}

export const GroundCanvas: React.FC<GroundCanvasProps> = ({
    gameAreaWidth,
    gameAreaHeight,
    containerTop,
    containerLeft
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helper function to calculate wavy floor Y position (matches RenderSystem)
    const getFloorY = (x: number, baseY: number): number => {
        return baseY + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.04) * 5;
    };

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

            // Calculate the game area's floor position in viewport coordinates
            // The floor is at height - 60 in game coordinates
            const gameFloorOffset = 60; // Distance from bottom of game area
            const gameFloorY = containerTop + gameAreaHeight - gameFloorOffset;

            // Draw ground extending from game floor to bottom of screen and edge-to-edge
            const startX = 0;
            const endX = width;
            const bottomY = height;

            // Create path for ground
            ctx.beginPath();
            ctx.moveTo(startX, bottomY);
            ctx.lineTo(startX, gameFloorY);

            // Draw wavy top edge
            const step = 5;
            for (let x = startX; x <= endX; x += step) {
                // Map screen X to game coordinates for wave pattern continuity
                const gameX = (x - containerLeft) * (gameAreaWidth / gameAreaWidth);
                const waveY = getFloorY(gameX, gameFloorY);
                ctx.lineTo(x, waveY);
            }

            ctx.lineTo(endX, gameFloorY);
            ctx.lineTo(endX, bottomY);
            ctx.closePath();

            // Fill with ground color
            ctx.fillStyle = '#76C043';
            ctx.fill();

            // Add border stroke on top edge
            ctx.beginPath();
            for (let x = startX; x <= endX; x += step) {
                const gameX = (x - containerLeft) * (gameAreaWidth / gameAreaWidth);
                const waveY = getFloorY(gameX, gameFloorY);
                if (x === startX) {
                    ctx.moveTo(x, waveY);
                } else {
                    ctx.lineTo(x, waveY);
                }
            }
            ctx.strokeStyle = '#2E5A1C';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Add decorative circles (optional - matches existing design)
            const addDecoration = (x: number, y: number, radius: number, alpha: number = 0.2) => {
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(85, 139, 47, ${alpha})`;
                ctx.fill();
            };

            // Left decorations
            addDecoration(containerLeft + 50, gameFloorY, 15);
            addDecoration(containerLeft + 80, gameFloorY + 20, 20);

            // Right decorations
            addDecoration(containerLeft + gameAreaWidth - 100, gameFloorY, 25);

            // Add more decorations for extended areas if desired
            if (containerLeft > 100) {
                addDecoration(50, gameFloorY + 10, 18);
            }
            if (canvas.width - (containerLeft + gameAreaWidth) > 100) {
                addDecoration(canvas.width - 50, gameFloorY + 10, 18);
            }
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
            style={{ zIndex: 5 }}
        />
    );
};
