
import { Difficulty, FruitTier } from "./types";

export { FRUIT_DEFS } from './services/fruitConfig';

// Unified Physics Settings
const PHYSICS_GRAVITY = 0.8;
const PHYSICS_FRICTION = 0.98; // Air resistance

export const DIFFICULTY_CONFIG = {
  [Difficulty.EASY]: {
    gravity: PHYSICS_GRAVITY,
    friction: PHYSICS_FRICTION,
    aimAssist: true,
    spawnDelay: 400,
    spawnTiers: [FruitTier.CHERRY, FruitTier.STRAWBERRY, FruitTier.GRAPE, FruitTier.CLEMENTINE]
  },
  [Difficulty.NORMAL]: {
    gravity: PHYSICS_GRAVITY,
    friction: PHYSICS_FRICTION,
    aimAssist: true,
    spawnDelay: 500,
    spawnTiers: [FruitTier.CHERRY, FruitTier.STRAWBERRY, FruitTier.GRAPE]
  },
  [Difficulty.HARD]: {
    gravity: PHYSICS_GRAVITY,
    friction: PHYSICS_FRICTION,
    aimAssist: false,
    spawnDelay: 600,
    spawnTiers: [FruitTier.CHERRY, FruitTier.STRAWBERRY]
  },
};

// Physics Engine Constants
export const SUBSTEPS = 10; // 10 Iterations is a sweet spot for stack stability
// BOUNCE SETTINGS - Increased for fun factor!
export const WALL_DAMPING = 0.5; // (Was 0.3) Retains 50% velocity on wall hit
export const FLOOR_DAMPING = 0.4; // (Was 0.2) Retains 40% velocity on floor hit

// Dynamic Friction - Solves "Sliding" vs "Stacking"
// If touching <= 1 object: Slippery (allows falling into gaps)
// If touching > 1 object: Sticky/Locked (stabilizes stack)
export const FRICTION_SLIDE = 0.99;
export const FRICTION_LOCK = 0.5; // Multiplier per substep. 0.5^10 is effectively 0.

export const DANGER_TIME_MS = 5000;
export const DANGER_Y_PERCENT = 0.15;
export const SPAWN_Y_PERCENT = 0.08;

// Scoring
export const SCORE_BASE_MERGE = 2; // Exponential base multiplier
export const FEVER_THRESHOLD = 5;
export const FEVER_DURATION_MS = 10000;
export const JUICE_MAX = 1500; // Increased to reduce frequency (was 1000)

export const STORAGE_KEY = 'fruit_bounce_merge_v3';
