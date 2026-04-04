import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const PINEAPPLE: FruitDef = {
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
};
