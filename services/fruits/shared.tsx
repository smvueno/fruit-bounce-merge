import React from 'react';
import * as PIXI from 'pixi.js';

export enum FruitTier {
    CHERRY = 0,
    STRAWBERRY = 1,
    GRAPE = 2,
    CLEMENTINE = 3,
    ORANGE = 4,
    APPLE = 5,
    PINEAPPLE = 6,
    COCONUT = 7,
    PUMPKIN = 8,
    WATERMELON = 9,
    RAINBOW = 97, // Special
    BOMB = 98,    // Special
    TOMATO = 99   // Special
}

export interface FruitDef {
    tier: FruitTier;
    name: string;
    radius: number;
    mass: number;
    color: string;
    patternColor: string;
    bounciness: number;

    // Rendering Methods
    renderSvg: (size: number) => React.ReactNode;
    renderPixiBody: (container: PIXI.Container, radius: number) => void;
    renderPixiFace: (radius: number, blink?: boolean) => PIXI.Container;
}

// --- SVG Helpers ---
export const SvgEye = ({ cx, cy, r, style, eyeColor = "#221111" }: { cx: number, cy: number, r: number, style: 'dot' | 'happy' | 'wink' | 'star' | 'line', eyeColor?: string }) => {
    switch (style) {
        case 'dot':
            return (
                <g>
                    <circle cx={cx} cy={cy} r={r} fill={eyeColor} />
                    <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.3} fill="white" />
                </g>
            );
        case 'happy':
            return <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke={eyeColor} strokeWidth={r / 2} fill="none" strokeLinecap="round" />;
        case 'wink':
        case 'line':
            return <path d={`M ${cx - r} ${cy} L ${cx + r} ${cy}`} stroke={eyeColor} strokeWidth={r / 2} strokeLinecap="round" />;
        case 'star':
            const pts = [0, -1, 0.3, -0.3, 1, 0, 0.3, 0.3, 0, 1, -0.3, 0.3, -1, 0, -0.3, -0.3]
                .map((v, i) => (i % 2 === 0 ? cx + v * r * 1.8 : cy + v * r * 1.8)).join(',');
            return <polygon points={pts} fill="#FFD700" stroke={eyeColor} strokeWidth="1" />;
        default: return null;
    }
};

// --- PIXI Helpers ---
export const PixiDrawEye = (g: PIXI.Graphics, x: number, y: number, r: number, style: 'dot' | 'happy' | 'wink' | 'line' | 'star' | 'derp' = 'dot', eyeColor: string | number = 0x221111) => {
    if (style === 'dot') {
        g.circle(x, y, r);
        g.fill({ color: eyeColor });
        g.circle(x - r * 0.3, y - r * 0.3, r * 0.3); // shine
        g.fill({ color: 0xFFFFFF });
    } else if (style === 'happy') {
        g.arc(x, y, r, Math.PI, 0); // Arch
        g.stroke({ width: r / 2, color: eyeColor, cap: 'round' });
    } else if (style === 'wink' || style === 'line') {
        g.moveTo(x - r, y);
        g.lineTo(x + r, y);
        g.stroke({ width: r / 2, color: eyeColor, cap: 'round' });
    } else if (style === 'star') {
        g.poly([x, y - r, x + r * 0.3, y - r * 0.3, x + r, y, x + r * 0.3, y + r * 0.3, x, y + r, x - r * 0.3, y + r * 0.3, x - r, y, x - r * 0.3, y - r * 0.3]);
        g.fill({ color: 0xFFD700 });
        g.stroke({ width: 1, color: eyeColor });
    }
};
