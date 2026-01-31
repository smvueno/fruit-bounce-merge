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
        this.reset(x, y, def, id);
    }

    reset(x: number, y: number, def: FruitDef, id: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = def.radius;
        this.mass = 1.0;
        this.tier = def.tier;
        this.id = id;
        this.isStatic = false;
        this.ignoreCollisions = false;
        this.isCaught = false;
        this.contactCount = 0;
        this.stability = 0;
        this.cooldownTimer = 0;
        this.rotation = 0;
        this.angularVelocity = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.alpha = 1;
        this.blinkTimer = Math.random() * 200;
        this.isBlinking = false;
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
    phase: 'suck' | 'hold' | 'pop' | 'explode' = 'suck'; // Kept explode for type safety if needed, but logic changes to pop
    capturedIds: number[] = [];
    startX: number;
    startY: number;
    popTimer: number = 0;
    popIndex: number = 0;

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
        this.reset(x, y, color, type);
    }

    reset(x: number, y: number, color: string | number, type: 'circle' | 'star' | 'suck' | 'bomb-ghost') {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        if (typeof color === 'number') {
            this.color = `#${color.toString(16).padStart(6, '0')}`;
        } else {
            this.color = color;
        }
        this.type = type;
        this.size = type === 'star' ? 10 + Math.random() * 10 : 3 + Math.random() * 5;
        this.life = 1.0;
        this.alpha = 1.0;
        this.targetId = undefined;
        this.rotation = 0;
    }
}
