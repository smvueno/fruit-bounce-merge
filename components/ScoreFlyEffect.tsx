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
        transform: 'translate(-50%, -50%) scale(1)', // Initial state
        opacity: 1,
        pointerEvents: 'none',
        zIndex: 100,
        color: color,
        fontWeight: 900,
        fontSize: '3rem',
        WebkitTextStroke: '6px #1a1a1a', // Outline
        textShadow: '3px 3px 0px #1a1a1a', // Shift
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
        const tx = targetRect.left + targetRect.width / 2;
        const ty = targetRect.top + targetRect.height / 2;

        const sx = window.innerWidth / 2;
        const sy = window.innerHeight / 2;

        // Target Color (HUD Black)
        const targetColor = '#1a1a1a';

        const animate = (time: number) => {
            if (!startTimeRef.current) startTimeRef.current = time;
            const progress = Math.min((time - startTimeRef.current) / 800, 1);

            const ease = progress * progress * progress; // EaseInCubic

            const currentX = sx + (tx - sx) * ease;
            const currentY = sy + (ty - sy) * ease;
            const scale = 1 - (0.6 * ease); // Down to 0.4 instead of 0.2 (better visibility)

            // Interpolate Color
            // Tailwind colors like 'text-green-500' pass through? No, we need explicit hex for this logic.
            // Component calls will need to pass hex.
            const currentColor = interpolateColor(color, targetColor, ease);

            setStyle(prev => ({
                ...prev,
                left: `${currentX}px`,
                top: `${currentY}px`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                color: currentColor
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
