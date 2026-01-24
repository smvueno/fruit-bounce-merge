
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Difficulty, GameStats, SavedData, LeaderboardEntry, PopUpType, PopupData } from './types';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { GameCanvas } from './components/GameCanvas';
import { loadData, saveData } from './utils/storage';
import { getGlobalLeaderboard, submitScore, performFullSync, subscribeToLeaderboard, unsubscribeFromLeaderboard } from './services/leaderboardService';
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

  // Ref to track current game state for event listeners
  const gameStateRef = useRef(gameState);

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

  // Update ref when state changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    // Load initial data
    setData(loadData());

    // Clear any stale saving flags from previous session
    offlineManager.setSavingInProgress(false);

    // Initial Sync
    handleSync();

    // Subscribe to Realtime updates for live leaderboard (if online)
    if (offlineManager.isOnline()) {
      subscribeToLeaderboard((newScores) => {
        console.log('Leaderboard updated via Realtime');
        setGlobalLeaderboard(newScores);
      });
    }

    // Listen for connection changes
    const unsubscribe = offlineManager.onConnectionChange((isOnline) => {
      if (isOnline) {
        console.log('Back online - syncing and subscribing to Realtime...');
        handleSync();
        // Subscribe to Realtime when coming back online
        subscribeToLeaderboard((newScores) => {
          console.log('Leaderboard updated via Realtime');
          setGlobalLeaderboard(newScores);
        });
      } else {
        console.log('Gone offline - unsubscribing from Realtime...');
        unsubscribeFromLeaderboard();
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
          // Only show modal if not saving and on start screen
          if (gameStateRef.current === GameState.START && !offlineManager.isSavingInProgress()) {
            setShowUpdateModal(true);
          }
        }

        const handleUpdateFound = () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Check if currently saving before showing update modal
                if (offlineManager.isSavingInProgress()) {
                  console.log('Update available but saving in progress - will retry...');
                  // Retry after a short delay
                  setTimeout(() => handleUpdateFound(), 2000);
                  return;
                }

                // New update available and installed
                setWaitingWorker(newWorker);
                if (gameStateRef.current === GameState.START) setShowUpdateModal(true);
              }
            });
          }
        };

        // Listen for new workers
        reg.addEventListener('updatefound', handleUpdateFound);

        // Periodically check for updates (every 30s)
        const intervalId = setInterval(() => {
          reg.update().catch(err => {
            // Improved error handling - distinguish between server offline and actual errors
            const errorMessage = err?.message || String(err);

            if (errorMessage.includes('Failed to fetch') ||
              errorMessage.includes('NetworkError') ||
              errorMessage.includes('unknown error occurred when fetching')) {
              // Server is offline - this is expected during dev when stopping server
              console.log('ℹ️ Update check skipped - server offline or unreachable');
            } else {
              // Actual error that should be logged
              console.warn('⚠️ Service worker update check failed:', errorMessage);
            }
          });
        }, 30000);

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
        unsubscribeFromLeaderboard(); // Clean up Realtime subscription
      };
    } else {
      return () => {
        unsubscribe();
        unsubscribeFromLeaderboard(); // Clean up Realtime subscription
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - removed gameState dependency

  // Periodic Leaderboard Polling (Fallback for Realtime)
  // Since Realtime handles live updates, we only need occasional polling as a fallback
  useEffect(() => {
    // Poll every 5 minutes to update leaderboard if data changes externally
    const pollId = setInterval(() => {
      // Logic: Sync if:
      // 1. Tab is visible AND Online AND
      // 2. We are NOT playing (Start/GameOver) OR We ARE playing but Paused (Menu Open)
      const shouldSync = !document.hidden && navigator.onLine && (gameState !== GameState.PLAYING || isPaused);

      if (shouldSync) {
        handleSync();
      }
    }, 300000); // 5 minutes (reduced from 30s since Realtime handles live updates)

    return () => clearInterval(pollId);
  }, [gameState, isPaused]); // Add dependencies so interval closure sees current state

  const handleStart = () => {
    // Check for update before starting - prevent game start if update available
    if (waitingWorker) {
      // Navigate to START screen so the modal can be shown
      setGameState(GameState.START);
      setShowUpdateModal(true);
      return; // Don't start the game
    }

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
    const LIMIT = 100; // Expanded to Top 100

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

    setIsNewHigh(qualifies);
    setFinalStats(stats);
    setGameState(GameState.GAME_OVER);
  };

  const saveScoreToLeaderboard = async (name: string) => {
    if (!finalStats) return;

    // Set saving flag to prevent update interruptions
    offlineManager.setSavingInProgress(true);

    try {
      const newEntry: LeaderboardEntry = {
        name,
        score: Math.floor(finalStats.score),
        timePlayed: Math.floor(finalStats.timePlayed),
        maxTier: finalStats.maxTier,
        date: new Date().toISOString()
      };

      // 1. Update Local History
      const currentLeaderboard = data.leaderboard || [];
      const updatedLeaderboard = [...currentLeaderboard, newEntry]
        .sort((a, b) => b.score - a.score);
      // We can keep more history locally if we want, but sticking to logic

      const newPending = [...(data.pendingScores || [])];

      // 3. Conditional Global Upload
      // Only attempt to upload if it qualifies for the global leaderboard (Top 100)
      // If global list is empty (e.g. offline/first load), we assume it qualifies.
      const lowestGlobalScore = globalLeaderboard.length < 100
        ? 0
        : globalLeaderboard[globalLeaderboard.length - 1].score;

      const qualifiesForGlobal = globalLeaderboard.length === 0 || newEntry.score > lowestGlobalScore;

      if (qualifiesForGlobal) {
        // Optimistic Update: Update global state immediately so user sees it in the list
        setGlobalLeaderboard(prev => [...prev, newEntry].sort((a, b) => b.score - a.score));

        // Try Global Submit
        const uploaded = await submitScore(newEntry);
        if (!uploaded) {
          newPending.push(newEntry);
        }
      } else {
        console.log('Score does not qualify for global leaderboard - skipping upload');
      }

      // Always update local storage first so we don't lose the record
      saveData({ leaderboard: updatedLeaderboard, pendingScores: newPending });
      setData(prev => ({ ...prev, leaderboard: updatedLeaderboard, pendingScores: newPending }));

      // If uploaded successfully OR if we just added to pending, trigger a full sync/refresh
      // This ensures we get the latest global state (including our own new score if uploaded)
      // and ensures pending queue is processed if connection flickered back on
      if (qualifiesForGlobal) {
        // Manual Sync with checks to prevent race condition where immediate fetch misses the new score
        const globalData = await performFullSync();
        if (globalData) {
          // Check if newEntry is in globalData
          const exists = globalData.some(e =>
            e.name === newEntry.name &&
            e.score === newEntry.score &&
            e.date === newEntry.date
          );

          let finalData = globalData;
          if (!exists) {
            console.log('New score missing from sync - manually adding to UI');
            // If missing, append ours (and re-sort) to ensure it doesn't disappear
            finalData = [...globalData, newEntry].sort((a, b) => b.score - a.score);
          }

          setGlobalLeaderboard(finalData);

          // Also refresh local pending scores view (performFullSync updates storage)
          const reloaded = loadData();
          setData(prev => ({ ...prev, pendingScores: reloaded.pendingScores }));
        }
      }
    } finally {
      // Always clear the saving flag, even if an error occurred
      offlineManager.setSavingInProgress(false);
    }
  };

  const updateSettings = (s: any) => {
    saveData({ settings: s });
    setData(prev => ({ ...prev, settings: s }));
  };

  const activeLeaderboard = data.settings.showLocalOnly ? (data.leaderboard || []) : globalLeaderboard;

  return (
    <div className="relative w-full h-[100svh] bg-gray-900 flex items-center justify-center overflow-hidden font-sans select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-yellow-100 opacity-5">
        <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      </div>

      {/* Responsive Game Container - Fixed Aspect Ratio 2:3 (Portrait) */}
      <div className="relative w-full h-full max-h-[100svh] bg-white shadow-2xl rounded-xl ring-8 ring-black/10 flex flex-col">

        {gameState === GameState.START && (
          <>
            <StartScreen
              onStart={handleStart}
              leaderboard={activeLeaderboard}
              settings={data.settings}
              onUpdateSettings={updateSettings}
            />

            {/* Update modal only shows on START screen */}
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
          </>
        )}

        {gameState === GameState.PLAYING && (
          <>
            <GameCanvas
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
            onRestart={() => handleStart()}
            onMenu={() => {
              setGameState(GameState.START);
              // Check for update after transitioning to menu
              // Modal will show on START screen if update is available
              if (waitingWorker) {
                setShowUpdateModal(true);
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
