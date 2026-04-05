import React from 'react';
import * as PIXI from 'pixi.js';
import { FruitTier, FruitDef } from './shared';

export const BOMB: FruitDef = {
    tier: FruitTier.BOMB, name: "Bomb", radius: 28, mass: 1.5, color: "#212121", patternColor: "#000000", bounciness: 0.2,
    renderSvg: (size) => {
        const r = size / 2, cx = r, cy = r;
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cy} r={r - 2} fill="#212121" stroke="#000000" strokeWidth="3" />
                {/* Fuse Cap */}
                <rect x={cx - r * 0.2} y={cy - r * 0.9} width={r * 0.4} height={r * 0.4} fill="#424242" />
                {/* Fuse String */}
                <path d={`M ${cx} ${cy - r * 0.9} Q ${cx + r * 0.3} ${cy - r * 1.2} ${cx + r * 0.5} ${cy - r * 1.4}`} stroke="#C26A28" strokeWidth="4" fill="none" strokeLinecap="round" />
                {/* Spark */}
                <circle cx={cx + r * 0.5} cy={cy - r * 1.4} r={4} fill="#FFEB3B" />
                <g>
                    {/* Mean Eyes */}
                    <path d={`M ${cx - r * 0.5} ${cy - r * 0.2} L ${cx - r * 0.1} ${cy}`} stroke="#FF4444" strokeWidth="4" strokeLinecap="round" />
                    <path d={`M ${cx + r * 0.5} ${cy - r * 0.2} L ${cx + r * 0.1} ${cy}`} stroke="#FF4444" strokeWidth="4" strokeLinecap="round" />
                    <circle cx={cx - r * 0.3} cy={cy + r * 0.1} r={r * 0.1} fill="#FF4444" />
                    <circle cx={cx + r * 0.3} cy={cy + r * 0.1} r={r * 0.1} fill="#FF4444" />
                </g>
            </svg>
        );
    },
    renderPixiBody: (c, r) => {
        const g = new PIXI.Graphics();
        g.circle(0, 0, r);
        g.fill({ color: 0x212121 });
        g.stroke({ width: 3, color: 0x000000 });

        // Fuse Cap
        const cap = new PIXI.Graphics();
        cap.rect(-r * 0.2, -r * 0.9, r * 0.4, r * 0.4);
        cap.fill({ color: 0x424242 });

        // Fuse
        const fuse = new PIXI.Graphics();
        fuse.moveTo(0, -r * 0.9);
        fuse.quadraticCurveTo(r * 0.3, -r * 1.2, r * 0.5, -r * 1.4);
        fuse.stroke({ width: 4, color: 0xC26A28, cap: 'round' });

        // Spark - keep separate for possible animation later
        const spark = new PIXI.Graphics();
        spark.circle(r * 0.5, -r * 1.4, 4);
        spark.fill({ color: 0xFFEB3B });

        c.addChild(g);
        c.addChild(cap);
        c.addChild(fuse);
        c.addChild(spark);
    },
    renderPixiFace: (r, blink?: boolean) => {
        const container = new PIXI.Container();
        const g = new PIXI.Graphics();
        // Angry Brows
        g.moveTo(-r * 0.5, -r * 0.2);
        g.lineTo(-r * 0.1, 0);
        g.stroke({ width: 4, color: 0xFF4444, cap: 'round' });

        g.moveTo(r * 0.5, -r * 0.2);
        g.lineTo(r * 0.1, 0);
        g.stroke({ width: 4, color: 0xFF4444, cap: 'round' });

        // Glowing Red Eyes
        if (blink) {
            g.moveTo(-r * 0.3 - r * 0.1, r * 0.1);
            g.lineTo(-r * 0.3 + r * 0.1, r * 0.1);
            g.stroke({ width: r * 0.06, color: 0xFF4444, cap: 'round' });
            g.moveTo(r * 0.3 - r * 0.1, r * 0.1);
            g.lineTo(r * 0.3 + r * 0.1, r * 0.1);
            g.stroke({ width: r * 0.06, color: 0xFF4444, cap: 'round' });
        } else {
            g.circle(-r * 0.3, r * 0.1, r * 0.1);
            g.fill({ color: 0xFF4444 });
            g.circle(r * 0.3, r * 0.1, r * 0.1);
            g.fill({ color: 0xFF4444 });
        }

        container.addChild(g);
        return container;
    }
};
