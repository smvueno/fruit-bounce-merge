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
    yPercent: number;
    scale: number;
    opacity: number;
    duration: number;
    delay: number;
}

export const CloudsCanvas: React.FC<CloudsCanvasProps> = ({ gameAreaDimensions }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<number>(0);

    // Avoid returning null to prevent React hook mismatch issues if any
    const isVisible = gameAreaDimensions.width > 0;

    const cloudZoneHeight = 180;
    const cloudZoneTop = Math.max(0, gameAreaDimensions.top - 140);

    useEffect(() => {
        if (!isVisible) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Resize
        const updateSize = () => {
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = cloudZoneHeight;
            }
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

            // Throttle to 30fps
            if (time - lastFrameTime < TARGET_INTERVAL) return;
            lastFrameTime = time - (time % TARGET_INTERVAL);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const vw = window.innerWidth / 100;
            const totalDistance = 160 * vw;
            const startX = -50 * vw;

            clouds.forEach(cloud => {
                const cycleTime = cloud.duration * 1000; // ms
                const delayMs = cloud.delay * 1000;
                const totalTime = time - delayMs; // Shifted time

                // Normalized progress 0..1
                let progress = (totalTime % cycleTime) / cycleTime;
                if (progress < 0) progress += 1;

                const currentX = startX + (totalDistance * progress);
                const currentY = cloud.yPercent * cloudZoneHeight;

                drawCloud(ctx, currentX, currentY, cloud.scale, cloud.opacity);
            });
        };

        frameRef.current = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', updateSize);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [isVisible, cloudZoneHeight]); // Re-run if visibility changes

    if (!isVisible) return <div className="fixed pointer-events-none z-0" />;

    return (
        <canvas
            ref={canvasRef}
            className="fixed pointer-events-none z-0"
            style={{
                top: cloudZoneTop,
                left: 0,
                width: '100%',
                height: cloudZoneHeight,
            }}
        />
    );
};
