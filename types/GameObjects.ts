import { FruitTier, FruitDef } from './index';

export class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    mass: number;
    tier: FruitTier;
    id: number;
    isStatic: boolean = false; // "Static" means waiting to be dropped

    // State flags
    ignoreCollisions: boolean = false;
    isCaught: boolean = false;
    contactCount: number = 0; // Number of distinct bodies (or floor) this particle is touching
    stability: number = 0; // 0.0 = Unstable/Free, 1.0 = Stable/Locked. Used for mass weighting.
    cooldownTimer: number = 0;

    rotation: number = 0;
    angularVelocity: number = 0;

    // Visuals
    scaleX: number = 1;
    scaleY: number = 1;
    alpha: number = 1;

    // Animation State
    blinkTimer: number = Math.random() * 200;
    isBlinking: boolean = false;

    constructor(x: number, y: number, def: FruitDef, id: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = def.radius;
        this.mass = 1.0; // Enforce equal mass for stability
        this.tier = def.tier;
        this.id = id;
    }
}

export class TomatoEffect {
    tomatoId: number;
    x: number;
    y: number;
    timer: number;
    maxTime: number;
    targetTier: FruitTier;
    capturedIds: number[] = [];

    constructor(id: number, x: number, y: number, targetTier: FruitTier) {
        this.tomatoId = id;
        this.x = x;
        this.y = y;
        this.targetTier = targetTier;
        this.maxTime = 3.5;
        this.timer = this.maxTime;
    }
}

export class BombEffect {
    bombId: number;
    x: number;
    y: number;
    timer: number;
    maxTime: number;
    capturedIds: number[] = [];

    constructor(id: number, x: number, y: number) {
        this.bombId = id;
        this.x = x;
        this.y = y;
        this.maxTime = 3.0; // 3 seconds timer
        this.timer = this.maxTime;
    }
}

export class CelebrationState {
    timer: number = 0;
    phase: 'suck' | 'hold' | 'explode' = 'suck';
    capturedIds: number[] = [];
    startX: number;
    startY: number;

    constructor(x: number, y: number, ids: number[]) {
        this.startX = x;
        this.startY = y;
        this.capturedIds = ids;
    }
}


export class EffectParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    color: string | number;
    life: number;
    type: 'circle' | 'star' | 'suck' | 'bomb-ghost';
    targetId?: number;
    rotation: number = 0; // Added for spinning stars

    constructor(x: number, y: number, color: string | number, type: 'circle' | 'star' | 'suck' | 'bomb-ghost' = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.color = color;
        this.type = type;
        this.size = type === 'star' ? 10 + Math.random() * 10 : 3 + Math.random() * 5;
        this.life = 1.0;
        this.alpha = 1.0;
    }
}
