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

// Optimization: Detect mobile once at class load time
const _effectIsMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
// Mobile: 150 max particles total / 150 max suck; Desktop: 400 / 300
const MAX_PARTICLES = _effectIsMobile ? 150 : 400;
const MAX_SUCK_PARTICLES = _effectIsMobile ? 150 : 300;
// Mobile: 8 particles per merge burst; Desktop: 15
const MERGE_PARTICLE_COUNT = _effectIsMobile ? 8 : 15;

export class EffectSystem {
    visualParticles: EffectParticle[] = [];
    // Optimization: Persistent Map to avoid O(N) fruit lookups inside particle loop every frame
    private _fruitMap: Map<number, Particle> = new Map();
    // Optimization: Persistent Map for tomato lookup (replaces O(N) find() in hot particle loop)
    private _tomatoMap: Map<number, TomatoEffect> = new Map();
    // Optimization: Track suck particle count directly instead of .filter() every frame
    private _suckCount: number = 0;

    reset() {
        this.visualParticles = [];
        this._suckCount = 0;
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
        // Optimization: Fewer particles on mobile (8 vs 15) — still satisfying but ~47% less GPU work
        for (let i = 0; i < MERGE_PARTICLE_COUNT; i++) {
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

        // Optimization: Build O(1) fruit lookup map once per frame instead of O(N) find() per particle
        this._fruitMap.clear();
        for (const f of ctx.fruits) {
            this._fruitMap.set(f.id, f);
        }

        // Optimization: Build O(1) tomato lookup map — replaces O(N) find() inside particle loop
        this._tomatoMap.clear();
        for (const t of activeTomatoes) {
            this._tomatoMap.set(t.tomatoId, t);
        }

        // 1. SPAWN PARTICLES

        // A. Active Tomato "Event Horizon" Spawning
        // Optimization: Use _suckCount instead of .filter() every frame
        if (hasActive) {
            if (this._suckCount < MAX_SUCK_PARTICLES) {
                for (const t of activeTomatoes) {
                    const tomatoParticle = this._fruitMap.get(t.tomatoId);
                    const centerX = tomatoParticle ? tomatoParticle.x : t.x;
                    const centerY = tomatoParticle ? tomatoParticle.y : t.y;

                    for (let i = 0; i < 3; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spawnR = 180 + Math.random() * 40;
                        const px = centerX + Math.cos(angle) * spawnR;
                        const py = centerY + Math.sin(angle) * spawnR;

                        const p = new EffectParticle(px, py, 0xFF4444, 'suck');
                        p.targetId = t.tomatoId;
                        p.life = 1.0;
                        p.size = 3 + Math.random() * 3;
                        p.alpha = 0; // Fade in
                        this.visualParticles.push(p);
                        this._suckCount++;
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
            // Optimization: Halve spawn rate on mobile — fever sparkles are decorative
            const feverSpawnChance = _effectIsMobile ? 0.15 : 0.3;
            if (Math.random() < feverSpawnChance) {
                const sparkle = new EffectParticle(Math.random() * ctx.width, ctx.height + 20, 0xFFD700, 'star');
                sparkle.vy = -Math.random() * 2 - 3; // Slightly faster upward (-3 to -5)
                sparkle.vx = (Math.random() - 0.5) * 1;
                sparkle.life = 5.0; // Last long enough to go up the whole screen
                this.visualParticles.push(sparkle);
            }
        }

        // Optimization: Hard cap on total particles — if we exceed MAX_PARTICLES, cull oldest
        // (oldest = front of array, since we swap-remove from back on death)
        // We skip culling during normal play but kick in under stress (bomb explosion, etc.)
        if (this.visualParticles.length > MAX_PARTICLES) {
            const excess = this.visualParticles.length - MAX_PARTICLES;
            // Remove from front (oldest particles first) — splice is O(N) but this is rare
            for (let ci = 0; ci < excess; ci++) {
                const removed = this.visualParticles.shift();
                if (removed && removed.type === 'suck') this._suckCount--;
            }
        }

        // 2. UPDATE PARTICLES
        // Optimization: Forward loop with swap-remove (O(1) per deletion vs O(N) splice)
        // Optimization: Use pre-built _fruitMap for O(1) tomato lookup instead of O(N) find()
        let i = 0;
        while (i < this.visualParticles.length) {
            const p = this.visualParticles[i];
            let targetTomato: TomatoEffect | null = null;
            let shouldRemove = false;

            // Find associated tomato for 'suck' particles — O(1) Map lookup (was O(N) find())
            if (p.type === 'suck' && hasActive && p.targetId !== undefined) {
                targetTomato = this._tomatoMap.get(p.targetId) || null;
                if (!targetTomato) {
                    shouldRemove = true;
                }
            }

            if (!shouldRemove && targetTomato) {
                // --- EVENT HORIZON MODE ---
                // Optimization: O(1) Map lookup instead of O(N) find()
                const tomatoParticle = this._fruitMap.get(targetTomato.tomatoId);
                const centerX = tomatoParticle ? tomatoParticle.x : targetTomato.x;
                const centerY = tomatoParticle ? tomatoParticle.y : targetTomato.y;

                const dx = p.x - centerX;
                const dy = p.y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const currentAngle = Math.atan2(dy, dx);

                if (dist < 20) {
                    shouldRemove = true;
                } else {
                    const radialSpeed = 3 + (200 / (dist + 10));
                    const tangentialSpeed = 0.15;

                    const nextAngle = currentAngle + tangentialSpeed;
                    const nextRadius = dist - radialSpeed;

                    p.x = centerX + Math.cos(nextAngle) * nextRadius;
                    p.y = centerY + Math.sin(nextAngle) * nextRadius;
                    p.color = 0xFF0000;
                    if (p.alpha < 1.0) p.alpha += 0.05;
                }

            } else if (!shouldRemove) {
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
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                // Optimization: Swap-remove O(1) instead of splice O(N)
                if (p.type === 'suck') this._suckCount--;
                const last = this.visualParticles.length - 1;
                if (i < last) {
                    this.visualParticles[i] = this.visualParticles[last];
                }
                this.visualParticles.pop();
                // Don't increment i — re-check the swapped element
            } else {
                i++;
            }
        }
    }
}
