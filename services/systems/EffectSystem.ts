import { FruitTier } from '../../types';
import { EffectParticle, Particle, TomatoEffect } from '../../types/GameObjects';

export interface EffectContext {
    fruits: Particle[];
    activeTomatoes: TomatoEffect[];
    currentFruit: Particle | null;
    feverActive: boolean;
    width: number;
    height: number;
}

export class EffectSystem {
    visualParticles: EffectParticle[] = [];

    reset() {
        this.visualParticles = [];
    }

    spawnPassiveTomatoParticle(x: number, y: number, radius: number) {
        if (Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const r = radius * (0.8 + Math.random() * 0.3);
            const sx = x + Math.cos(angle) * r;
            const sy = y + Math.sin(angle) * r;

            const part = new EffectParticle(sx, sy, 0xFF6347, 'circle');
            // MUCH slower drift (buggy fast issue fix)
            part.vx = Math.cos(angle) * 0.1;
            part.vy = Math.sin(angle) * 0.1 - 0.1;
            part.life = 1.0;
            part.size = 1 + Math.random() * 2; // Start smaller, expand later
            part.alpha = 0.5;
            this.visualParticles.push(part);
        }
    }

    spawnTrailParticles(x: number, y: number, radius: number, parentVx: number, parentVy: number) {
        // "Poppy" trail logic
        for (let i = 0; i < 2; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius * 0.5;
            const px = x + Math.cos(angle) * r;
            const py = y + Math.sin(angle) * r;

            const part = new EffectParticle(px, py, 0xFF6347, 'circle');
            // Inherit 20% of parent velocity for "follow along" + small random drift
            part.vx = (parentVx * 0.2) + (Math.random() - 0.5) * 0.5;
            part.vy = (parentVy * 0.2) + (Math.random() - 0.5) * 0.5;
            part.life = 0.6; // Short life
            part.size = 3 + Math.random() * 3;
            part.alpha = 0.8;
            this.visualParticles.push(part);
        }
    }

    createMergeEffect(x: number, y: number, color: string | number) {
        for (let i = 0; i < 15; i++) {
            const p = new EffectParticle(x, y, color, Math.random() > 0.5 ? 'circle' : 'star');
            const angle = Math.random() * Math.PI * 2;
            const force = Math.random() * 10 + 5;
            p.vx = Math.cos(angle) * force;
            p.vy = Math.sin(angle) * force;
            this.visualParticles.push(p);
        }
    }

    createGhostEffect(x: number, y: number, size: number) {
        const ghost = new EffectParticle(x, y, 0x212121, 'bomb-ghost');
        ghost.size = size;
        ghost.life = 1.0;
        ghost.alpha = 0.8;
        this.visualParticles.push(ghost);
    }

    addParticle(p: EffectParticle) {
        this.visualParticles.push(p);
    }

