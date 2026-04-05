import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const GRAPE: FruitDef = {
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
    renderPixiFace: (r, blink?: boolean) => {
        const container = new PIXI.Container();
        const eyes = new PIXI.Graphics();
        const mouth = new PIXI.Graphics();
        const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
        if (blink) {
            eyes.moveTo(-xEye - rEye, yEye);
            eyes.lineTo(-xEye + rEye, yEye);
            eyes.stroke({ width: rEye * 0.6, color: 0x221111, cap: 'round' });
            eyes.moveTo(xEye - rEye, yEye);
            eyes.lineTo(xEye + rEye, yEye);
            eyes.stroke({ width: rEye * 0.6, color: 0x221111, cap: 'round' });
        } else {
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'dot');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'dot');
        }
        mouth.circle(0, yEye + rEye * 2, rEye * 0.5);
        mouth.stroke({ width: 2, color: 0x221111 });
        container.addChild(eyes, mouth);
        return container;
    }
};
