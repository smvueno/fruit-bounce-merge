
import React, { useState } from 'react';
import { GameStats, LeaderboardEntry, FruitTier } from '../types';
import { Home, RotateCcw, Trophy, Clock } from 'lucide-react';
import { FRUIT_DEFS } from '../constants';
import { RankingTable } from './RankingTable';

interface GameOverScreenProps {
  stats: GameStats;
  isNewHigh: boolean;
  leaderboard: LeaderboardEntry[];
  isLocalOnly: boolean;
  onRestart: () => void;
  onMenu: () => void;
  onSaveScore: (name: string) => void;
  onSync?: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ stats, isNewHigh, leaderboard, isLocalOnly, onRestart, onMenu, onSaveScore, onSync }) => {
  const [name, setName] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(true);

  React.useEffect(() => {
    if (onSync) onSync();

    // Cooldown timer
    const timer = setTimeout(() => {
      setIsCoolingDown(false);
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (name.trim().length > 0) {
      onSaveScore(name.trim().substring(0, 10)); // Max 10 chars
      setHasSaved(true);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };


  // Logic for "New Record" (Strictly #1) vs "High Score" (Top 10)
  // stats.score is compared to the CURRENT leaderboard #1 (before saving)
  const currentTopScore = leaderboard.length > 0 ? Math.max(...leaderboard.map(e => e.score)) : 0;
  const isNumberOne = stats.score > currentTopScore;

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 text-white animate-fade-in font-['Fredoka']">

      {/* High-Opacity Glass Card - Widened to max-w-lg (32rem) to fit columns without scroll if possible */}
      <div className="bg-white/95 backdrop-blur-2xl border border-white/50 text-gray-800 rounded-[2.5rem] px-8 py-6 w-full max-w-lg text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] transform scale-100 animate-pop flex flex-col items-center max-h-[85vh] overflow-y-auto min-h-0">

        <h2 className="text-4xl font-bold mb-2 text-red-500 drop-shadow-sm tracking-wide shrink-0">GAME OVER</h2>

        {/* Only show badge if qualifies for leaderboard AND hasn't saved yet */}
        {isNewHigh && !hasSaved && (
          <div className="mb-2 w-full animate-bounce shrink-0">
            <div className={`font-bold px-4 py-2 rounded-xl shadow-lg inline-flex items-center gap-2 ${isNumberOne ? 'bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900' : 'bg-blue-100 text-blue-700'}`}>
              <Trophy size={18} fill="currentColor" />
              {isNumberOne ? "NEW RECORD!" : "HIGH SCORE!"}
            </div>
          </div>
        )}

        <div className="text-5xl font-bold text-gray-900 mb-4 font-mono tracking-tighter drop-shadow-sm shrink-0">
          {stats.score.toLocaleString()}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-4 w-full shrink-0">
          <div className="bg-slate-100 p-2 rounded-2xl flex flex-col items-center">
            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Time</span>
            <span className="text-lg font-bold text-slate-700 flex items-center gap-1">
              <Clock size={14} /> {formatTime(stats.timePlayed)}
            </span>
          </div>
          <div className="bg-slate-100 p-2 rounded-2xl flex flex-col items-center">
            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Level</span>
            <span className="text-lg font-bold text-slate-700 flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FRUIT_DEFS[stats.maxTier]?.color || '#000' }}></div>
              {stats.maxTier + 1}
            </span>
          </div>
        </div>

        {/* Scrollable Leaderboard Area */}
        <RankingTable
          entries={leaderboard}
          highlightEntry={hasSaved ? { score: stats.score, name: name } : undefined}
          title={isLocalOnly ? "Local History" : "Global Leaderboard"}
          maxHeight="max-h-[25vh] mb-4"
        />

        {/* High Score Name Input - Only if new high score AND not saved */}
        {isNewHigh && !hasSaved && (
          <div className="w-full mb-4 shrink-0 animate-fade-in">
            <label className="block text-slate-500 text-sm font-bold mb-2 uppercase tracking-wide">
              {isNumberOne ? "New Record! Enter Name:" : "Enter Name for Leaderboard:"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Player 1"
                maxLength={10}
                className="flex-1 bg-slate-100 border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-800 text-lg focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-300"
              />
              <button
                onClick={handleSave}
                disabled={name.length === 0}
                className="bg-blue-500 text-white font-bold px-6 py-3 rounded-2xl shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                SAVE
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-3 shrink-0">
          <button
            onClick={onRestart}
            disabled={isCoolingDown}
            className={`w-full font-bold text-xl py-4 rounded-2xl shadow-[0_8px_16px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 ${isCoolingDown
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
              : 'bg-amber-500 hover:bg-amber-400 text-white active:scale-95'
              }`}
          >
            <RotateCcw size={24} strokeWidth={3} />
            {isCoolingDown ? 'WAIT...' : 'PLAY AGAIN'}
          </button>

          <button
            onClick={onMenu}
            disabled={isCoolingDown}
            className={`w-full font-bold text-lg py-4 rounded-2xl transition-all flex items-center justify-center gap-2 ${isCoolingDown
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-slate-200 hover:bg-slate-300 text-slate-600 active:scale-95'
              }`}
          >
            <Home size={22} /> MENU
          </button>
        </div>

      </div>
    </div>
  );
};
