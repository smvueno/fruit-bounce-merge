import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const TOMATO: FruitDef = {
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
        g.stroke({ width: 3, color: 0x333333, alignment: 0 });
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
};
