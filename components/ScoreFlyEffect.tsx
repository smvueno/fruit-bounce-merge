
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { PopupData, PopUpType } from '../types';

interface ScoreFlyEffectProps {
    startAmount: number;
    targetElementId: string;
    onComplete: () => void;
    color: string;
    contextData: PopupData | null;
}

const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 0 };
}

const interpolateColor = (startHex: string, endHex: string, factor: number) => {
    const c1 = hexToRgb(startHex);
    const c2 = hexToRgb(endHex);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return `rgb(${r}, ${g}, ${b})`;
}

export const ScoreFlyEffect: React.FC<ScoreFlyEffectProps> = ({ startAmount, targetElementId, onComplete, color, contextData }) => {
    // Styles
    const wrapperStyle: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 100,
        fontFamily: "'Fredoka', 'Segoe UI', sans-serif",
        width: '95%',
        maxWidth: '600px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
    };

    const commonStyle: React.CSSProperties = {
        color: color,
        WebkitTextStroke: '6px #1a1a1a',
        textShadow: '3px 3px 0px #1a1a1a',
        paintOrder: 'stroke fill'
    };

    const ghostTextStyle: React.CSSProperties = {
        visibility: 'hidden',
        marginBottom: '0.25rem',
        ...commonStyle,
        color: 'transparent',
        WebkitTextStroke: '6px transparent',
        textShadow: 'none'
    };

    // State
    const [phase, setPhase] = useState<'MEASURE' | 'FLY'>('MEASURE');
    const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        left: '0px',
        top: '0px',
        transform: 'translate(-50%, -50%) scale(1)',
        opacity: 0, // Hidden until measured
        pointerEvents: 'none',
        zIndex: 100,
        fontFamily: "'Fredoka', 'Segoe UI', sans-serif",
        ...commonStyle // Apply text styles directly to the flyer
    });

    const ghostContainerRef = useRef<HTMLDivElement>(null);
    const scoreTextRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>(0);
    const startTimeRef = useRef<number | null>(null);

    // Context Data for Ghost Rows
    let showMultiplier = false;
    let mainText = '';

    if (contextData) {
        switch (contextData.type) {
            case PopUpType.WATERMELON_CRUSH:
                mainText = 'WATERMELON CRUSH!';
                break;
            case PopUpType.FRENZY:
                mainText = 'FRENZY!!';
                showMultiplier = true;
                break;
            case PopUpType.CHAIN:
                mainText = 'CHAIN BONUS!';
                showMultiplier = true;
                break;
        }
    }

    // Measure Phase
    useLayoutEffect(() => {
        if (phase === 'MEASURE' && scoreTextRef.current) {
            const rect = scoreTextRef.current.getBoundingClientRect();
            // This rect.top / rect.left is exactly where the text IS on screen.
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height / 2;

            // Now switch to fly phase with these coordinates
            setFlyStyle(prev => ({
                ...prev,
                left: `${startX}px`,
                top: `${startY}px`,
                opacity: 1 // Visible now
            }));
            setPhase('FLY');
        }
    }, [phase]);

    // Fly Phase Animation
    useEffect(() => {
        if (phase !== 'FLY') return;

        const target = document.getElementById(targetElementId);
        if (!target) {
            onComplete();
            return;
        }

        // Get Start Pos from current style
        const sx = parseFloat(flyStyle.left as string);
        const sy = parseFloat(flyStyle.top as string);

        const targetRect = target.getBoundingClientRect();
        const tx = targetRect.left + targetRect.width / 2;
        const ty = targetRect.top + targetRect.height / 2;

        const cpX = window.innerWidth / 2; // Curve pull towards center horizontally?
        // Or simply pull towards text popup center?
        // Let's use the popup center (screen center) as control point or bias.
        // Screen center:
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // Control Point: Between Start and Target?
        // Let's use (cx, ty) logic from before, but safer.
        // Start is (sx, sy). Target is (tx, ty).
        // Let's bias the curve "outward". 
        // Simple Arc: P1 = (sx, ty) [Corner]
        const P1x = sx;
        const P1y = ty;

        const targetColor = '#1a1a1a';
        const duration = 1000;

        const animate = (time: number) => {
            if (!startTimeRef.current) startTimeRef.current = time;
            const elapsed = time - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // Ease In Cubic
            const t = Math.pow(progress, 3);
            const invT = 1 - t;

            // Bezier
            const currentX = (invT * invT * sx) + (2 * invT * t * P1x) + (t * t * tx);
            const currentY = (invT * invT * sy) + (2 * invT * t * P1y) + (t * t * ty);

            // Scale Logic: 1.0 -> 1.2 (Zoom) -> 0.4 (Target)
            let scale = 1.0;
            if (progress < 0.3) {
                // 0 -> 0.3: Zoom to 1.2
                const zt = progress / 0.3;
                scale = 1.0 + (0.2 * Math.sin(zt * Math.PI / 2));
            } else {
                // 0.3 -> 1.0: Shrink to 0.4
                const st = (progress - 0.3) / 0.7;
                scale = 1.2 - (0.8 * st);
            }

            const currentColor = interpolateColor(color, targetColor, t);

            setFlyStyle(prev => ({
                ...prev,
                left: `${currentX}px`,
                top: `${currentY}px`,
                transform: `translate(-50%, -50%) scale(${scale})`, // No Rotate
                color: currentColor,
            }));

            if (progress < 1) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                onComplete();
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [phase, targetElementId, onComplete, color]); // Dependencies for animation start

    if (phase === 'MEASURE') {
        // Render the Ghost Structure to measure
        return (
            <div style={wrapperStyle}>
                {/* Multiplier Ghost */}
                {showMultiplier && contextData && contextData.multiplier > 1 && (
                    <div className="text-2xl md:text-4xl font-black tracking-widest mb-1" style={ghostTextStyle}>
                        x{contextData.multiplier}
                    </div>
                )}
                {/* Main Text Ghost */}
                <h1 className="text-4xl md:text-6xl font-black tracking-wide mb-2 leading-none" style={ghostTextStyle}>
                    {mainText}
                </h1>
                {/* The Score to Measure */}
                <div
                    ref={scoreTextRef}
                    className="text-5xl md:text-7xl font-black leading-none tracking-wide"
                    style={{ ...commonStyle, opacity: 0 }} // Invisible but takes space
                >
                    {startAmount.toLocaleString()}
                </div>
            </div>
        );
    }

    // FLY Phase: Render just the score text moving independently
    return (
        <div
            style={flyStyle}
            className="text-5xl md:text-7xl font-black leading-none tracking-wide"
        >
            {startAmount.toLocaleString()}
        </div>
    );
};
