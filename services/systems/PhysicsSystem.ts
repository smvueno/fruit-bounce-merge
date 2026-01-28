import { FruitTier } from '../../types';
import { Particle, TomatoEffect, BombEffect, CelebrationState } from '../../types/GameObjects';
import { GAME_CONFIG, SUBSTEPS, WALL_DAMPING, FLOOR_DAMPING, FRICTION_SLIDE, FRICTION_LOCK, FLOOR_OFFSET, SPAWN_Y_PERCENT } from '../../constants';

// Optimization: Pre-calculate Floor Wave to avoid expensive Trig calls per particle per substep
const LUT_SIZE = 800; // Covers V_WIDTH (600) + Padding
const WAVE_LUT = new Float32Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) {
    WAVE_LUT[i] = Math.sin(i * 0.015) * 10 + Math.cos(i * 0.04) * 5;
}

export interface PhysicsContext {
    fruits: Particle[];
    activeTomatoes: TomatoEffect[];
    activeBombs: BombEffect[];
    celebrationEffect: CelebrationState | null;
    currentFruit: Particle | null;
    isAiming: boolean;
    dragAnchorX: number;
    dragAnchorY: number;
    width: number;
    height: number;
}

export interface PhysicsCallbacks {
    onMerge: (p1: Particle, p2: Particle) => void;
    onBombExplosion: (bomb: Particle) => void;
    onTomatoCollision: (p1: Particle, p2: Particle) => void;
    onCelebrationMatch: (p1: Particle, p2: Particle) => void;
}

export class PhysicsSystem {

    update(dt: number, ctx: PhysicsContext, callbacks: PhysicsCallbacks) {
        const gravity = GAME_CONFIG.gravity;
        const friction = GAME_CONFIG.friction;

        // 1. Reset Collision Flags
        for (const p of ctx.fruits) {
            if (!p.isCaught) p.ignoreCollisions = false;
        }

        // 2. Integration & Aiming
        if (ctx.currentFruit && ctx.isAiming) {
            const k = 0.1;
            const ax = ctx.dragAnchorX - ctx.currentFruit.x;
            const ay = ctx.dragAnchorY - ctx.currentFruit.y;
            ctx.currentFruit.vx += ax * k;
            ctx.currentFruit.vy += ay * k;
            ctx.currentFruit.vx *= 0.8;
            ctx.currentFruit.vy *= 0.8;
            ctx.currentFruit.x += ctx.currentFruit.vx;
            ctx.currentFruit.y += ctx.currentFruit.vy;
        }

        for (const p of ctx.fruits) {
            if (p.isStatic) continue;

            if (!p.isCaught) {
                p.vy += gravity;
                p.vx *= friction;
                p.vy *= friction;
            }

            // Apply Velocity
            p.x += p.vx;
            p.y += p.vy;

            // Rotation
            p.rotation += p.angularVelocity;
            p.angularVelocity *= 0.95; // Strong rotational drag

            p.blinkTimer -= 1;
            if (p.blinkTimer <= 0) {
                p.isBlinking = !p.isBlinking;
                p.blinkTimer = p.isBlinking ? 10 : 200 + Math.random() * 300;
            }
        }

        // 3. Tomato Logic (Tractor)
        this.updateTomatoPhysics(ctx);

        // 3b. Bomb Logic (Capture)
        this.updateBombPhysics(ctx);

        // 3c. Celebration Logic (Suction)
        this.updateCelebrationPhysics(ctx);

        // 4. Solver Loop (Substeps)
        for (let s = 0; s < SUBSTEPS; s++) {
            this.updateContactCounts(ctx); // Count contacts before resolving

            // --- GLOBAL LOCKING FRICTION ---
            for (const p of ctx.fruits) {
                if (p.isStatic || p.isCaught) continue;

                if (p.contactCount > 1) {
                    // LOCK IT DOWN
                    p.vx *= FRICTION_LOCK;
                    p.vy *= FRICTION_LOCK;
                    p.angularVelocity *= 0.5; // Kill rotation
                }
            }

            this.resolveCollisions(ctx, callbacks);
            this.resolveWalls(ctx);
        }
    }

