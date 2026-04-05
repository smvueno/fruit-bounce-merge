import React, { useEffect, useRef, useState } from 'react';

interface GameBackgroundProps {
    fever: boolean;
}

// Color palettes for background transitions
const NORMAL_COLORS = [
    '#FFF8E1', // warm cream
    '#F0F4FF', // soft blue
    '#FFF5EE', // peach
    '#F5FFF0', // mint
    '#FFF0F5', // blush
];

const FEVER_COLORS = [
    '#f5e6ff', // purple
    '#ffe6f0', // pink
    '#e6f0ff', // ice blue
    '#fff0e6', // warm glow
    '#f0fff0', // fever green
];

const CYCLE_NORMAL = 4000;
const CYCLE_FEVER = 1500;
const TRANSITION_MS = 1500;

export const GameBackground: React.FC<GameBackgroundProps> = React.memo(({ fever }) => {
    const [colorIndex, setColorIndex] = useState(0);
    const prevColorRef = useRef<string>(NORMAL_COLORS[0]);
    const currentColorRef = useRef<string>(NORMAL_COLORS[0]);
    const [bgColor, setBgColor] = useState(NORMAL_COLORS[0]);

    const palette = fever ? FEVER_COLORS : NORMAL_COLORS;
    const cycleTime = fever ? CYCLE_FEVER : CYCLE_NORMAL;

    // Reset on fever toggle
    useEffect(() => {
        const colors = fever ? FEVER_COLORS : NORMAL_COLORS;
        currentColorRef.current = colors[0];
        prevColorRef.current = colors[0];
        setColorIndex(0);
        setBgColor(colors[0]);
    }, [fever]);

    // Cycle colors
    useEffect(() => {
        const timer = setInterval(() => {
            const next = (colorIndex + 1) % palette.length;
            prevColorRef.current = currentColorRef.current;
            currentColorRef.current = palette[next];
            setColorIndex(next);
            setBgColor(palette[next]);
        }, cycleTime);
        return () => clearInterval(timer);
    }, [colorIndex, palette, cycleTime]);

    return (
        <div
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
            style={{
                background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 50%, ${bgColor}99 100%)`,
                transition: `background ${TRANSITION_MS}ms ease`,
            }}
        />
    );
});
