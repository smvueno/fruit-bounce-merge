import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const WATERMELON: FruitDef = {
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
        g.stroke({ width: 6, color: "#1B5E20" });
        g.arc(0, 0, r * 0.9, 0, Math.PI * 2);
        g.stroke({ width: 6, color: "#1B5E20" });
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
};
