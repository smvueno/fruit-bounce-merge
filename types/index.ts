
import { FruitTier, FruitDef } from '../services/fruitConfig';

export enum GameState {
  START,
  PLAYING,
  GAME_OVER
}

export { FruitTier, type FruitDef };

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
  leaderboard: LeaderboardEntry[]; // Local leaderboard history
  pendingScores: LeaderboardEntry[]; // Scores waiting to be uploaded to Supabase
  settings: GameSettings;
  tutorialSeen: boolean;
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

export interface PointEvent {
  x: number;
  y: number;
  points: number;
  tier: number;
}

export enum PopUpType {
  WATERMELON_CRUSH,
  FRENZY,
  CHAIN,
  DANGER
}

export interface PopupData {
  runningTotal: number;
  multiplier: number;
  type: PopUpType;
  dangerTime?: number;
}
