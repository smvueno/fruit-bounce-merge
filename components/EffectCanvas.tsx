import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../services/GameEngine';

interface EffectCanvasProps {
    engine: GameEngine | null;
    gameAreaWidth: number;
    gameAreaHeight: number;
    containerTop: number;
    containerLeft: number;
}

export const EffectCanvas: React.FC<EffectCanvasProps> = React.memo(({
    engine,
    gameAreaWidth,
    gameAreaHeight,
    containerTop,
    containerLeft
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            if (!engine || !engine.effectSystem) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            // 1. Setup Canvas
            const dpr = window.devicePixelRatio || 1;
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Resize if needed (check logic to avoid thrashing)
            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                ctx.scale(dpr, dpr);
            }

            // Clear
            ctx.clearRect(0, 0, width, height);

            // 2. Get Coordinate System from Engine
            // The engine coords are virtual (V_WIDTH x V_HEIGHT).
            // They are scaled by engine.scaleFactor.
            // They are offset by engine.container.position.x/y relative to the Canvas element.
            // BUT, our "GroundCanvas/WallCanvas" logic uses `bottomY` relative to screen.

            // Actually, let's look at how WallCanvas acts: it overlays perfectly on the screen.
            // The GameArea (Div) is where the Pixi canvas lives. `containerLeft`/`containerTop` is where that Div is.
            // Inside Pixi, there is `engine.container.position` (centering offset) and `engine.scaleFactor`.

            // To map a particle (p.x, p.y) from Virtual Game Space to Screen Space:
            // ScreenX = containerLeft + engine.container.x + (p.x * engine.scaleFactor)
            // ScreenY = containerTop + engine.container.y + (p.y * engine.scaleFactor)

            const particles = engine.effectSystem.visualParticles;
            if (particles.length === 0) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            const scale = engine.scaleFactor;
            const offsetX = engine.container.position.x;
            const offsetY = engine.container.position.y;

            // CSS Offset Correction:
            // The canvas is styled with width/height: 140% and top/left: -20% of the game area.
            // gameAreaWidth/Height represents the 100% (Viewport).
            // So the canvas physically starts at: containerLeft - 0.2 * gameAreaWidth.
            // We need to pass the Top-Left of the CANVAS to this calc, because 'offsetX/Y' are valid relative to that.

            const canvasLeft = containerLeft - (gameAreaWidth * 0.2);
            const canvasTop = containerTop - (gameAreaHeight * 0.2);

            const globalOffsetX = canvasLeft + offsetX;
            const globalOffsetY = canvasTop + offsetY;

            // 3. Render Particles
            for (const p of particles) {
                const drawX = globalOffsetX + (p.x * scale);
                const drawY = globalOffsetY + (p.y * scale);
                const drawSize = p.size * scale;

                ctx.globalAlpha = p.alpha;

                // Color is guaranteed string by EffectSystem
                ctx.fillStyle = p.color as string;

                if (p.type === 'star') {
                    // Draw Star
                    ctx.save();
                    ctx.translate(drawX, drawY);
                    ctx.rotate(p.rotation);
                    ctx.beginPath();
                    const spikes = 5;
                    const outerRadius = drawSize;
                    const innerRadius = drawSize * 0.4;

                    for (let i = 0; i < spikes * 2; i++) {
                        const r = i % 2 === 0 ? outerRadius : innerRadius;
                        const angle = (Math.PI * i) / spikes;
                        const x = Math.cos(angle) * r;
                        const y = Math.sin(angle) * r;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                } else if (p.type === 'bomb-ghost') {
                    ctx.fillStyle = '#212121';
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, drawSize, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Circle
                    ctx.beginPath();
                    ctx.arc(drawX, drawY, drawSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = 1.0;

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameRef.current);
        };
    }, [engine, gameAreaWidth, gameAreaHeight, containerTop, containerLeft]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 30 }} // Higher than Walls (20) and Game (10)
        />
    );
});
