import * as PIXI from 'pixi.js';
import { FruitTier } from '../../../types';
import { FRUIT_DEFS } from '../../../constants';

export class HUDRenderer {
    container: PIXI.Container;

    // UI Elements
    private scoreText: PIXI.Text;
    private scoreLabel: PIXI.Text;
    private timeText: PIXI.Text;
    private timeIcon: PIXI.Graphics; // Simple clock icon representation
    private lvlBadge: PIXI.Container;
    private lvlText: PIXI.Text;
    private lvlDot: PIXI.Graphics;

    // Fruit Bubbles
    private nextBubble: PIXI.Container;
    private saveBubble: PIXI.Container;

    // State for Diffing
    private currentScore: number = 0;
    private targetScore: number = 0;
    private displayScore: number = 0;

    private nextSprite: PIXI.Sprite | null = null;
    private saveSprite: PIXI.Sprite | null = null;

    private textures: Map<FruitTier, PIXI.Texture>;

    private readonly TEXT_STYLE_SCORE: PIXI.TextStyleOptions = {
        fontFamily: ['Fredoka', 'Segoe UI', 'sans-serif'],
        fontSize: 48,
        fontWeight: 'bold',
        fill: '#1a1a1a',
        align: 'left'
    };

    private readonly TEXT_STYLE_LABEL: PIXI.TextStyleOptions = {
        fontFamily: ['Fredoka', 'Segoe UI', 'sans-serif'],
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#1a1a1a',
        letterSpacing: 2
    };

    private readonly TEXT_STYLE_INFO: PIXI.TextStyleOptions = {
        fontFamily: ['Fredoka', 'Segoe UI', 'sans-serif'],
        fontSize: 20,
        fontWeight: 'bold',
        fill: '#1f2937', // gray-800
    };

    private onSwap: () => void;

    constructor(container: PIXI.Container, textures: Map<FruitTier, PIXI.Texture>, onSwap: () => void) {
        this.container = container;
        this.textures = textures;
        this.onSwap = onSwap;

        // --- Score Section (Top Left) ---
        const scoreGroup = new PIXI.Container();
        scoreGroup.position.set(20, 20); // Padding

        this.scoreLabel = new PIXI.Text({ text: 'SCORE', style: this.TEXT_STYLE_LABEL });
        this.scoreLabel.alpha = 0.8;
        scoreGroup.addChild(this.scoreLabel);

        this.scoreText = new PIXI.Text({ text: '0', style: this.TEXT_STYLE_SCORE });
        this.scoreText.position.set(0, 15);
        scoreGroup.addChild(this.scoreText);

        // Time
        this.timeIcon = new PIXI.Graphics();
        this.timeIcon.circle(0, 0, 8).stroke({ width: 2, color: 0x1f2937 });
        this.timeIcon.moveTo(0, -3).lineTo(0, 0).lineTo(2, 2).stroke({ width: 2, color: 0x1f2937 }); // Clock hands
        this.timeIcon.position.set(10, 70);
        scoreGroup.addChild(this.timeIcon);

        this.timeText = new PIXI.Text({ text: '0:00', style: this.TEXT_STYLE_INFO });
        this.timeText.position.set(25, 58);
        scoreGroup.addChild(this.timeText);

        // Level Badge
        this.lvlBadge = new PIXI.Container();
        this.lvlBadge.position.set(0, 90);

        this.lvlDot = new PIXI.Graphics();
        this.lvlDot.circle(0, 0, 8).fill(0xFF0000).stroke({ width: 2, color: 0x1f2937 });
        this.lvlDot.position.set(10, 10);
        this.lvlBadge.addChild(this.lvlDot);

        this.lvlText = new PIXI.Text({ text: 'LVL 1', style: this.TEXT_STYLE_INFO });
        this.lvlText.position.set(25, 0);
        this.lvlBadge.addChild(this.lvlText);

        scoreGroup.addChild(this.lvlBadge);

        this.container.addChild(scoreGroup);

        // --- Next/Save Bubbles (Top Right) ---
        // Aligned to Right edge. We will update positions in 'resize'.

        this.nextBubble = this.createBubble('NEXT');
        this.container.addChild(this.nextBubble);

        this.saveBubble = this.createBubble('SAVE');
        this.saveBubble.eventMode = 'static';
        this.saveBubble.cursor = 'pointer';
        this.saveBubble.on('pointerdown', () => {
            this.onSwap();
        });

        this.container.addChild(this.saveBubble);
    }

    private createBubble(label: string): PIXI.Container {
        const c = new PIXI.Container();
        const lbl = new PIXI.Text({ text: label, style: { ...this.TEXT_STYLE_LABEL, fontSize: 10, align: 'center' } });
        lbl.anchor.set(0.5, 0);
        lbl.position.set(0, -25);
        c.addChild(lbl);

        // Background Bubble
        // const bg = new PIXI.Graphics();
        // bg.roundRect(-25, -25, 50, 50, 12).fill({ color: 0xFFFFFF, alpha: 0.2 }).stroke({ width: 2, color: 0x1a1a1a });
        // c.addChild(bg);
        // Actually, NEXT is just fruit, SAVE is bubble.
        // Let's make generic container updates in update() depending on type.

        return c;
    }

