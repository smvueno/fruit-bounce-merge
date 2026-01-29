import React, { useEffect, useRef } from 'react';

interface GroundCanvasProps {
    gameAreaWidth: number;
    gameAreaHeight: number;
    containerTop: number;
    containerLeft: number;
}

const V_WIDTH = 600; // Virtual width from GameEngine (must match!)

export const GroundCanvas: React.FC<GroundCanvasProps> = React.memo(({
    gameAreaWidth,
    gameAreaHeight,
    containerTop,
    containerLeft
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helper function to calculate wavy floor Y position (matches RenderSystem LOGIC but needs SCALING)
    // Physics: baseY + Math.sin(x * 0.015) * 10 + Math.cos(x * 0.04) * 5;
    // x is Virtual X (0..600).
    // Result is Virtual Y offset.
    const getVirtualFloorOffset = (virtualX: number): number => {
        return Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
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

            // scaleFactor: How many pixels per 1 virtual unit?
            // gameAreaWidth corresponds to V_WIDTH (600).
            const scaleFactor = gameAreaWidth / V_WIDTH;

            // Calculate the game area's floor position in viewport coordinates
            // The floor is at height - 15 in VIRTUAL coordinates.
            // So visual offset is 15 * scaleFactor.
            const virtualFloorOffset = 15;
            const gameFloorOffset = virtualFloorOffset * scaleFactor;

            // Note: We might want a slight epsilon alignment, but let's trust the math first.
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
                // 1. Get X relative to Game Area (Physics Origin is Left of Game Area)
                const visualRelX = x - containerLeft;

                // 2. Convert to Virtual X
                const virtualX = visualRelX / scaleFactor;

                // 3. Get Virtual Y Offset (The wave height)
                const virtualWaveHeight = getVirtualFloorOffset(virtualX);

                // 4. Convert Virtual Wave Height to Visual Pixels
                const visualWaveHeight = virtualWaveHeight * scaleFactor;

                // 5. Apply to Base Y
                const waveY = gameFloorY + visualWaveHeight;

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
                const visualRelX = x - containerLeft;
                const virtualX = visualRelX / scaleFactor;
                const virtualWaveHeight = getVirtualFloorOffset(virtualX);
                const visualWaveHeight = virtualWaveHeight * scaleFactor;
                const waveY = gameFloorY + visualWaveHeight;

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

        // Handle visibility changes to restore canvas
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                resizeCanvas();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [gameAreaWidth, gameAreaHeight, containerTop, containerLeft]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 5 }}
        />
    );
});
