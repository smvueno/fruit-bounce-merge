
import React from 'react';
import { Difficulty, GameSettings, LeaderboardEntry } from '../types';
import { Music, Music4, Volume2, VolumeX, Vibrate, VibrateOff, Play, Trophy } from 'lucide-react';

interface StartScreenProps {
  onStart: (diff: Difficulty) => void;
  leaderboard: LeaderboardEntry[];
  settings: GameSettings;
  onUpdateSettings: (s: GameSettings) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, leaderboard, settings, onUpdateSettings }) => {
  const toggleMusic = () => onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled });
  const toggleSfx = () => onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled });
  const toggleHaptics = () => onUpdateSettings({ ...settings, hapticsEnabled: !settings.hapticsEnabled });
  
  // Sort leaderboard just in case
  const topScores = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20 text-center font-['Fredoka'] overflow-hidden">
      
      {/* Animated Background Blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] pointer-events-none">
          <div className="absolute top-[20%] left-[20%] w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-float" style={{animationDuration: '8s'}}></div>
          <div className="absolute top-[30%] right-[20%] w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-float" style={{animationDuration: '10s', animationDelay: '2s'}}></div>
          <div className="absolute bottom-[20%] left-[30%] w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-float" style={{animationDuration: '12s', animationDelay: '4s'}}></div>
      </div>

      {/* High-Opacity Glass Card */}
      <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[3rem] p-8 w-full max-w-sm flex flex-col items-center">
        
        {/* Header */}
        <div className="mb-6 relative">
           <h1 className="text-6xl font-black text-gray-900 drop-shadow-sm tracking-tight leading-none">
             FRUIT<br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">BOUNCE</span>
           </h1>
           <div className="absolute -right-6 -top-4 rotate-12 bg-white border border-gray-100 px-3 py-1 rounded-full text-xs font-bold text-orange-500 shadow-lg">
             MERGE!
           </div>
        </div>

        {/* Mini Leaderboard */}
        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner w-full flex flex-col gap-2">
             <div className="flex items-center justify-center gap-2 text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">
                <Trophy size={14} /> Top Ranking
             </div>
             {topScores.length === 0 ? (
                 <div className="text-slate-400 italic text-sm py-2">No scores yet!</div>
             ) : (
                 topScores.map((entry, idx) => (
                     <div key={idx} className="flex justify-between items-center text-sm font-bold text-slate-700 border-b border-slate-100 last:border-0 pb-1 last:pb-0">
                         <div className="flex gap-2">
                             <span className={`${idx === 0 ? 'text-yellow-500' : 'text-slate-400'}`}>#{idx+1}</span>
                             <span>{entry.name}</span>
                         </div>
                         <span>{entry.score.toLocaleString()}</span>
                     </div>
                 ))
             )}
        </div>

        {/* Main Action - Solid Green Button */}
        <button 
          onClick={() => onStart(Difficulty.HARD)}
          className="group relative w-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-white font-black text-2xl py-6 rounded-3xl shadow-[0_10px_20px_rgba(16,185,129,0.4)] transition-all transform active:scale-95 active:shadow-inner overflow-hidden mb-6"
        >
           <span className="relative z-10 flex items-center justify-center gap-3 drop-shadow-md">
             <Play size={32} fill="currentColor" /> PLAY
           </span>
           {/* Shine Effect */}
           <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
        </button>

        {/* Settings Toggles - Solid Backgrounds */}
        <div className="flex gap-3 w-full justify-center">
          <button 
            onClick={toggleMusic} 
            className={`p-3 rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${
              settings.musicEnabled 
              ? 'bg-blue-500 text-white hover:bg-blue-400' 
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
            aria-label="Toggle Music"
          >
            {settings.musicEnabled ? <Music size={24} /> : <Music4 size={24} />}
          </button>
           <button 
            onClick={toggleSfx} 
            className={`p-3 rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${
              settings.sfxEnabled 
              ? 'bg-orange-500 text-white hover:bg-orange-400' 
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
            aria-label="Toggle SFX"
          >
            {settings.sfxEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
          <button 
            onClick={toggleHaptics} 
            className={`p-3 rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${
              settings.hapticsEnabled 
              ? 'bg-purple-500 text-white hover:bg-purple-400' 
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
            }`}
             aria-label="Toggle Haptics"
          >
            {settings.hapticsEnabled ? <Vibrate size={24} /> : <VibrateOff size={24} />}
          </button>
        </div>
      </div>
      
      <div className="mt-8 flex flex-col items-center gap-2">
        <div className="text-gray-500/60 text-sm font-bold">
          v2026.2 Jens Madsen
        </div>
        <div className="text-gray-400 text-xs font-medium max-w-[250px] leading-tight">
          For my bro who's also called Jens, you're fkn awesome!
        </div>
      </div>
    </div>
  );
};
