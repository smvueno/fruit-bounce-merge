import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../services/GameEngine';

interface EffectCanvasProps {
    engine: GameEngine | null;
    gameAreaWidth: number;
    gameAreaHeight: number;
    containerTop: number;
    containerLeft: number;
}

// Optimization: Cache last known canvas dims to avoid resize thrashing every frame
let _cachedW = 0;
let _cachedH = 0;
let _cachedDpr = 0;

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

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        // Optimization: Cap DPR at 2 on mobile — iPhone 15 Pro is 3× = 3× pixels = 3× fill cost
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

        const render = () => {
            if (!engine || !engine.effectSystem) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            const particles = engine.effectSystem.visualParticles;

            // --- Resize only when dims change (not every frame) ---
            const rawDpr = window.devicePixelRatio || 1;
            const dpr = isMobile ? Math.min(rawDpr, 2) : rawDpr;
            const width = window.innerWidth;
            const height = window.innerHeight;

            if (width !== _cachedW || height !== _cachedH || dpr !== _cachedDpr) {
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                _cachedW = width;
                _cachedH = height;
                _cachedDpr = dpr;
            }

            ctx.clearRect(0, 0, width, height);

            if (particles.length === 0) {
                animationFrameRef.current = requestAnimationFrame(render);
                return;
            }

            // --- Coordinate system ---
            const scale = engine.scaleFactor;
            const offsetX = engine.container.position.x;
            const offsetY = engine.container.position.y;
            const canvasLeft = containerLeft - (gameAreaWidth * 0.2);
            const canvasTop = containerTop - (gameAreaHeight * 0.2);
            const gx = canvasLeft + offsetX;
            const gy = canvasTop + offsetY;

            // --- Batched rendering: group by type to minimise ctx state changes ---
            // We do one pass: circles, then stars, then ghosts.
            // For each group we set fillStyle once per unique color (sorted-ish).
            // This slashes ctx.save()/restore() from N calls → 0 calls.

            // --- Pass 1: Circles (most common — merge burst + suck + passive) ---
            let lastColor = '';
            let lastAlpha = -1;

            // Fast path cache for colors
            const colorCache: Record<number | string, string> = {};
            const getColorStr = (c: number | string) => {
                if (colorCache[c]) return colorCache[c];
                const str = typeof c === 'number'
                    ? `#${c.toString(16).padStart(6, '0')}`
                    : c;
                colorCache[c] = str;
                return str;
            };

            ctx.beginPath();
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (p.type !== 'circle' && p.type !== 'suck') continue;

                const drawX = gx + p.x * scale;
                const drawY = gy + p.y * scale;
                const drawR = p.size * scale;
                if (drawR <= 0) continue;

                const colorStr = getColorStr(p.color);
                const alpha = Math.max(0, Math.min(1, p.alpha));

                // If state changes, stroke current batch and start new
                if (Math.abs(alpha - lastAlpha) > 0.01 || colorStr !== lastColor) {
                    if (lastAlpha !== -1) ctx.fill();
                    ctx.beginPath();
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = colorStr;
                    lastAlpha = alpha;
                    lastColor = colorStr;
                }

                ctx.moveTo(drawX + drawR, drawY);
                ctx.arc(drawX, drawY, drawR, 0, 6.2832);
            }
            if (lastAlpha !== -1) ctx.fill(); // Fill last batch

            // --- Pass 2: Stars (rotation required — use save/restore but only for this type) ---
            ctx.globalAlpha = 1;
            lastAlpha = 1;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (p.type !== 'star') continue;

                const drawX = gx + p.x * scale;
                const drawY = gy + p.y * scale;
                const outerR = p.size * scale;
                if (outerR <= 0) continue;

                const alpha = Math.max(0, Math.min(1, p.alpha));
                if (Math.abs(alpha - lastAlpha) > 0.01) {
                    ctx.globalAlpha = alpha;
                    lastAlpha = alpha;
                }

                const colorStr = getColorStr(p.color);
                if (colorStr !== lastColor) {
                    ctx.fillStyle = colorStr;
                    lastColor = colorStr;
                }

                const innerR = outerR * 0.4;
                ctx.save();
                ctx.translate(drawX, drawY);
                ctx.rotate(p.rotation);
                ctx.beginPath();
                for (let s = 0; s < 10; s++) {
                    const r = s % 2 === 0 ? outerR : innerR;
                    const angle = (Math.PI * s) / 5;
                    if (s === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // --- Pass 3: Bomb ghost (expand circle, dark) ---
            ctx.fillStyle = '#212121';
            lastColor = '#212121';
            ctx.beginPath();
            let hasGhosts = false;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (p.type !== 'bomb-ghost') continue;

                const drawX = gx + p.x * scale;
                const drawY = gy + p.y * scale;
                const drawR = p.size * scale;
                if (drawR <= 0) continue;

                const alpha = Math.max(0, Math.min(1, p.alpha));
                if (Math.abs(alpha - lastAlpha) > 0.01) {
                    if (hasGhosts) ctx.fill();
                    ctx.beginPath();
                    ctx.globalAlpha = alpha;
                    lastAlpha = alpha;
                }

                ctx.moveTo(drawX + drawR, drawY);
                ctx.arc(drawX, drawY, drawR, 0, 6.2832);
                hasGhosts = true;
            }
            if (hasGhosts) ctx.fill();

            // Reset global alpha
            ctx.globalAlpha = 1;

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
            style={{ zIndex: 30 }}
        />
    );
});