    getFloorY(x: number, height: number): number {
        const baseY = height - FLOOR_OFFSET;

        let ix = Math.floor(x);
        if (ix < 0) ix = 0;
        else if (ix >= LUT_SIZE) ix = LUT_SIZE - 1;

        return baseY + WAVE_LUT[ix];
    }

    updateContactCounts(ctx: PhysicsContext) {
        // Reset counts
        for (const p of ctx.fruits) {
            p.contactCount = 0;
        }

        // Check floor
        for (const p of ctx.fruits) {
            if (p.isStatic || p.isCaught) continue;
            // Check if touching floor
            const groundY = this.getFloorY(p.x, ctx.height);
            if (p.y + p.radius >= groundY - 2) { // 2px epsilon
                p.contactCount++;
            }
        }

        // Check pairs
        for (let i = 0; i < ctx.fruits.length; i++) {
            for (let j = i + 1; j < ctx.fruits.length; j++) {
                const p1 = ctx.fruits[i];
                const p2 = ctx.fruits[j];
                if (p1.ignoreCollisions || p2.ignoreCollisions || p1.isStatic || p2.isStatic) continue;

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                const radSum = p1.radius + p2.radius;
                if (distSq < radSum * radSum) {
                    p1.contactCount++;
                    p2.contactCount++;
                }
            }
        }

        // Calculate Stability (Inertia)
        for (const p of ctx.fruits) {
            if (p.contactCount > 1) {
                p.stability = 1.0;
            } else {
                p.stability = 0.0;
            }
        }
    }

    /**
     * Helper method to iterate over fruits and apply effect-specific logic.
     * Reduces code duplication between tomato and bomb physics updates.
     */
    private forEachEffectTarget(
        ctx: PhysicsContext,
        effectParticle: Particle | undefined,
        shouldProcess: (p: Particle, effectParticle: Particle) => boolean,
        processTarget: (p: Particle, effectParticle: Particle) => void
    ) {
        if (!effectParticle) return;

        for (const p of ctx.fruits) {
            if (p.id === effectParticle.id || p === ctx.currentFruit || p.isStatic) continue;

            if (shouldProcess(p, effectParticle)) {
                processTarget(p, effectParticle);
            }
        }
    }