    update(dt: number, currentScore: number, playTimeMs: number, maxTier: FruitTier, nextFruit: FruitTier, savedFruit: FruitTier | null) {
        // Smooth Score
        this.targetScore = currentScore;
        if (this.displayScore < this.targetScore) {
            const diff = this.targetScore - this.displayScore;
            const inc = Math.ceil(diff * 5 * dt); // Lerp-ish
            this.displayScore += inc;
            if (this.displayScore > this.targetScore) this.displayScore = this.targetScore;
            this.scoreText.text = this.displayScore.toLocaleString();
        }

        // Time
        const seconds = Math.floor(playTimeMs / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        this.timeText.text = `${m}:${s.toString().padStart(2, '0')}`;

        // Level
        const def = FRUIT_DEFS[maxTier];
        const color = def ? def.color : '#000000';
        this.lvlDot.clear().circle(0, 0, 8).fill(color).stroke({ width: 2, color: 0x1f2937 });
        this.lvlText.text = `LVL ${maxTier >= 10 ? 11 : maxTier + 1}`;

        // Next Fruit
        this.updateFruitSprite(this.nextBubble, nextFruit, 0.7);

        // Saved Fruit
        this.updateSavedBubble(savedFruit);
    }

    private updateFruitSprite(container: PIXI.Container, tier: FruitTier | null, scale: number) {
        // Clear previous sprite if tier changed
        // We reuse the container children.
        // Check if child 1 is sprite and matches tier.

        // For simplicity: Clear and redraw if changed. optimize later.
        const currentSpriteName = container.label;
        if (tier === null) {
            // Empty
            this.clearSprite(container);
            container.label = 'empty';
            return;
        }

        const newLabel = `fruit_${tier}`;
        if (container.label !== newLabel) {
            this.clearSprite(container);
            const tex = this.textures.get(tier);
            if (tex) {
                const s = new PIXI.Sprite(tex);
                s.anchor.set(0.5);
                s.scale.set(scale);
                container.addChild(s);
                container.label = newLabel;
            }
        }
    }

    private clearSprite(c: PIXI.Container) {
        // Keep the label (child 0)
        if (c.children.length > 1) {
            c.removeChildAt(1).destroy();
        }
    }

    private updateSavedBubble(tier: FruitTier | null) {
        // Draw the Box
        const g = (this.saveBubble.getChildByName('bg') as PIXI.Graphics) || new PIXI.Graphics();
        if (!g.parent) {
            g.label = 'bg';
            g.name = 'bg'; // Pixi 8
            // Start at index 0 (behind label? no label is on top usually)
            // Label is currently child 0.
            // Let's insure we have [Bg, Sprite, Label].
            this.saveBubble.addChildAt(g, 0);
        }

        g.clear();
        g.roundRect(-25, -25, 50, 50, 12)
            .fill({ color: 0xFFFFFF, alpha: 0.2 })
            .stroke({ width: 2, color: 0x1a1a1a });

        // Draw Fruit
        if (tier !== null) {
            this.updateFruitSprite(this.saveBubble, tier, 0.6);
            // Ensure Label is on top
            const lbl = this.saveBubble.getChildAt(this.saveBubble.children.length - 1); // Not reliable if we append sprite
            // Re-sort: BG (0), Sprite (1), Label (2)
            // ...
            // Let's just create "Empty" text if null
            const emptyText = this.saveBubble.getChildByName('empty') as PIXI.Text;
            if (emptyText) emptyText.visible = false;
        } else {
            this.updateFruitSprite(this.saveBubble, null, 1);
            let emptyText = this.saveBubble.getChildByName('empty') as PIXI.Text;
            if (!emptyText) {
                emptyText = new PIXI.Text({ text: 'EMPTY', style: { ...this.TEXT_STYLE_LABEL, fontSize: 8, fill: '#000000' } });
                emptyText.alpha = 0.5;
                emptyText.anchor.set(0.5);
                emptyText.name = 'empty';
                this.saveBubble.addChild(emptyText);
            }
            emptyText.visible = true;
        }
    }

    resize(width: number, height: number, scaleFactor: number, screenWidth: number, screenHeight: number) {
        // Reposition bubbles to Top Right
        // We want them inside the game area or just outside?
        // GameHUD.tsx was: "w-full h-full flex justify-between px-8"
        // It overlaid the game.
        // Let's allow them to be inside the game container top area.

        // We are inside a container that might be scaled or not.
        // If this.container is `gameContainer`, then (0,0) is top-left of game.

        // Next Bubble: Right side, aligned with score Y
        this.nextBubble.position.set(width - 40, 45);
        this.saveBubble.position.set(width - 40, 110);
    }
}
