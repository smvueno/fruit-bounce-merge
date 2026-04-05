import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const CHERRY: FruitDef = {
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
        mouth.arc(0, yEye + rEye, rEye, 0.2, Math.PI - 0.2);
        mouth.stroke({ width: 2, color: 0x221111, cap: 'round' });
        container.addChild(eyes, mouth);
        return container;
    }
};