    updateTomatoPhysics(ctx: PhysicsContext) {
        for (const t of ctx.activeTomatoes) {
            const tomato = ctx.fruits.find(p => p.id === t.tomatoId);

            this.forEachEffectTarget(
                ctx,
                tomato,
                (p) => p.tier === t.targetTier,
                (p, tomato) => {
                    p.isCaught = true;
                    p.ignoreCollisions = true;
                    if (!t.capturedIds.includes(p.id)) t.capturedIds.push(p.id);

                    const dx = tomato.x - p.x;
                    const dy = tomato.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) + (Math.PI / 9);
                    const speed = 15 + (1000 / (dist + 50));

                    p.vx = p.vx * 0.85 + Math.cos(angle) * speed * 0.15;
                    p.vy = p.vy * 0.85 + Math.sin(angle) * speed * 0.15;

                    const suckRadius = tomato.radius * 4;
                    if (dist < suckRadius) {
                        const scale = Math.max(0.1, dist / suckRadius);
                        p.scaleX = scale;
                        p.scaleY = scale;
                        p.alpha = scale;
                        p.rotation += 0.3;
                    }
                }
            );
        }
    }

    updateBombPhysics(ctx: PhysicsContext) {
        for (const b of ctx.activeBombs) {
            const bomb = ctx.fruits.find(p => p.id === b.bombId);

            this.forEachEffectTarget(
                ctx,
                bomb,
                (p) => {
                    // Don't capture special fruits
                    if (p.tier === FruitTier.TOMATO || p.tier === FruitTier.RAINBOW || p.tier === FruitTier.BOMB) {
                        return false;
                    }
                    return true;
                },
                (p, bomb) => {
                    const dx = p.x - bomb.x;
                    const dy = p.y - bomb.y;
                    const distSq = dx * dx + dy * dy;
                    const radSum = p.radius + bomb.radius;
                    const threshold = radSum + 5;

                    // If touching and not already tracked, add to list
                    if (distSq < threshold * threshold) { // 5px buffer for detection
                        if (!b.capturedIds.includes(p.id)) {
                            b.capturedIds.push(p.id);
                        }
                    }
                }
            );
        }
    }

    updateCelebrationPhysics(ctx: PhysicsContext) {
        if (!ctx.celebrationEffect) return;
        const state = ctx.celebrationEffect;

        if (state.phase === 'suck') {
            const targetX = ctx.width / 2;
            const targetY = ctx.height * SPAWN_Y_PERCENT;

            for (const id of state.capturedIds) {

                const p = ctx.fruits.find(f => f.id === id);
                if (!p) continue;

                const dx = targetX - p.x;
                const dy = targetY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);

                const speed = 20 + (dist * 0.05);

                p.vx = p.vx * 0.8 + Math.cos(angle) * speed * 0.2;
                p.vy = p.vy * 0.8 + Math.sin(angle) * speed * 0.2;

                p.rotation += 0.2;
                p.angularVelocity = 0.2;
            }
        } else if (state.phase === 'hold' || state.phase === 'pop') {
            for (const id of state.capturedIds) {
                const p = ctx.fruits.find(f => f.id === id);
                if (!p) continue;
                p.vx *= 0.8;
                p.vy *= 0.8;
            }
        }
    }

    resolveWalls(ctx: PhysicsContext) {
        const width = ctx.width;
        for (const p of ctx.fruits) {
            if (p.isStatic || p.isCaught) continue;

            const groundY = this.getFloorY(p.x, ctx.height);

            // Strict Floor Clamp
            if (p.y + p.radius > groundY) {
                p.y = groundY - p.radius; // HARD RESET
                p.vy *= -FLOOR_DAMPING;
                p.vx *= 0.85; // Floor Friction
            }

            // Walls
            if (p.x - p.radius < 0) {
                p.x = p.radius;
                p.vx *= -WALL_DAMPING; // Bounce
            }
            if (p.x + p.radius > width) {
                p.x = width - p.radius;
                p.vx *= -WALL_DAMPING; // Bounce
            }
        }
    }

    resolveCollisions(ctx: PhysicsContext, callbacks: PhysicsCallbacks) {
        for (let i = 0; i < ctx.fruits.length; i++) {
            for (let j = i + 1; j < ctx.fruits.length; j++) {
                const p1 = ctx.fruits[i];
                const p2 = ctx.fruits[j];

                if (p1.ignoreCollisions || p2.ignoreCollisions) continue;
                if (p1.isStatic && p2.isStatic) continue;

                // Tomato Logic Pass-through
                const tEffect = ctx.activeTomatoes.find(t => t.tomatoId === p1.id || t.tomatoId === p2.id);
                if (tEffect) {
                    const other = p1.id === tEffect.tomatoId ? p2 : p1;
                    if (other.tier === tEffect.targetTier) continue;
                }

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                const radSum = p1.radius + p2.radius;

                if (distSq < radSum * radSum) {
                    const dist = Math.sqrt(distSq);

                    // --- SPECIAL LOGIC: BOMB ---
                    if (p1.tier === FruitTier.BOMB || p2.tier === FruitTier.BOMB) {
                        callbacks.onBombExplosion(p1.tier === FruitTier.BOMB ? p1 : p2);
                    }

                    // --- SPECIAL LOGIC: RAINBOW (Wildcard) ---
                    let canMerge = false;

                    // Case 1: Normal Same Tier
                    if (p1.tier === p2.tier) {
                        // Check Watermelon Celebration
                        if (p1.tier === FruitTier.WATERMELON) {
                            if (p1.cooldownTimer <= 0 && p2.cooldownTimer <= 0) {
                                // SAFE: The callback removes particles from ctx.fruits, but we immediately
                                // break from the inner loop. This prevents further iteration over the modified
                                // array. The outer loop continues safely as it only needs valid indices.
                                callbacks.onCelebrationMatch(p1, p2);
                                break;
                            }
                        }

                        // Normal Merge
                        if (p1.tier !== FruitTier.WATERMELON && p1.tier !== FruitTier.TOMATO && p1.tier !== FruitTier.RAINBOW) {
                            canMerge = true;
                        }
                    }

                    // Case 2: Rainbow + Anything (except specials)
                    else if ((p1.tier === FruitTier.RAINBOW || p2.tier === FruitTier.RAINBOW)) {
                        const validP1 = p1.tier < 90; // Not a special fruit
                        const validP2 = p2.tier < 90;

                        if (p1.tier === FruitTier.RAINBOW && p2.tier === FruitTier.RAINBOW) {
                            canMerge = true;
                        } else if (validP1 || validP2) {
                            canMerge = true;
                        }
                    }

                    if (canMerge) {
                        if (p1.cooldownTimer <= 0 && p2.cooldownTimer <= 0) {
                            callbacks.onMerge(p1, p2);
                            // If merged, one or both particles are removed. 
                            // We should break inner loop as p1 (at i) might be gone.
                            // However, we can't easily `i--` here if we don't control the loop correctly.
                            // To stay safe: We break inner loop. P1 is done.
                            break;
                        }
                    }

                    // --- RESTORED TOMATO LOGIC ---
                    if (p1.tier === FruitTier.TOMATO || p2.tier === FruitTier.TOMATO) {
                        callbacks.onTomatoCollision(p1, p2);
                        continue;
                        // In `resolveCollisions`, it was a void function. `return` would skip ALL other collisions for ALL fruits.
                        // That seems buggy in original code or I misread context.
                        // Looking at original line 1130: `return;` inside proper logic.
                        // Wait, it says `return;` inside the loop. That aborts the ENTIRE collision resolution for this substep.
                        // That sounds efficient but maybe side-effect prone. I will preserve it.
                    }

                    if (dist === 0) continue;

                    // --- PHYSICS RESOLUTION (Weighted by Stability) ---
                    const overlap = radSum - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const im1 = 1 / (p1.mass * (1 + p1.stability * 10));
                    const im2 = 1 / (p2.mass * (1 + p2.stability * 10));
                    const totalIm = im1 + im2;

                    const r1 = p1.isStatic ? 0 : (im1 / totalIm);
                    const r2 = p2.isStatic ? 0 : (im2 / totalIm);

                    if (!p1.isStatic) {
                        p1.x += nx * overlap * r1;
                        p1.y += ny * overlap * r1;
                    }
                    if (!p2.isStatic) {
                        p2.x -= nx * overlap * r2;
                        p2.y -= ny * overlap * r2;
                    }

                    // Impulse
                    const dvx = p1.vx - p2.vx;
                    const dvy = p1.vy - p2.vy;
                    const dot = dvx * nx + dvy * ny;

                    if (dot < 0) {
                        const restitution = 0.4;
                        const j = -(1 + restitution) * dot;

                        p1.vx += j * nx * r1;
                        p1.vy += j * ny * r1;
                        p2.vx -= j * nx * r2;
                        p2.vy -= j * ny * r2;

                        if (p1.contactCount <= 1) {
                            p1.vx *= FRICTION_SLIDE;
                            p1.vy *= FRICTION_SLIDE;
                        }
                        if (p2.contactCount <= 1) {
                            p2.vx *= FRICTION_SLIDE;
                            p2.vy *= FRICTION_SLIDE;
                        }
                    }
                }
            }
        }
    }
}
