import * as PIXI from 'pixi.js';
import { FruitTier } from '../../../types';
import { FRUIT_DEFS } from '../../../constants';

interface FloatingText {
    text: PIXI.Text;
    active: boolean;
    life: number;
    maxLife: number;
    startX: number;
    startY: number;
    targetY: number;
    tier: number;
}

export class FloatingTextRenderer {
    container: PIXI.Container;
    pool: FloatingText[] = [];
    activeTexts: FloatingText[] = [];

    // Style configuration to match CSS "Fredoka", White Fill, Black Stroke
    private readonly baseStyle: PIXI.TextStyleOptions = {
        fontFamily: ['Fredoka', 'Segoe UI', 'sans-serif'],
        fill: '#ffffff',
        stroke: { color: '#000000', width: 6, join: 'round' }, // Thick black outline
        fontWeight: '900',
        dropShadow: {
            alpha: 0.5,
            angle: Math.PI / 4,
            blur: 0,
            color: '#000000',
            distance: 2,
        },
        padding: 5
    };

    constructor(container: PIXI.Container) {
        this.container = container;
    }

    spawn(x: number, y: number, points: number, tier: FruitTier) {
        let ft = this.pool.find(t => !t.active);

        if (!ft) {
            const textObj = new PIXI.Text({ text: '', style: this.baseStyle });
            textObj.anchor.set(0.5);
            this.container.addChild(textObj);

            ft = {
                text: textObj,
                active: true,
                life: 0,
                maxLife: 0.8, // 800ms match
                startX: 0,
                startY: 0,
                targetY: 0,
                tier: 0
            };
            this.pool.push(ft);
        }

        ft.active = true;
        ft.life = 0;
        ft.startX = x;
        ft.startY = y;
        ft.targetY = y - 60; // Float up 60px
        ft.tier = tier;

        // Setup Text Content
        ft.text.text = `+${points}`;

        // Determine Color based on Tier (similar to PointTicker logic)
        const fruitDef = FRUIT_DEFS[tier];
        const textColor = fruitDef ? fruitDef.patternColor : '#ffffff';
        ft.text.style.fill = textColor;

        // Initial State
        ft.text.visible = true;
        ft.text.alpha = 0;
        ft.text.position.set(x, y + 10);
        ft.text.scale.set(0.5); // Start small

        this.activeTexts.push(ft);
    }

    update(dt: number) { // dt is in seconds
        for (let i = this.activeTexts.length - 1; i >= 0; i--) {
            const ft = this.activeTexts[i];
            ft.life += dt;

            if (ft.life >= ft.maxLife) {
                // Kill
                ft.active = false;
                ft.text.visible = false;
                this.activeTexts.splice(i, 1);
                continue;
            }

            // Animation Logic (Replicating @keyframes float-fade)
            // 0% (0.0): opacity 0, scale 0.5, y+10
            // 20% (0.16): opacity 1, scale 1.2, y+0
            // 40% (0.32): scale 1.0
            // 100% (0.8): opacity 0, scale 1.0, y-60

            const progress = ft.life / ft.maxLife; // 0.0 to 1.0

            // Base Scale based on Tier
            // Tier 0 (Cherry) -> 0.8 to Tier 10 -> 2.5
            const baseScale = 0.8 + (ft.tier * 0.15);

            if (progress < 0.2) {
                // Entry Phase
                const p = progress / 0.2; // 0 to 1
                // Ease out
                const ease = 1 - Math.pow(1 - p, 3);

                ft.text.alpha = ease;
                const currentScale = 0.5 + (0.7 * ease); // 0.5 -> 1.2
                ft.text.scale.set(currentScale * baseScale);

                // Y: startY + 10 -> startY
                ft.text.y = ft.startY + 10 - (10 * ease);

            } else if (progress < 0.4) {
                // Settle Phase (Scale 1.2 -> 1.0)
                const p = (progress - 0.2) / 0.2; // 0 to 1
                const currentScale = 1.2 - (0.2 * p);
                ft.text.scale.set(currentScale * baseScale);
                ft.text.y = ft.startY; // Hold at startY
                ft.text.alpha = 1;

            } else {
                // Float Up & Fade Phase
                const p = (progress - 0.4) / 0.6; // 0 to 1
                // Ease In for Fade out? Or Linear. CSS says ease-out for whole thing.

                ft.text.scale.set(1.0 * baseScale);

                // Float up to targetY
                // Lerp from startY to targetY
                ft.text.y = ft.startY + (ft.targetY - ft.startY) * p;

                // Fade out near end
                if (p > 0.7) {
                    const fadeP = (p - 0.7) / 0.3;
                    ft.text.alpha = 1 - fadeP;
                } else {
                    ft.text.alpha = 1;
                }
            }
        }
    }
}
