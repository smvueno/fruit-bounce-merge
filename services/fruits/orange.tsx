import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const ORANGE: FruitDef = {
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
};
