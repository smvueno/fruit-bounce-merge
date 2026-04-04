import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const COCONUT: FruitDef = {
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
};
