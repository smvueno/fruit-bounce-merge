
import React, { useState, useEffect } from 'react';
import { GameState, Difficulty, GameStats, SavedData, LeaderboardEntry } from './types';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { GameCanvas } from './components/GameCanvas';
import { loadData, saveData } from './utils/storage';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [data, setData] = useState<SavedData>(loadData());
  const [currentScore, setCurrentScore] = useState(0);
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [isNewHigh, setIsNewHigh] = useState(false);

  useEffect(() => {
    // Load initial data
    setData(loadData());
  }, []);

  const handleStart = (diff: Difficulty) => {
    saveData({ lastDifficulty: diff });
    setData(prev => ({ ...prev, lastDifficulty: diff }));
    setCurrentScore(0);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (stats: GameStats) => {
    // Check if score qualifies for leaderboard (Top 10)
    const currentLeaderboard = data.leaderboard || [];
    const sortedLeaderboard = [...currentLeaderboard].sort((a, b) => b.score - a.score);
    const LIMIT = 10;
    
    let qualifies = false;
    // Strictly require a score > 0 to qualify
    if (stats.score > 0) {
        if (sortedLeaderboard.length < LIMIT) {
            qualifies = true;
        } else {
            // Check against the lowest score in the top 10
            // If we have 10 items, index 9 is the last one.
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

  const saveScoreToLeaderboard = (name: string) => {
      if (!finalStats) return;

      const newEntry: LeaderboardEntry = {
          name,
          score: finalStats.score,
          timePlayed: finalStats.timePlayed,
          maxTier: finalStats.maxTier,
          date: new Date().toISOString()
      };

      const currentLeaderboard = data.leaderboard || [];
      const updatedLeaderboard = [...currentLeaderboard, newEntry]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10); // Keep top 10 in storage (Matches display limit)

      saveData({ leaderboard: updatedLeaderboard });
      setData(prev => ({ ...prev, leaderboard: updatedLeaderboard }));
  };
  
  const updateSettings = (s: any) => {
    saveData({ settings: s });
    setData(prev => ({ ...prev, settings: s }));
  };

  return (
    <div className="relative w-full h-full bg-gray-900 flex items-center justify-center overflow-hidden font-sans select-none">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-yellow-100 opacity-5">
        <div className="w-full h-full" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
      </div>

      {/* Responsive Game Container - Fixed Aspect Ratio 2:3 (Portrait) */}
      <div className="relative w-full max-w-[600px] h-full max-h-[95vh] aspect-[2/3] bg-white shadow-2xl rounded-xl overflow-hidden ring-8 ring-black/10 flex flex-col">
        
        {gameState === GameState.START && (
          <StartScreen 
              onStart={handleStart} 
              leaderboard={data.leaderboard || []}
              settings={data.settings}
              onUpdateSettings={updateSettings}
          />
        )}

        {gameState === GameState.PLAYING && (
          <>
              {/* Score Display - Top Left */}
              <div className="absolute top-6 left-6 z-20 pointer-events-none flex flex-col items-start font-['Fredoka']">
                  <div className="text-sm text-gray-400 font-bold mb-1 tracking-widest drop-shadow-sm" style={{ WebkitTextStroke: '0.5px white' }}>SCORE</div>
                  <div 
                      className="text-5xl font-black text-white drop-shadow-md tracking-wide"
                      style={{ 
                          WebkitTextStroke: '2px #4B5563', // Gray-700 outline
                          textShadow: '3px 3px 0px rgba(0,0,0,0.2)'
                      }}
                  >
                      {currentScore.toLocaleString()}
                  </div>
              </div>
              
              <GameCanvas 
                  difficulty={data.lastDifficulty} 
                  settings={data.settings}
                  leaderboard={data.leaderboard || []}
                  onGameOver={handleGameOver}
                  setScore={setCurrentScore}
              />
          </>
        )}

        {gameState === GameState.GAME_OVER && finalStats && (
          <GameOverScreen 
              stats={finalStats}
              isNewHigh={isNewHigh}
              leaderboard={data.leaderboard || []}
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
