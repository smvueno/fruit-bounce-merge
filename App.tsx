
import React, { useState, useEffect } from 'react';
import { GameState, Difficulty, GameStats, SavedData, LeaderboardEntry } from './types';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { GameCanvas } from './components/GameCanvas';
import { loadData, saveData } from './utils/storage';
import { getGlobalLeaderboard, submitScore, uploadPendingScores } from './services/leaderboardService';
import { offlineManager } from './services/offlineManager';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [data, setData] = useState<SavedData>(loadData());
  const [currentScore, setCurrentScore] = useState(0);
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [isNewHigh, setIsNewHigh] = useState(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Service Worker Update State
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const syncScores = async () => {
    // 1. Check connectivity
    if (!offlineManager.isOnline()) {
      console.log('Offline - skipping sync');
      return;
    }

    // 2. Prevent overlapping syncs
    if (offlineManager.isSyncing()) {
      console.log('Sync already in progress - skipping');
      return;
    }

    offlineManager.setSyncInProgress(true);

    try {
      // 3. Load FRESH data from storage to avoid stale closures
      // We do not rely on 'data.pendingScores' from component state
      const currentSaved = loadData();
      const pending = currentSaved.pendingScores || [];

      if (pending.length > 0) {
        console.log(`Syncing ${pending.length} pending scores...`);
        const remaining = await uploadPendingScores(pending);

        // If we managed to upload some, update local storage and state
        if (remaining.length !== pending.length) {
          console.log(`Successfully synced ${pending.length - remaining.length} scores.`);
          saveData({ pendingScores: remaining });
          setData(prev => ({ ...prev, pendingScores: remaining }));
        }
      }

      // 4. Fetch Global (force refresh)
      const global = await getGlobalLeaderboard(50, true);
      setGlobalLeaderboard(global);
    } catch (e) {
      console.error('Error during sync:', e);
    } finally {
      offlineManager.setSyncInProgress(false);
    }
  };

  useEffect(() => {
    // Load initial data
    setData(loadData());

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      const swPath = import.meta.env.BASE_URL + 'sw.js';
      navigator.serviceWorker.register(swPath).then(reg => {
        console.log('Service Worker registered:', swPath);

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
        }

        // Listen for new workers
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available and installed
                setWaitingWorker(newWorker);
              }
            });
          }
        });
      }).catch(err => console.error('Service Worker registration failed:', err));

      // Reload when the new worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    // Initial Sync
    syncScores();

    // Listen for connection changes
    const unsubscribe = offlineManager.onConnectionChange((isOnline) => {
      if (isOnline) {
        console.log('Back online - syncing...');
        syncScores();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleStart = (diff: Difficulty) => {
    if (waitingWorker) {
      if (confirm("A new version of the game is available! The game will reload to update.")) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
    }

    saveData({ lastDifficulty: diff });
    setData(prev => ({ ...prev, lastDifficulty: diff }));
    setCurrentScore(0);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (stats: GameStats) => {
    // Check if score qualifies for global leaderboard (Top 50 shown usually)
    // Or check against local?
    // User wants "New Record" badge.
    // If we are online, we should probably check against Global.
    // If offline, check against Local?
    // For simplicity: Check against the currently visible leaderboard (activeLeaderboard).

    const activeList = data.settings.showLocalOnly ? (data.leaderboard || []) : globalLeaderboard;
    const sortedLeaderboard = [...activeList].sort((a, b) => b.score - a.score);
    const LIMIT = 10; // Badge usually relevant for top 10

    let qualifies = false;
    if (stats.score > 0) {
      if (sortedLeaderboard.length < LIMIT) {
        qualifies = true;
      } else {
        const lowestScore = sortedLeaderboard[LIMIT - 1].score;
        if (stats.score > lowestScore) {
          qualifies = true;
        }
      }
    }

    // Also track legacy per-difficulty high score (internal use)
    const diff = data.lastDifficulty;
    const oldHigh = data.highScores[diff] || 0;
    if (stats.score > oldHigh) {
      const newHighScores = { ...data.highScores, [diff]: stats.score };
      saveData({ highScores: newHighScores });
      setData(prev => ({ ...prev, highScores: newHighScores }));
    }

    setIsNewHigh(qualifies);
    setFinalStats(stats);
    setGameState(GameState.GAME_OVER);
  };

  const saveScoreToLeaderboard = async (name: string) => {
    if (!finalStats) return;

    const newEntry: LeaderboardEntry = {
      name,
      score: finalStats.score,
      timePlayed: finalStats.timePlayed,
      maxTier: finalStats.maxTier,
      date: new Date().toISOString()
    };

    // 1. Update Local History
    const currentLeaderboard = data.leaderboard || [];
    const updatedLeaderboard = [...currentLeaderboard, newEntry]
      .sort((a, b) => b.score - a.score);
    // We can keep more history locally if we want, but sticking to logic

    const newPending = [...(data.pendingScores || [])];

    // 2. Try Global Submit
    const uploaded = await submitScore(newEntry);
    if (!uploaded) {
      newPending.push(newEntry);
    } else {
      // Refresh global if successful
      const global = await getGlobalLeaderboard();
      setGlobalLeaderboard(global);
    }

    saveData({ leaderboard: updatedLeaderboard, pendingScores: newPending });
    setData(prev => ({ ...prev, leaderboard: updatedLeaderboard, pendingScores: newPending }));
  };

  const updateSettings = (s: any) => {
    saveData({ settings: s });
    setData(prev => ({ ...prev, settings: s }));
  };

  const activeLeaderboard = data.settings.showLocalOnly ? (data.leaderboard || []) : globalLeaderboard;

  return (
    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden font-sans select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-yellow-100 opacity-5">
        <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      </div>

      {/* Responsive Game Container - Fixed Aspect Ratio 2:3 (Portrait) */}
      <div className="relative w-full max-w-[600px] h-full max-h-[95vh] aspect-[2/3] bg-white shadow-2xl rounded-xl overflow-hidden ring-8 ring-black/10 flex flex-col">

        {gameState === GameState.START && (
          <StartScreen
            onStart={handleStart}
            leaderboard={activeLeaderboard}
            settings={data.settings}
            onUpdateSettings={updateSettings}
          />
        )}

        {gameState === GameState.PLAYING && (
          <>
            {/* Score Display - Top Left */}
            <div className="absolute top-6 left-6 z-20 pointer-events-none flex flex-col items-start font-['Fredoka']">
              <div className="text-gray-900 font-black tracking-widest text-lg drop-shadow-sm mb-0 opacity-80">SCORE</div>
              <div className="text-6xl font-black text-gray-900 drop-shadow-sm leading-none" style={{ textShadow: '3px 3px 0 #F97316' }}>
                {currentScore.toLocaleString()}
              </div>
            </div>

            <GameCanvas
              difficulty={data.lastDifficulty}
              settings={data.settings}
              onUpdateSettings={updateSettings}
              leaderboard={activeLeaderboard}
              onGameOver={handleGameOver}
              setScore={setCurrentScore}
            />
          </>
        )}

        {gameState === GameState.GAME_OVER && finalStats && (
          <GameOverScreen
            stats={finalStats}
            isNewHigh={isNewHigh}
            leaderboard={activeLeaderboard}
            isLocalOnly={data.settings.showLocalOnly}
            onRestart={() => handleStart(data.lastDifficulty)}
            onMenu={() => setGameState(GameState.START)}
            onSaveScore={saveScoreToLeaderboard}
          />
        )}
      </div>
    </div>
  );
};

export default App;
