
import React, { useState, useEffect } from 'react';
import { GameState, Difficulty, GameStats, SavedData, LeaderboardEntry } from './types';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { GameCanvas } from './components/GameCanvas';
import { loadData, saveData } from './utils/storage';
import { getGlobalLeaderboard, submitScore, performFullSync } from './services/leaderboardService';
import { offlineManager } from './services/offlineManager';
import { UpdateModal } from './components/UpdateModal';

declare global {
  interface Window {
    forceReset: () => void;
  }
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [data, setData] = useState<SavedData>(loadData());
  const [currentScore, setCurrentScore] = useState(0);
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [isNewHigh, setIsNewHigh] = useState(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Service Worker Update State
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Expose sync function to refresh both global state and local pending data
  const handleSync = async () => {
    const globalData = await performFullSync();
    if (globalData) {
      setGlobalLeaderboard(globalData);
      // Also refresh local pending scores view
      const reloaded = loadData();
      setData(prev => ({ ...prev, pendingScores: reloaded.pendingScores }));
    }
  };

  // Emergency Reset Function
  useEffect(() => {
    window.forceReset = async () => {
      console.log('🚨 Starting Emergency Reset...');
      console.log('   Origin:', window.location.origin);

      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          console.log(`   Found ${registrations.length} registrations.`);

          for (const registration of registrations) {
            console.log(`   👉 Attempting to unregister SW at scope: ${registration.scope}`);
            const result = await registration.unregister();
            console.log(`      Result: ${result ? 'SUCCESS' : 'FAILED'}`);
          }

          if (registrations.length === 0) {
            console.log('   ⚠️ No registrations found via getRegistrations(). usage might be restricted?');
          }
        } catch (err) {
          console.error('   ❌ Error getting registrations:', err);
        }
      } else {
        console.log('   ❌ navigator.serviceWorker not supported');
      }

      // 2. Clear all caches
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          console.log(`   Found ${keys.length} caches.`);
          for (const key of keys) {
            console.log(`   🗑️ Deleting cache: ${key}`);
            await caches.delete(key);
          }
        } catch (err) {
          console.error('   ❌ Error clearing caches:', err);
        }
      }

      console.log('✅ Reset logic finished. Reloading in 1s...');
      setTimeout(() => window.location.reload(), 1000);
    };
  }, []);

  useEffect(() => {
    // Load initial data
    setData(loadData());

    // Initial Sync
    handleSync();

    // Listen for connection changes
    const unsubscribe = offlineManager.onConnectionChange((isOnline) => {
      if (isOnline) {
        console.log('Back online - syncing...');
        handleSync();
      }
    });

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      const swPath = `${import.meta.env.BASE_URL}sw.js`;

      const handleControllerChange = () => {
        window.location.reload();
      };

      // Store cleanup function for registration listeners
      let cleanupRegistrationListeners: (() => void) | undefined;

      navigator.serviceWorker.register(swPath).then(reg => {
        console.log('Service Worker registered:', swPath);

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          if (gameState === GameState.START) setShowUpdateModal(true);
        }

        const handleUpdateFound = () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available and installed
                setWaitingWorker(newWorker);
                if (gameState === GameState.START) setShowUpdateModal(true);
              }
            });
          }
        };

        // Listen for new workers
        reg.addEventListener('updatefound', handleUpdateFound);

        // Periodically check for updates (every 60s)
        const intervalId = setInterval(() => {
          reg.update().catch(err => console.error('Error checking for SW update:', err));
        }, 60000);

        // Assign cleanup function
        cleanupRegistrationListeners = () => {
          clearInterval(intervalId);
          reg.removeEventListener('updatefound', handleUpdateFound);
        };

      }).catch(err => console.error('Service Worker registration failed:', err));

      // Reload when the new worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        if (cleanupRegistrationListeners) cleanupRegistrationListeners();
        unsubscribe();
      };
    } else {
      return () => {
        unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]); // Added gameState dependency to ensure modal logic works if state changes

  // Periodic Leaderboard Polling (Simple "Realtime")
  useEffect(() => {
    // Poll every 30 seconds to update leaderboard if data changes externally
    const pollId = setInterval(() => {
      // Logic: Sync if:
      // 1. Tab is visible AND Online AND
      // 2. We are NOT playing (Start/GameOver) OR We ARE playing but Paused (Menu Open)
      const shouldSync = !document.hidden && navigator.onLine && (gameState !== GameState.PLAYING || isPaused);

      if (shouldSync) {
        handleSync();
      }
    }, 30000);

    return () => clearInterval(pollId);
  }, [gameState, isPaused]); // Add dependencies so interval closure sees current state

  const handleStart = (diff: Difficulty) => {
    // Check for update before starting - prevent game start if update available
    if (waitingWorker) {
      setShowUpdateModal(true);
      return; // Don't start the game
    }

    saveData({ lastDifficulty: diff });
    setData(prev => ({ ...prev, lastDifficulty: diff }));
    setCurrentScore(0);
    setIsPaused(false); // Reset pause state on start
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
    }

    // Always update local storage first so we don't lose the record
    saveData({ leaderboard: updatedLeaderboard, pendingScores: newPending });
    setData(prev => ({ ...prev, leaderboard: updatedLeaderboard, pendingScores: newPending }));

    // If uploaded successfully OR if we just added to pending, trigger a full sync/refresh
    // This ensures we get the latest global state (including our own new score if uploaded)
    // and ensures pending queue is processed if connection flickered back on
    handleSync();
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

        {showUpdateModal && waitingWorker && (
          <UpdateModal
            onConfirm={async () => {
              // Trigger sync before updating
              await handleSync();
              // Tell service worker to skip waiting and take control
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
              // The page will reload via controllerchange event
            }}
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
            onMenu={() => {
              // Check for update when returning to menu too
              if (waitingWorker) {
                setShowUpdateModal(true);
              } else {
                setGameState(GameState.START);
              }
            }}
            onSaveScore={saveScoreToLeaderboard}
          />
        )}
      </div>
    </div>
  );
};

export default App;
