
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
    TOMATO = 99 // Special
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
    renderPixiFace: (radius: number) => PIXI.Container;
}

// --- SVG Helpers ---
const SvgEye = ({ cx, cy, r, style, eyeColor = "#221111" }: { cx: number, cy: number, r: number, style: 'dot' | 'happy' | 'wink' | 'star' | 'line', eyeColor?: string }) => {
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
const PixiDrawEye = (g: PIXI.Graphics, x: number, y: number, r: number, style: 'dot' | 'happy' | 'wink' | 'line' | 'star' | 'derp' = 'dot', eyeColor: string | number = 0x221111) => {
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

// --- FRUIT DEFINITIONS ---
export const FRUIT_DEFS: Record<FruitTier, FruitDef> = {
    [FruitTier.CHERRY]: {
        tier: FruitTier.CHERRY, name: "Cherry", radius: 22, mass: 1.0, color: "#D32F2F", patternColor: "#B71C1C", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#D32F2F" stroke="#B71C1C" strokeWidth="2" />
                    <circle cx={cx + r * 0.3} cy={cy - r * 0.3} r={r * 0.2} fill="white" fillOpacity="0.3" />
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="dot" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="dot" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye} Q ${cx} ${cy + yEyeOff + rEye + 5} ${cx + rEye} ${cy + yEyeOff + rEye}`} stroke="#221111" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#D32F2F" });
            g.stroke({ width: 4, color: "#B71C1C", alignment: 0 });
            g.circle(r * 0.3, -r * 0.3, r * 0.2);
            g.fill({ color: 0xFFFFFF, alpha: 0.3 });
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'dot');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'dot');
            mouth.arc(0, yEye + rEye, rEye, 0.2, Math.PI - 0.2);
            mouth.stroke({ width: 2, color: 0x221111, cap: 'round' });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.STRAWBERRY]: {
        tier: FruitTier.STRAWBERRY, name: "Strawberry", radius: 32, mass: 1.0, color: "#F44336", patternColor: "#D32F2F", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#F44336" stroke="#D32F2F" strokeWidth="2" />
                    <g fill="#D32F2F">
                        <circle cx={cx - r * 0.4} cy={cy - r * 0.4} r={2} />
                        <circle cx={cx + r * 0.5} cy={cy - r * 0.3} r={2} />
                        <circle cx={cx - r * 0.2} cy={cy + r * 0.5} r={2} />
                        <circle cx={cx + r * 0.4} cy={cy + r * 0.4} r={2} />
                        <circle cx={cx - r * 0.6} cy={cy + r * 0.1} r={2} />
                    </g>
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye * 1.2} style="happy" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye * 1.2} style="happy" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 3} ${cx + rEye} ${cy + yEyeOff + rEye * 2}`} stroke="#221111" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#F44336" });
            g.stroke({ width: 4, color: "#D32F2F", alignment: 0 });
            for (let i = 0; i < 6; i++) {
                g.circle((Math.random() - 0.5) * r * 1.2, (Math.random() - 0.5) * r * 1.2, 2);
                g.fill({ color: "#D32F2F" });
            }
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye * 1.2, 'happy');
            PixiDrawEye(eyes, xEye, yEye, rEye * 1.2, 'happy');
            mouth.moveTo(-rEye, yEye + rEye * 2);
            mouth.quadraticCurveTo(0, yEye + rEye * 3, rEye, yEye + rEye * 2);
            mouth.stroke({ width: 2, color: 0x221111, cap: 'round' });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.GRAPE]: {
        tier: FruitTier.GRAPE, name: "Grape", radius: 42, mass: 1.0, color: "#7B1FA2", patternColor: "#4A148C", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#7B1FA2" stroke="#4A148C" strokeWidth="2" />
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="dot" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="dot" />
                        <circle cx={cx} cy={cy + yEyeOff + rEye * 2} r={rEye * 0.5} stroke="#221111" strokeWidth="2" fill="none" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#7B1FA2" });
            g.stroke({ width: 4, color: "#4A148C", alignment: 0 });
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'dot');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'dot');
            mouth.circle(0, yEye + rEye * 2, rEye * 0.5);
            mouth.stroke({ width: 2, color: 0x221111 });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.CLEMENTINE]: {
        tier: FruitTier.CLEMENTINE, name: "Clementine", radius: 52, mass: 1.0, color: "#FF9800", patternColor: "#EF6C00", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#FF9800" stroke="#EF6C00" strokeWidth="2" />
                    <ellipse cx={cx} cy={cy} rx={r * 0.9} ry={r * 0.8} fill="white" fillOpacity="0.1" />
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="wink" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="dot" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 1.5} A ${rEye} ${rEye} 0 0 0 ${cx + rEye} ${cy + yEyeOff + rEye * 1.5} Z`} fill="#221111" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#FF9800" });
            g.stroke({ width: 4, color: "#EF6C00", alignment: 0 });
            g.ellipse(0, 0, r * 0.9, r * 0.8);
            g.fill({ color: 0xFFFFFF, alpha: 0.1 });
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'wink');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'dot');
            mouth.arc(0, yEye + rEye * 1.5, rEye, 0, Math.PI);
            mouth.fill({ color: 0x221111 });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.ORANGE]: {
        tier: FruitTier.ORANGE, name: "Orange", radius: 65, mass: 1.0, color: "#FF5722", patternColor: "#E64A19", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#FF5722" stroke="#E64A19" strokeWidth="2" />
                    <circle cx={cx} cy={cy} r={r - 2} stroke="#E64A19" strokeWidth="4" strokeOpacity="0.5" fill="none" />
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="line" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="line" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2.5} L ${cx + rEye} ${cy + yEyeOff + rEye * 2.5}`} stroke="#221111" strokeWidth="3" strokeLinecap="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#FF5722" });
            g.stroke({ width: 4, color: "#E64A19", alignment: 0 });
            g.stroke({ width: 4, color: "#E64A19", alpha: 0.5, alignment: 1 });
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'line');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'line');
            mouth.moveTo(-rEye, yEye + rEye * 2.5);
            mouth.lineTo(rEye, yEye + rEye * 2.5);
            mouth.stroke({ width: 3, color: 0x221111, cap: 'round' });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.APPLE]: {
        tier: FruitTier.APPLE, name: "Apple", radius: 80, mass: 1.0, color: "#8BC34A", patternColor: "#689F38", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#8BC34A" stroke="#689F38" strokeWidth="2" />
                    <g>
                        <ellipse cx={cx - r * 0.3} cy={cy - r * 0.3} rx={r * 0.2} ry={r * 0.3} fill="white" fillOpacity="0.2" />
                        <path d={`M ${cx} ${cy - r * 0.8} Q ${cx + r * 0.2} ${cy - r * 1.1} ${cx + r * 0.4} ${cy - r * 0.9}`} stroke="#33691E" strokeWidth="3" fill="none" />
                    </g>
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="happy" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="happy" />
                        <path d={`M ${cx - rEye * 0.8} ${cy + yEyeOff + rEye * 1.5} Q ${cx} ${cy + yEyeOff + rEye * 2.5} ${cx + rEye * 0.8} ${cy + yEyeOff + rEye * 1.5}`} stroke="#221111" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#8BC34A" });
            g.stroke({ width: 4, color: "#689F38", alignment: 0 });
            g.ellipse(-r * 0.3, -r * 0.3, r * 0.2, r * 0.3);
            g.fill({ color: 0xFFFFFF, alpha: 0.2 });
            // Stem
            const deco = new PIXI.Graphics();
            deco.moveTo(0, -r * 0.8);
            deco.quadraticCurveTo(r * 0.2, -r * 1.1, r * 0.4, -r * 0.9);
            deco.stroke({ width: 3, color: 0x33691E });
            c.addChild(g);
            c.addChild(deco);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'happy');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'happy');
            mouth.arc(0, yEye + rEye * 1.5, rEye * 0.8, 0.2, Math.PI - 0.2);
            mouth.stroke({ width: 3, color: 0x221111, cap: 'round' });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.PINEAPPLE]: {
        tier: FruitTier.PINEAPPLE, name: "Pineapple", radius: 95, mass: 1.0, color: "#FDD835", patternColor: "#F9A825", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#FDD835" stroke="#F9A825" strokeWidth="2" />
                    <g>
                        <path d={`M ${cx - r * 0.7} ${cy - r * 0.7} L ${cx + r * 0.7} ${cy + r * 0.7}`} stroke="#F9A825" strokeWidth="2" strokeOpacity="0.5" />
                        <path d={`M ${cx + r * 0.7} ${cy - r * 0.7} L ${cx - r * 0.7} ${cy + r * 0.7}`} stroke="#F9A825" strokeWidth="2" strokeOpacity="0.5" />
                        <polygon points={`${cx - 5},${cy - r * 0.9} ${cx},${cy - r * 1.2} ${cx + 5},${cy - r * 0.9}`} fill="#4CAF50" />
                    </g>
                    <g>
                        <rect x={cx - xEyeOff - rEye * 1.5} y={cy + yEyeOff - rEye * 0.5} width={rEye * 3} height={rEye * 1.5} fill="#111" />
                        <rect x={cx + xEyeOff - rEye * 1.5} y={cy + yEyeOff - rEye * 0.5} width={rEye * 3} height={rEye * 1.5} fill="#111" />
                        <line x1={cx - xEyeOff} y1={cy + yEyeOff} x2={cx + xEyeOff} y2={cy + yEyeOff} stroke="#111" strokeWidth="2" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 3} ${cx + rEye} ${cy + yEyeOff + rEye * 2}`} stroke="#221111" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#FDD835" });
            g.stroke({ width: 4, color: "#F9A825", alignment: 0 });
            g.moveTo(-r * 0.7, -r * 0.7);
            g.lineTo(r * 0.7, r * 0.7);
            g.stroke({ width: 2, color: "#F9A825", alpha: 0.5 });
            g.moveTo(r * 0.7, -r * 0.7);
            g.lineTo(-r * 0.7, r * 0.7);
            g.stroke({ width: 2, color: "#F9A825", alpha: 0.5 });
            const deco = new PIXI.Graphics();
            deco.poly([-10, -r * 0.9, 0, -r * 1.2, 10, -r * 0.9]);
            deco.fill({ color: 0x4CAF50 });
            c.addChild(g);
            c.addChild(deco);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            eyes.rect(-xEye - rEye * 1.5, yEye - rEye * 0.5, rEye * 3, rEye * 1.5);
            eyes.rect(xEye - rEye * 1.5, yEye - rEye * 0.5, rEye * 3, rEye * 1.5);
            eyes.moveTo(-xEye, yEye);
            eyes.lineTo(xEye, yEye);
            eyes.fill({ color: 0x111111 });
            mouth.arc(0, yEye + rEye * 2, rEye, 0.2, Math.PI - 0.2);
            mouth.stroke({ width: 3, color: 0x221111, cap: 'round' });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.COCONUT]: {
        tier: FruitTier.COCONUT, name: "Coconut", radius: 110, mass: 1.0, color: "#795548", patternColor: "#4E342E", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#795548" stroke="#4E342E" strokeWidth="2" />
                    <circle cx={cx} cy={cy} r={r - 2} stroke="#4E342E" strokeWidth="4" fill="none" />
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="wink" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="wink" />
                        <circle cx={cx} cy={cy + yEyeOff + rEye * 2.5} r={rEye * 0.5} stroke="#221111" strokeWidth="2" fill="none" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#795548" });
            g.stroke({ width: 4, color: "#4E342E", alignment: 0 });
            g.stroke({ width: 4, color: "#4E342E", alignment: 1 });
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'wink');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'wink');
            mouth.circle(0, yEye + rEye * 2.5, rEye * 0.5);
            mouth.stroke({ width: 2, color: 0x221111 });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.PUMPKIN]: {
        tier: FruitTier.PUMPKIN, name: "Pumpkin", radius: 130, mass: 1.0, color: "#FF7043", patternColor: "#D84315", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#FF7043" stroke="#D84315" strokeWidth="2" />
                    <ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r} stroke="#D84315" strokeWidth="2" strokeOpacity="0.3" fill="none" />
                    <g>
                        <polygon points={`${cx - xEyeOff},${cy + yEyeOff - rEye} ${cx - xEyeOff - rEye},${cy + yEyeOff + rEye} ${cx - xEyeOff + rEye},${cy + yEyeOff + rEye}`} fill="#221111" />
                        <polygon points={`${cx + xEyeOff},${cy + yEyeOff - rEye} ${cx + xEyeOff - rEye},${cy + yEyeOff + rEye} ${cx + xEyeOff + rEye},${cy + yEyeOff + rEye}`} fill="#221111" />
                        <polygon points={`${cx - rEye * 2},${cy + yEyeOff + rEye * 2} ${cx - rEye},${cy + yEyeOff + rEye * 3} ${cx},${cy + yEyeOff + rEye * 2} ${cx + rEye},${cy + yEyeOff + rEye * 3} ${cx + rEye * 2},${cy + yEyeOff + rEye * 2}`} stroke="#221111" strokeWidth="3" fill="none" strokeLinejoin="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#FF7043" });
            g.stroke({ width: 4, color: "#D84315", alignment: 0 });
            g.ellipse(0, 0, r * 0.5, r);
            g.stroke({ width: 2, color: "#D84315", alpha: 0.3 });
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            eyes.poly([-xEye, yEye - rEye, -xEye - rEye, yEye + rEye, -xEye + rEye, yEye + rEye]);
            eyes.poly([xEye, yEye - rEye, xEye - rEye, yEye + rEye, xEye + rEye, yEye + rEye]);
            eyes.fill({ color: 0x221111 });
            mouth.poly([-rEye * 2, yEye + rEye * 2, -rEye, yEye + rEye * 3, 0, yEye + rEye * 2, rEye, yEye + rEye * 3, rEye * 2, yEye + rEye * 2]);
            mouth.stroke({ width: 3, color: 0x221111, join: 'round' });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.WATERMELON]: {
        tier: FruitTier.WATERMELON, name: "Watermelon", radius: 155, mass: 1.0, color: "#4CAF50", patternColor: "#1B5E20", bounciness: 0.4,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#4CAF50" stroke="#1B5E20" strokeWidth="2" />
                    <circle cx={cx} cy={cy} r={r * 0.9} stroke="#1B5E20" strokeWidth="6" fill="none" />
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye * 1.8} style="star" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye * 1.8} style="star" />
                        <path d={`M ${cx - rEye * 1.5} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 5} ${cx + rEye * 1.5} ${cy + yEyeOff + rEye * 2} Z`} fill="#660000" />
                        <path d={`M ${cx - rEye * 0.8} ${cy + yEyeOff + rEye * 3.5} A ${rEye * 0.8} ${rEye * 0.8} 0 0 0 ${cx + rEye * 0.8} ${cy + yEyeOff + rEye * 3.5}`} fill="#FF6666" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#4CAF50" });
            g.stroke({ width: 6, color: "#1B5E20" }); // Outer stroke
            g.arc(0, 0, r * 0.9, 0, Math.PI * 2);
            g.stroke({ width: 6, color: "#1B5E20" }); // Inner ring
            c.addChild(g);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye * 1.8, 'star');
            PixiDrawEye(eyes, xEye, yEye, rEye * 1.8, 'star');
            mouth.moveTo(-rEye * 1.5, yEye + rEye * 2);
            mouth.quadraticCurveTo(0, yEye + rEye * 5, rEye * 1.5, yEye + rEye * 2);
            mouth.lineTo(-rEye * 1.5, yEye + rEye * 2);
            mouth.fill({ color: 0x660000 });
            mouth.arc(0, yEye + rEye * 3.5, rEye * 0.8, 0, Math.PI);
            mouth.fill({ color: 0xFF6666 });
            container.addChild(eyes, mouth);
            return container;
        }
    },
    [FruitTier.TOMATO]: {
        tier: FruitTier.TOMATO, name: "Tomato", radius: 45, mass: 1.0, color: "#FF1744", patternColor: "#D50000", bounciness: 0.6,
        renderSvg: (size) => {
            const r = size / 2, cx = r, cy = r;
            const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r - 2} fill="#FF1744" stroke="#333333" strokeWidth="3" />
                    <g>
                        <circle cx={cx + r * 0.3} cy={cy - r * 0.3} r={r * 0.35} fill="white" fillOpacity="0.4" />
                        <polygon points={`${cx},${cy - r * 0.85} ${cx - r * 0.2},${cy - r * 0.7} ${cx + r * 0.2},${cy - r * 0.7}`} fill="#2E7D32" />
                    </g>
                    <g>
                        <SvgEye cx={cx - xEyeOff} cy={cy + yEyeOff} r={rEye} style="wink" />
                        <SvgEye cx={cx + xEyeOff} cy={cy + yEyeOff} r={rEye} style="wink" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 3} ${cx + rEye} ${cy + yEyeOff + rEye * 2}`} stroke="#221111" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                </svg>
            );
        },
        renderPixiBody: (c, r) => {
            const g = new PIXI.Graphics();
            g.circle(0, 0, r);
            g.fill({ color: "#FF1744" });
            g.stroke({ width: 3, color: 0x333333, alignment: 0 }); // Special dark stroke
            g.circle(r * 0.3, -r * 0.3, r * 0.35);
            g.fill({ color: 0xFFFFFF, alpha: 0.4 });
            const deco = new PIXI.Graphics();
            deco.star(0, -r * 0.85, 5, r * 0.35, r * 0.15, 0);
            deco.fill({ color: 0x2E7D32 });
            c.addChild(g);
            c.addChild(deco);
        },
        renderPixiFace: (r) => {
            const container = new PIXI.Container();
            const eyes = new PIXI.Graphics();
            const mouth = new PIXI.Graphics();
            const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
            PixiDrawEye(eyes, -xEye, yEye, rEye * 1.5, 'wink');
            PixiDrawEye(eyes, xEye, yEye, rEye * 1.5, 'wink');
            mouth.moveTo(-rEye, yEye + rEye * 2);
            mouth.quadraticCurveTo(0, yEye + rEye * 3, rEye, yEye + rEye * 2);
            mouth.stroke({ width: 2, color: 0x221111 });
            container.addChild(eyes, mouth);
            return container;
        }
    }
};
