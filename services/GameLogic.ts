import { Particle, TomatoEffect, BombEffect, CelebrationState } from '../types/GameObjects';
import { FruitTier, PopUpType } from '../types';
import { FRUIT_DEFS, SCORE_BASE_MERGE, SPAWN_Y_PERCENT } from '../constants';
import { GameEngine } from './GameEngine';

export class GameLogic {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    merge(p1: Particle, p2: Particle) {
        let nextTier: number;

        // Secret: two bombs merge into a Watermelon
        if (p1.tier === FruitTier.BOMB && p2.tier === FruitTier.BOMB) {
            nextTier = FruitTier.WATERMELON;
        } else if (p1.tier === FruitTier.RAINBOW && p2.tier === FruitTier.RAINBOW) {
            nextTier = FruitTier.WATERMELON;
        } else if (p1.tier === FruitTier.RAINBOW) {
            nextTier = p2.tier + 1;
        } else if (p2.tier === FruitTier.RAINBOW) {
            nextTier = p1.tier + 1;
        } else {
            nextTier = p1.tier + 1;
        }

        if (nextTier > FruitTier.WATERMELON) nextTier = FruitTier.WATERMELON;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // 1. Calculate Score via ScoreController
        const mergePoints = this.engine.scoreController.handleMerge({ tier: nextTier });
        this.engine.didMergeThisTurn = true;

        // 2. Sync Stats (Handled by Callbacks)
        this.engine.stats.bestCombo = Math.max(this.engine.stats.bestCombo, this.engine.scoreController.getChainCount());

        // 3. Emit Events
        this.engine.onPointEvent({
            x: midX,
            y: midY,
            points: mergePoints,
            tier: nextTier
        });

        this.engine.removeParticle(p1);
        this.engine.removeParticle(p2);

        const nextDef = FRUIT_DEFS[nextTier as FruitTier];
        const newP = new Particle(midX, midY, nextDef, this.engine.nextId++);
        this.engine.fruits.push(newP);
        this.engine.renderSystem.createSprite(newP);

        this.engine.effectSystem.createMergeEffect(midX, midY, nextDef.color);
        this.engine.audio.playMergeSound(nextTier);
        this.applyShockwave(midX, midY, 150, 5);
        if (this.engine.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(20);
    }

    handleTomatoCollision(p1: Particle, p2: Particle) {
        const tomato = p1.tier === FruitTier.TOMATO ? p1 : p2;
        const victim = p1.tier === FruitTier.TOMATO ? p2 : p1;
        if (victim.tier === FruitTier.TOMATO) return;
        if (tomato.cooldownTimer > 0) return;
        const existing = this.engine.activeTomatoes.find(t => t.tomatoId === tomato.id);
        if (existing) return;
        const effect = new TomatoEffect(tomato.id, tomato.x, tomato.y, victim.tier);
        this.engine.activeTomatoes.push(effect);
        tomato.isStatic = true;
        tomato.vx = 0;
        tomato.vy = 0;
        tomato.y = Math.max(tomato.radius, tomato.y - 50);
    }