    update(dt: number, ctx: EffectContext) {
        const activeTomatoes = ctx.activeTomatoes;
        const hasActive = activeTomatoes.length > 0;

        // 1. SPAWN PARTICLES

        // A. Active Tomato "Event Horizon" Spawning
        if (hasActive) {
            if (this.visualParticles.filter(p => p.type === 'suck').length < 300) {
                for (const t of activeTomatoes) {
                    for (let i = 0; i < 3; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spawnR = 180 + Math.random() * 40;
                        const px = t.x + Math.cos(angle) * spawnR;
                        const py = t.y + Math.sin(angle) * spawnR;

                        const p = new EffectParticle(px, py, 0xFF4444, 'suck');
                        p.targetId = t.tomatoId;
                        p.life = 1.0;
                        p.size = 3 + Math.random() * 3;
                        p.alpha = 0; // Fade in
                        this.visualParticles.push(p);
                    }
                }
            }
        }

        // B. Passive Particles & Trails (Existing Fruits)
        for (const p of ctx.fruits) {
            if (p.isCaught) continue;

            // 1. Passive Particles (Floating around)
            if (p.tier === FruitTier.TOMATO) {
                this.spawnPassiveTomatoParticle(p.x, p.y, p.radius);
            } else if (p.tier === FruitTier.RAINBOW) {
                if (Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = p.radius * (0.8 + Math.random() * 0.4);
                    const px = p.x + Math.cos(angle) * r;
                    const py = p.y + Math.sin(angle) * r;
                    const color = Math.random() > 0.5 ? 0xFFD700 : 0xFFA500;
                    const part = new EffectParticle(px, py, color, Math.random() > 0.7 ? 'star' : 'circle');
                    part.vx = Math.cos(angle) * 0.2;
                    part.vy = Math.sin(angle) * 0.2 - 0.2;
                    part.life = 1.2;
                    part.size = 2 + Math.random() * 3;
                    part.alpha = 0.6;
                    this.visualParticles.push(part);
                }
            }

            // 2. Trails (Moving fast)
            if (!p.isStatic) {
                const speedSq = p.vx * p.vx + p.vy * p.vy;
                if (speedSq > 25) { // speed > 5
                    if (p.tier === FruitTier.TOMATO || p.tier === FruitTier.RAINBOW) {
                        this.spawnTrailParticles(p.x, p.y, p.radius, p.vx, p.vy);
                    }
                }
            }
        }

        // C. Current Fruit Passive Particles
        if (ctx.currentFruit) {
            if (ctx.currentFruit.tier === FruitTier.TOMATO) {
                this.spawnPassiveTomatoParticle(ctx.currentFruit.x, ctx.currentFruit.y, ctx.currentFruit.radius);
            } else if (ctx.currentFruit.tier === FruitTier.RAINBOW) {
                if (Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = ctx.currentFruit.radius * 1.2;
                    const px = ctx.currentFruit.x + Math.cos(angle) * r;
                    const py = ctx.currentFruit.y + Math.sin(angle) * r;
                    const color = Math.random() > 0.5 ? 0xFFD700 : 0xFFA500;
                    const part = new EffectParticle(px, py, color, Math.random() > 0.7 ? 'star' : 'circle');
                    part.vx = Math.cos(angle) * 0.2;
                    part.vy = Math.sin(angle) * 0.2 - 0.2;
                    part.life = 1.0; // shorter life for aimed fruit
                    part.size = 3 + Math.random() * 3;
                    part.alpha = 0.8;
                    this.visualParticles.push(part);
                }
            }
        }

        // D. Fever Particles
        if (ctx.feverActive) {
            if (Math.random() < 0.3) {
                const sparkle = new EffectParticle(Math.random() * ctx.width, ctx.height + 20, 0xFFD700, 'star');
                sparkle.vy = -Math.random() * 2 - 2;
                sparkle.vx = (Math.random() - 0.5) * 1;
                this.visualParticles.push(sparkle);
            }
        }

        // 2. UPDATE PARTICLES
        for (let i = this.visualParticles.length - 1; i >= 0; i--) {
            const p = this.visualParticles[i];
            let targetTomato: TomatoEffect | null = null;

            // Find associated tomato for 'suck' particles
            if (p.type === 'suck' && hasActive && p.targetId !== undefined) {
                targetTomato = activeTomatoes.find(t => t.tomatoId === p.targetId) || null;
                if (!targetTomato) {
                    this.visualParticles.splice(i, 1);
                    continue;
                }
            }

            if (targetTomato) {
                // --- EVENT HORIZON MODE ---
                const dx = p.x - targetTomato.x;
                const dy = p.y - targetTomato.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const currentAngle = Math.atan2(dy, dx);

                if (dist < 20) {
                    this.visualParticles.splice(i, 1);
                    continue;
                }

                const radialSpeed = 3 + (200 / (dist + 10));
                const tangentialSpeed = 0.15;

                const nextAngle = currentAngle + tangentialSpeed;
                const nextRadius = dist - radialSpeed;

                p.x = targetTomato.x + Math.cos(nextAngle) * nextRadius;
                p.y = targetTomato.y + Math.sin(nextAngle) * nextRadius;
                p.color = 0xFF0000;
                if (p.alpha < 1.0) p.alpha += 0.05;

            } else {
                // --- PASSIVE / STANDARD MODE ---
                if (p.type === 'bomb-ghost') {
                    p.size += 4;
                    p.alpha -= 0.04;
                    p.life -= 0.04;
                } else {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= dt;

                    if (p.type === 'circle') {
                        p.alpha = Math.min(0.6, p.life);
                        p.vx *= 0.96;
                        p.vy *= 0.96;
                        if (p.life > 0.5) p.size += 0.05;
                    } else if (p.type === 'star') {
                        p.alpha = Math.min(1, p.life);
                        p.rotation += 0.1;
                    } else if (p.type === 'suck') {
                        p.life = 0; // Orphaned suck particle
                    }
                }

                if (p.life <= 0 || p.alpha <= 0 || p.y < -100 || p.y > ctx.height + 100) {
                    this.visualParticles.splice(i, 1);
                }
            }
        }
    }
}
