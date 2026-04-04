import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef, PixiDrawEye } from './shared';

export const RAINBOW: FruitDef = {
    tier: FruitTier.RAINBOW, name: "Rainbow Star", radius: 42, mass: 1.0, color: "#FFFFFF", patternColor: "#EEEEEE", bounciness: 0.5,
    renderSvg: (size) => {
        const r = size / 2, cx = r, cy = r;
        // Generate 5-point star
        const points = [];
        const outerR = r * 0.95;
        const innerR = r * 0.4;
        for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI) / 5 - Math.PI / 2;
            const rad = i % 2 === 0 ? outerR : innerR;
            points.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`);
        }
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke="#FFD700" strokeWidth="3" strokeOpacity="0.8" />
                <polygon points={points.join(' ')} fill="#FFD700" />
            </svg>
        );
    },
    renderPixiBody: (c, r) => {
        const g = new PIXI.Graphics();
        // Hit area (transparent fill to ensure clicks work if needed, though physics handles collisions)
        g.circle(0, 0, r);
        g.fill({ color: 0xFFD700, alpha: 0.05 }); // Tiny alpha for substance
        g.stroke({ width: 4, color: 0xFFD700, alpha: 0.8 }); // Halo effect

        // Star
        const star = new PIXI.Graphics();
        star.star(0, 0, 5, r * 0.95, r * 0.4, 0); // 5 points, touching edge
        star.fill({ color: 0xFFD700 });
        c.addChild(g);
        c.addChild(star);
    },
    renderPixiFace: (r) => {
        // Rainbow star might not have a face, or a very simple one? Let's give it a happy face
        const container = new PIXI.Container();
        const eyes = new PIXI.Graphics();
        const mouth = new PIXI.Graphics();
        const yEye = -r * 0.1, xEye = r * 0.35, rEye = Math.max(3, r * 0.18);
        PixiDrawEye(eyes, -xEye, yEye, rEye, 'star', 0x333333);
        PixiDrawEye(eyes, xEye, yEye, rEye, 'star', 0x333333);
        mouth.arc(0, yEye + rEye * 1.5, rEye * 0.8, 0.2, Math.PI - 0.2);
        mouth.stroke({ width: 3, color: 0x333333, cap: 'round' });
        container.addChild(eyes, mouth);
        return container;
    }
};
