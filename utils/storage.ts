
import { SavedData, GameSettings } from "../types";
import { STORAGE_KEY } from "../constants";
import { offlineManager } from "../services/offlineManager";

const DEFAULT_DATA: SavedData = {
  leaderboard: [],
  pendingScores: [],
  settings: {
    musicEnabled: true,
    sfxEnabled: true,
    hapticsEnabled: true,
    reducedParticles: false,
    showLocalOnly: false,
  },
  tutorialSeen: false,
};

export const loadData = (): SavedData => {
  try {
    const raw = offlineManager.getItem(STORAGE_KEY);
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
    offlineManager.setItem(STORAGE_KEY, JSON.stringify(newData));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};
