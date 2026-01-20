
export enum GameState {
  START,
  PLAYING,
  GAME_OVER
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export enum FruitTier {
  CHERRY = 0,
  STRAWBERRY = 1,
  GRAPE = 2,
  CLEMENTINE = 3,
  ORANGE = 4,
  APPLE = 5,
  PINEAPPLE = 6,
  COCONUT = 7,
  PUMPKIN = 8,
  WATERMELON = 9,
  TOMATO = 99 // Special
}

export interface GameSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  hapticsEnabled: boolean;
  reducedParticles: boolean;
  showLocalOnly: boolean;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  timePlayed: number; // in seconds
  maxTier: FruitTier;
  date: string; // ISO date string
}

export interface SavedData {
  highScores: Record<Difficulty, number>; // Kept for legacy/difficulty tracking
  leaderboard: LeaderboardEntry[]; // Local leaderboard history
  pendingScores: LeaderboardEntry[]; // Scores waiting to be uploaded to Supabase
  settings: GameSettings;
  lastDifficulty: Difficulty;
  tutorialSeen: boolean;
}

export interface FruitDef {
  tier: FruitTier;
  name: string;
  radius: number;
  mass: number;
  color: string;
  patternColor: string;
  emoji: string[]; // Idle, Worried, Happy, Hyped
  bounciness: number; // 0-1
}

export interface GameStats {
  score: number;
  bestCombo: number;
  feverCount: number;
  tomatoUses: number;
  dangerSaves: number;
  timePlayed: number; // ms
  maxTier: FruitTier;
}
