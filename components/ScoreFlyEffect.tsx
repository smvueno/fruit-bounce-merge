import React, { useEffect, useState, useRef } from 'react';

interface ScoreFlyEffectProps {
    startAmount: number;
    targetElementId: string;
    onComplete: () => void;
    color: string;
}

// Helper to parse simple hex/rgb colors would be complex, 
// let's assume valid hex or named colors are passed. 
// For smooth interpolation, we need RGB. 
// Let's implement a simple hex interpolator.
const hexToRgb = (hex: string) => {
    // Expand shorthand (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 0 }; // Fallback Yellow
}

const interpolateColor = (startHex: string, endHex: string, factor: number) => {
    const c1 = hexToRgb(startHex);
    const c2 = hexToRgb(endHex);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
}

export const ScoreFlyEffect: React.FC<ScoreFlyEffectProps> = ({ startAmount, targetElementId, onComplete, color }) => {
    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%) scale(1)',
        opacity: 1,
        pointerEvents: 'none',
        zIndex: 100,
        color: color,
        fontWeight: 900,
        fontSize: '3rem',
        WebkitTextStroke: '6px #1a1a1a',
        textShadow: '3px 3px 0px #1a1a1a',
        paintOrder: 'stroke fill',
        fontFamily: 'Fredoka, sans-serif'
    });

    const requestRef = useRef<number>(0);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        const target = document.getElementById(targetElementId);
        if (!target) {
            onComplete();
            return;
        }

        const targetRect = target.getBoundingClientRect();
        // Target is the center of the HUD element
        const tx = targetRect.left + targetRect.width / 2;
        const ty = targetRect.top + targetRect.height / 2;

        const sx = window.innerWidth / 2;
        const sy = window.innerHeight / 2;

        // Quadratic Bezier Control Point
        // We want a nice curve. Let's pull it "out" relative to the movement.
        // If moving Top-Left, pull it Top (y diff) or Left (x diff).
        // Let's use a control point that creates an arc.
        // P0=(sx,sy), P2=(tx,ty).
        // Control Point P1:
        // Let's go 20% "out" perpendicular to the line?
        // Simpler: Just bias it.
        // If going up-left, control point at (sx, ty) [Straight up then left]
        // or (tx, sy) [Left then up]. 
        // Let's try (sx - 100, ty + 100) -> A bit chaotic.
        // Let's use (sx, ty) but slightly offset towards center for a "Swoop"
        const cx = sx + (tx - sx) * 0.1;
        const cy = ty + (sy - ty) * 0.1;
        // Actually (sx, ty) is the corner "Top-Right" of the bounding box if HUD is Top-Left and Start is Center.
        // Wait, Center to Top-Left. 
        // sx > tx, sy > ty.
        // Corner is (sx, ty) which is Center-X, Top-Y.
        // Or (tx, sy) which is Left-X, Center-Y.
        // Let's use (tx, sy) -- go LEFT then UP. (swoop side)
        // Or (sx, ty) -- go UP then LEFT.
        // Let's try (sx, ty) for "Up then over".

        // Let's refine: A curve that goes slightly right then loops left looks cool ("Suck up").
        // But for speed, a clean arc is better.
        // Let's use (sx + 50, ty + 100) to create a slight "wind up".

        const cpX = sx;
        const cpY = ty; // "Square" corner.

        const targetColor = '#1a1a1a';
        const duration = 1000; // 1s total

        const animate = (time: number) => {
            if (!startTimeRef.current) startTimeRef.current = time;
            const progress = Math.min((time - startTimeRef.current) / duration, 1);

            // Custom Easing: Start slow (glow), accelerate fast (suck), impact.
            // easeInBack or easeInExpo.
            // Let's use cubic ease-in for the "Suck" feel.
            const ease = Math.pow(progress, 3);

            // Bezier Formula: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
            const t = ease;
            const invT = 1 - t;

            const currentX = (invT * invT * sx) + (2 * invT * t * cpX) + (t * t * tx);
            const currentY = (invT * invT * sy) + (2 * invT * t * cpY) + (t * t * ty);

            // Rotation effect: Spin as it flies?
            const rotation = t * 360;

            // Scale: Start 1.2 (Pop), then shrink to 0.4
            const scale = 1.2 - (0.8 * t);

            const currentColor = interpolateColor(color, targetColor, t);

            setStyle(prev => ({
                ...prev,
                left: `${currentX}px`,
                top: `${currentY}px`,
                transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
                color: currentColor,
                opacity: 1 // Keep fully visible until poof
            }));

            if (progress < 1) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                onComplete();
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(requestRef.current);
    }, [targetElementId, onComplete, color]);

    return (
        <div style={style}>
            +{startAmount.toLocaleString()}
        </div>
    );
};
