import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye, SvgEye } from './shared';

export const PUMPKIN: FruitDef = {
    tier: FruitTier.PUMPKIN, name: "Pumpkin", radius: 130, mass: 1.0, color: "#FF7043", patternColor: "#D84315", bounciness: 0.4,
    renderSvg: (size) => {
        const r = size / 2, cx = r, cy = r;
        const yEyeOff = -r * 0.1, xEyeOff = r * 0.35, rEye = Math.max(2, r * 0.18);
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cy} r={r - 2} fill="#FF7043" stroke="#D84315" strokeWidth="2" />
                <ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r} stroke="#D84315" strokeWidth="2" strokeOpacity="0.3" fill="none" />
                <g>
                    <polygon points={`${cx - xEyeOff},${cy + yEyeOff - rEye} ${cx - xEyeOff - rEye},${cy + yEyeOff + rEye} ${cx - xEyeOff + rEye},${cy + yEyeOff + rEye}`} fill="#221111" />
                    <polygon points={`${cx + xEyeOff},${cy + yEyeOff - rEye} ${cx + xEyeOff - rEye},${cy + yEyeOff + rEye} ${cx + xEyeOff + rEye},${cy + yEyeOff + rEye}`} fill="#221111" />
                    <polygon points={`${cx - rEye * 2},${cy + yEyeOff + rEye * 2} ${cx - rEye},${cy + yEyeOff + rEye * 3} ${cx},${cy + yEyeOff + rEye * 2} ${cx + rEye},${cy + yEyeOff + rEye * 3} ${cx + rEye * 2},${cy + yEyeOff + rEye * 2}`} stroke="#221111" strokeWidth="3" fill="none" strokeLinejoin="round" />
                </g>
            </svg>
        );
    },
    renderPixiBody: (c, r) => {
        const g = new PIXI.Graphics();
        g.circle(0, 0, r);
        g.fill({ color: "#FF7043" });
        g.stroke({ width: 4, color: "#D84315", alignment: 0 });
        g.ellipse(0, 0, r * 0.5, r);
        g.stroke({ width: 2, color: "#D84315", alpha: 0.3 });
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
            eyes.poly([-xEye, yEye - rEye, -xEye - rEye, yEye + rEye, -xEye + rEye, yEye + rEye]);
            eyes.poly([xEye, yEye - rEye, xEye - rEye, yEye + rEye, xEye + rEye, yEye + rEye]);
            eyes.fill({ color: 0x221111 });
        }
        mouth.poly([-rEye * 2, yEye + rEye * 2, -rEye, yEye + rEye * 3, 0, yEye + rEye * 2, rEye, yEye + rEye * 3, rEye * 2, yEye + rEye * 2]);
        mouth.stroke({ width: 3, color: 0x221111, join: 'round' });
        container.addChild(eyes, mouth);
        return container;
    }
};
