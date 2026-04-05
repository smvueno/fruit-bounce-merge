import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const STRAWBERRY: FruitDef = {
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
    renderPixiFace: (r, blink?: boolean) => {
        const container = new PIXI.Container();
        const eyes = new PIXI.Graphics();
        const mouth = new PIXI.Graphics();
        const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
        const eR = rEye * 1.2;
        if (blink) {
            eyes.moveTo(-xEye - eR, yEye);
            eyes.lineTo(-xEye + eR, yEye);
            eyes.stroke({ width: eR * 0.6, color: 0x221111, cap: 'round' });
            eyes.moveTo(xEye - eR, yEye);
            eyes.lineTo(xEye + eR, yEye);
            eyes.stroke({ width: eR * 0.6, color: 0x221111, cap: 'round' });
        } else {
            PixiDrawEye(eyes, -xEye, yEye, eR, 'happy');
            PixiDrawEye(eyes, xEye, yEye, eR, 'happy');
        }
        mouth.moveTo(-rEye, yEye + rEye * 2);
        mouth.quadraticCurveTo(0, yEye + rEye * 3, rEye, yEye + rEye * 2);
        mouth.stroke({ width: 2, color: 0x221111, cap: 'round' });
        container.addChild(eyes, mouth);
        return container;
    }
};
