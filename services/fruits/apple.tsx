import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const APPLE: FruitDef = {
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
            PixiDrawEye(eyes, -xEye, yEye, rEye, 'happy');
            PixiDrawEye(eyes, xEye, yEye, rEye, 'happy');
        }
        mouth.arc(0, yEye + rEye * 1.5, rEye * 0.8, 0.2, Math.PI - 0.2);
        mouth.stroke({ width: 3, color: 0x221111, cap: 'round' });
        container.addChild(eyes, mouth);
        return container;
    }
};
