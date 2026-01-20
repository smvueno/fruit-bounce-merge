
import { SavedData, Difficulty, GameSettings } from "../types";
import { STORAGE_KEY } from "../constants";

const DEFAULT_DATA: SavedData = {
  highScores: {
    [Difficulty.EASY]: 0,
    [Difficulty.NORMAL]: 0,
    [Difficulty.HARD]: 0,
  },
  leaderboard: [],
  pendingScores: [],
  settings: {
    musicEnabled: true,
    sfxEnabled: true,
    hapticsEnabled: true,
    reducedParticles: false,
    showLocalOnly: false,
  },
  lastDifficulty: Difficulty.NORMAL,
  tutorialSeen: false,
};

export const loadData = (): SavedData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration for old "soundEnabled"
      if (typeof parsed.settings?.soundEnabled !== 'undefined') {
          parsed.settings.musicEnabled = parsed.settings.soundEnabled;
          parsed.settings.sfxEnabled = parsed.settings.soundEnabled;
          delete parsed.settings.soundEnabled;
      }
      return { ...DEFAULT_DATA, ...parsed, settings: { ...DEFAULT_DATA.settings, ...parsed.settings } };
    }
  } catch (e) {
    console.error("Failed to load save data", e);
  }
  return DEFAULT_DATA;
};

export const saveData = (data: Partial<SavedData>) => {
  try {
    const current = loadData();
    const newData = { ...current, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};
