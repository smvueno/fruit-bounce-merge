import React, { useRef, useEffect } from 'react';

interface CloudsCanvasProps {
    gameAreaDimensions: {
        width: number;
        height: number;
        top: number;
        left: number;
    };
}

interface Cloud {
    yPercent: number; // Percentage of the "cloud zone" height
    scale: number;
    opacity: number;
    duration: number;
    delay: number;
}

export const CloudsCanvas: React.FC<CloudsCanvasProps> = ({ gameAreaDimensions }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);
    const safeDimensionsRef = useRef(gameAreaDimensions);

    // Update ref when props change to avoid recreating the effect if not needed
    // However, we do need to redraw/resize if dimensions change drastically.
    useEffect(() => {
        safeDimensionsRef.current = gameAreaDimensions;
    }, [gameAreaDimensions]);

    // Only render if we have valid dimensions
    const isVisible = gameAreaDimensions.width > 0;

    useEffect(() => {
        if (!isVisible) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Configuration
        // The cloud zone is conceptually "above the game area".
        // Instead of a fixed 180px height starting at top-140,
        // we'll make the canvas start at the VERY TOP of the screen (top: 0)
        // and extend down to cover the cloud area.

        // Let's define the "Cloud Active Area" relative to the game area.
        // Previously: top = gameArea.top - 140, height = 180.
        // This means the clouds live in the band: [gameArea.top - 140, gameArea.top + 40].

        // To avoid clipping at the top, we will:
        // 1. Position canvas at top: 0.
        // 2. Set height to span from 0 down to the bottom of the cloud zone (gameArea.top + 40).
        // 3. Offset the drawing Y coordinates so 0% corresponds to the conceptual top of the zone.

        const updateSize = () => {
            if (!canvas) return;
            // Canvas covers top of screen down to slightly overlapping game area
            const bottomOfZone = Math.max(200, safeDimensionsRef.current.top + 60);
            canvas.width = window.innerWidth;
            canvas.height = bottomOfZone;
        };
        updateSize();
        window.addEventListener('resize', updateSize);

        const clouds: Cloud[] = [
            { yPercent: 0.75, scale: 0.5, opacity: 0.3, duration: 30, delay: 0 },
            { yPercent: 0.60, scale: 0.7, opacity: 0.4, duration: 25, delay: 5 },
            { yPercent: 0.35, scale: 0.9, opacity: 0.5, duration: 20, delay: 2 },
            { yPercent: 0.10, scale: 1.2, opacity: 0.6, duration: 15, delay: 0 },
            { yPercent: 0.05, scale: 1.3, opacity: 0.55, duration: 12, delay: 8 },
        ];

        const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opacity: number) => {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // Draw simplified cloud shape (3 circles)
            // Note: These coordinates are relative to the anchor (x,y).
            // (0,0) is the bottom-center of the main circle roughly.
            // Using negative Y draws UPWARDS from the anchor.
            ctx.beginPath();
            ctx.arc(0, -20, 20, 0, Math.PI * 2);
            ctx.arc(30, -30, 28, 0, Math.PI * 2);
            ctx.arc(60, -20, 20, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        };

        let lastFrameTime = 0;
        const TARGET_INTERVAL = 1000 / 30; // 30fps

        const render = (time: number) => {
            frameRef.current = requestAnimationFrame(render);

            if (!canvas || !ctx) return;

            // Throttle
            if (time - lastFrameTime < TARGET_INTERVAL) return;
            lastFrameTime = time - (time % TARGET_INTERVAL);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const vw = window.innerWidth / 100;
            const totalDistance = 160 * vw;
            const startX = -50 * vw;

            // Calculate the conceptual "Cloud Zone" boundaries
            // We want clouds to appear in the band [gameArea.top - 140, gameArea.top + 40].
            // But since our canvas starts at 0, we need to map yPercent to canvas Y coordinates.

            // Zone Start (Top): gameArea.top - 140.
            // If gameArea.top is small (e.g. mobile), this might be negative relative to screen?
            // Math.max(0, ...) isn't enough if we want to draw off-screen top.
            // But usually gameArea.top is ~100-200px.

            // Let's assume the "Cloud Zone Height" is fixed 180px.
            // The top of this zone is at `safeDimensionsRef.current.top - 140`.
            const zoneTop = safeDimensionsRef.current.top - 140;
            const zoneHeight = 180;

            clouds.forEach(cloud => {
                const cycleTime = cloud.duration * 1000;
                const delayMs = cloud.delay * 1000;
                const totalTime = time - delayMs;

                let progress = (totalTime % cycleTime) / cycleTime;
                if (progress < 0) progress += 1;

                const currentX = startX + (totalDistance * progress);

                // Y position:
                // cloud.yPercent (0..1) maps to [zoneTop, zoneTop + zoneHeight]
                // Since canvas starts at 0 (screen top), canvas Y = absolute screen Y.
                // So canvasY = zoneTop + (yPercent * zoneHeight).

                const canvasY = zoneTop + (cloud.yPercent * zoneHeight);

                drawCloud(ctx, currentX, canvasY, cloud.scale, cloud.opacity);
            });
        };

        frameRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', updateSize);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [isVisible]);

    if (!isVisible) return <div className="fixed pointer-events-none z-0" />;

    return (
        <canvas
            ref={canvasRef}
            className="fixed pointer-events-none z-0"
            style={{
                top: 0, // Always start at top of viewport
                left: 0,
                width: '100%',
                // Height is set dynamically in JS, but we can set a min here
                // height: '300px'
            }}
        />
    );
};
