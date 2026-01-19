
import { Difficulty, FruitDef, FruitTier } from "./types";

export const FRUIT_DEFS: Record<FruitTier, FruitDef> = {
  // STRICT EQUAL MASS (1.0) for all fruits to prevent squishing.
  [FruitTier.CHERRY]: { tier: FruitTier.CHERRY, name: "Cherry", radius: 22, mass: 1.0, color: "#D32F2F", patternColor: "#B71C1C", emoji: [], bounciness: 0.4 },
  [FruitTier.STRAWBERRY]: { tier: FruitTier.STRAWBERRY, name: "Strawberry", radius: 32, mass: 1.0, color: "#F44336", patternColor: "#D32F2F", emoji: [], bounciness: 0.4 },
  [FruitTier.GRAPE]: { tier: FruitTier.GRAPE, name: "Grape", radius: 42, mass: 1.0, color: "#7B1FA2", patternColor: "#4A148C", emoji: [], bounciness: 0.4 },
  [FruitTier.CLEMENTINE]: { tier: FruitTier.CLEMENTINE, name: "Clementine", radius: 52, mass: 1.0, color: "#FF9800", patternColor: "#EF6C00", emoji: [], bounciness: 0.4 },
  [FruitTier.ORANGE]: { tier: FruitTier.ORANGE, name: "Orange", radius: 65, mass: 1.0, color: "#FF5722", patternColor: "#E64A19", emoji: [], bounciness: 0.4 },
  [FruitTier.APPLE]: { tier: FruitTier.APPLE, name: "Apple", radius: 80, mass: 1.0, color: "#8BC34A", patternColor: "#689F38", emoji: [], bounciness: 0.4 },
  [FruitTier.PINEAPPLE]: { tier: FruitTier.PINEAPPLE, name: "Pineapple", radius: 95, mass: 1.0, color: "#FDD835", patternColor: "#F9A825", emoji: [], bounciness: 0.4 },
  [FruitTier.COCONUT]: { tier: FruitTier.COCONUT, name: "Coconut", radius: 110, mass: 1.0, color: "#795548", patternColor: "#4E342E", emoji: [], bounciness: 0.4 },
  [FruitTier.PUMPKIN]: { tier: FruitTier.PUMPKIN, name: "Pumpkin", radius: 130, mass: 1.0, color: "#FF7043", patternColor: "#D84315", emoji: [], bounciness: 0.4 },
  [FruitTier.WATERMELON]: { tier: FruitTier.WATERMELON, name: "Watermelon", radius: 155, mass: 1.0, color: "#4CAF50", patternColor: "#1B5E20", emoji: [], bounciness: 0.4 },
  [FruitTier.TOMATO]: { tier: FruitTier.TOMATO, name: "Tomato", radius: 45, mass: 1.0, color: "#FF1744", patternColor: "#D50000", emoji: [], bounciness: 0.6 },
};

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
