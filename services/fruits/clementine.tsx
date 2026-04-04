import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const CLEMENTINE: FruitDef = {
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
};
