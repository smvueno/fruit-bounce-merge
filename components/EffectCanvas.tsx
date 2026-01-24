import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../services/GameEngine';

interface EffectCanvasProps {
    engine: GameEngine | null;
    gameAreaWidth: number;
    gameAreaHeight: number;
    containerTop: number;
    containerLeft: number;
}

export const EffectCanvas: React.FC<EffectCanvasProps> = ({
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

            const globalOffsetX = containerLeft + offsetX;
            const globalOffsetY = containerTop + offsetY;

            // 3. Render Particles
            for (const p of particles) {
                const drawX = globalOffsetX + (p.x * scale);
                const drawY = globalOffsetY + (p.y * scale);
                const drawSize = p.size * scale;

                ctx.save();
                ctx.globalAlpha = p.alpha;

                // Convert Color (number or string)
                let color = p.color;
                if (typeof color === 'number') {
                    // Convert 0xRRGGBB to #RRGGBB
                    color = `#${color.toString(16).padStart(6, '0')}`;
                }
                ctx.fillStyle = color as string;

                if (p.type === 'star') {
                    // Draw Star
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

                ctx.restore();
            }

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
};