    handleBombExplosion(bomb: Particle) {
        const existing = this.engine.activeBombs.find(b => b.bombId === bomb.id);
        if (existing) return;

        const effect = new BombEffect(bomb.id, bomb.x, bomb.y);
        this.engine.activeBombs.push(effect);

        this.engine.audio.playMergeSound(FruitTier.CHERRY);
        if (this.engine.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(30);
    }

    prepareEffectConclusion(
        effectParticle: Particle | undefined,
        fallbackX: number,
        fallbackY: number,
        onRemove?: () => void
    ): { releaseX: number; releaseY: number } {
        let releaseX = fallbackX;
        let releaseY = fallbackY;

        if (effectParticle) {
            releaseX = effectParticle.x;
            releaseY = effectParticle.y;
            this.engine.removeParticle(effectParticle);
            if (onRemove) onRemove();
        }

        return { releaseX, releaseY };
    }

    concludeTomatoEffect(effect: TomatoEffect) {
        const tomato = this.engine.fruits.find(p => p.id === effect.tomatoId);
        const { releaseX, releaseY } = this.prepareEffectConclusion(
            tomato,
            effect.x,
            effect.y,
            () => this.engine.stats.tomatoUses++
        );

        for (const id of effect.capturedIds) {
            const p = this.engine.fruits.find(f => f.id === id);
            if (p) {
                p.isCaught = false;
                p.ignoreCollisions = false;
                p.scaleX = 1;
                p.scaleY = 1;
                p.alpha = 1;
                p.cooldownTimer = 0.8;
                p.x = releaseX + (Math.random() - 0.5) * 5;
                p.y = releaseY + (Math.random() - 0.5) * 5;
                const angle = Math.random() * Math.PI * 2;
                const force = 5;
                p.vx = Math.cos(angle) * force;
                p.vy = Math.sin(angle) * force - 3;
            }
        }

        this.engine.effectSystem.createMergeEffect(releaseX, releaseY, "#FF4444");
        this.applyShockwave(releaseX, releaseY, 600, 40);
        this.engine.audio.playMergeSound(FruitTier.WATERMELON);

        if (this.engine.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([50, 50]);
    }

    concludeBombEffect(effect: BombEffect) {
        const bomb = this.engine.fruits.find(p => p.id === effect.bombId);
        const { releaseX, releaseY } = this.prepareEffectConclusion(
            bomb,
            effect.x,
            effect.y
        );

        this.engine.effectSystem.createGhostEffect(releaseX, releaseY, 28);

        for (const id of effect.capturedIds) {
            const p = this.engine.fruits.find(f => f.id === id);
            if (!p) continue;

            const tier = p.tier;
            let targetTier: number;
            let spawnCount: number;

            if (tier >= 3) {
                targetTier = tier - 3;
                spawnCount = 6;
            } else if (tier === 2) {
                targetTier = 0;
                spawnCount = 4;
            } else if (tier === 1) {
                targetTier = 0;
                spawnCount = 2;
            } else {
                this.engine.removeParticle(p);
                continue;
            }

            targetTier = Math.max(0, Math.min(targetTier, tier));
            const fruitX = p.x;
            const fruitY = p.y;
            const fruitColor = FRUIT_DEFS[p.tier]?.color || '#FF6347';

            this.engine.removeParticle(p);

            const targetDef = FRUIT_DEFS[targetTier as FruitTier];
            if (targetDef) {
                for (let i = 0; i < spawnCount; i++) {
                    const newP = new Particle(fruitX, fruitY, targetDef, this.engine.nextId++);

                    const angle = (i / spawnCount) * Math.PI * 2 + Math.random() * 0.3;
                    const force = 5 + Math.random() * 3;
                    newP.vx = Math.cos(angle) * force;
                    newP.vy = Math.sin(angle) * force - 3;
                    newP.cooldownTimer = 1.5;

                    this.engine.fruits.push(newP);
                    this.engine.renderSystem.createSprite(newP);
                }
            }
            this.engine.effectSystem.createMergeEffect(fruitX, fruitY, fruitColor);
        }

        this.engine.effectSystem.createMergeEffect(releaseX, releaseY, "#212121");
        this.applyShockwave(releaseX, releaseY, 600, 40);
        this.engine.audio.playMergeSound(FruitTier.WATERMELON);
        this.engine.audio.playBombShrapnel();

        if (this.engine.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }

    triggerCelebration(p1: Particle, p2: Particle) {
        if (this.engine.celebrationEffect) return;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        this.engine.removeParticle(p1);
        this.engine.removeParticle(p2);

        this.engine.effectSystem.createMergeEffect(midX, midY, "#4CAF50");
        this.applyShockwave(midX, midY, 600, 50);
        this.engine.audio.playMergeSound(FruitTier.WATERMELON);

        const capturedIds: number[] = [];
        for (const p of this.engine.fruits) {
            if (p.isStatic) continue;

            p.isCaught = true;
            p.ignoreCollisions = true;
            capturedIds.push(p.id);
        }

        this.engine.celebrationEffect = new CelebrationState(midX, midY, capturedIds);
        this.engine.celebrationEffect.phase = 'suck';
        this.engine.celebrationEffect.timer = 0;

        this.engine.onCelebration();

        if (this.engine.stats.maxTier < 10) {
            this.engine.stats.maxTier = 10 as FruitTier;
            this.engine.onMaxFruit(this.engine.stats.maxTier);
        }

        this.engine.scoreController.handleCelebration({ points: 5000 });

        this.engine.onPopupUpdate({
            type: this.engine.scoreController.isFever() ? PopUpType.FRENZY : PopUpType.WATERMELON_CRUSH,
            runningTotal: 0,
            multiplier: 1
        });
    }

    updateCelebrationLogic(dtMs: number) {
        if (!this.engine.celebrationEffect) return;

        const state = this.engine.celebrationEffect;
        state.timer += dtMs;

        if (state.phase === 'suck') {
            let allArrived = true;
            const targetY = this.engine.height * SPAWN_Y_PERCENT;

            for (const id of state.capturedIds) {
                const p = this.engine._fruitsById.get(id);
                if (!p) continue;
                if (Math.abs(p.y - targetY) > 50) {
                    allArrived = false;
                }
            }

            if (allArrived || state.timer > 3000) {
                state.phase = 'pop';
                state.timer = 0;
                state.popTimer = 0;
                state.popIndex = 0;
            }
        } else if (state.phase === 'pop') {
            const POP_INTERVAL = 100; // ms between pops
            state.popTimer += dtMs;

            if (state.popTimer >= POP_INTERVAL) {
                state.popTimer -= POP_INTERVAL;

                if (state.popIndex < state.capturedIds.length) {
                    const id = state.capturedIds[state.popIndex];
                    state.popIndex++;

                    const p = this.engine._fruitsById.get(id);
                    if (p) {
                        const tier = p.tier;

                        const safeTier = (tier > FruitTier.WATERMELON) ? FruitTier.WATERMELON : tier;

                        let points = (SCORE_BASE_MERGE * Math.pow(2, safeTier) * 2);

                        this.engine.scoreController.handleCelebration({ points: points });

                        this.engine.effectSystem.createMergeEffect(p.x, p.y, FRUIT_DEFS[tier].color);
                        this.engine.audio.playMergeSound(tier);
                        if (this.engine.settings.hapticsEnabled && navigator.vibrate) navigator.vibrate(10);

                        this.engine.removeParticle(p);
                    }

                    if (state.popIndex >= state.capturedIds.length) {
                        this.engine.celebrationEffect = null;
                        this.engine.audio.playBombShrapnel();
                    }
                } else {
                    this.engine.celebrationEffect = null;
                }
            }
        }
    }

    applyShockwave(x: number, y: number, radius: number, force: number) {
        const radiusSq = radius * radius;
        for (const p of this.engine.fruits) {
            const dx = p.x - x;
            const dy = p.y - y;
            const distSq = dx * dx + dy * dy;
            if (distSq < radiusSq && distSq > 0) {
                const d = Math.sqrt(distSq);
                const factor = 1 - d / radius;
                p.vx += (dx / d) * force * factor;
                p.vy += (dy / d) * force * factor;
            }
        }
    }
}
