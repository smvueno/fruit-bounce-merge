import React from 'react';
import { Play, RotateCcw, Home, Music, Music4, Volume2, VolumeX, Vibrate, VibrateOff, Globe, User } from 'lucide-react';
import { GameSettings, LeaderboardEntry } from '../types';
import { RankingTable } from './RankingTable';

interface PauseMenuProps {
    isPaused: boolean;
    onResume: () => void;
    onRestart: () => void;
    onEndGame: () => void;
    onSecretTap: () => void;
    settings: GameSettings;
    onUpdateSettings: (s: GameSettings) => void;
    leaderboard: LeaderboardEntry[];
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
    isPaused, onResume, onRestart, onEndGame, onSecretTap,
    settings, onUpdateSettings, leaderboard
}) => {
    if (!isPaused) return null;

    const toggleMusic = () => onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled });
    const toggleSfx = () => onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled });
    const toggleHaptics = () => onUpdateSettings({ ...settings, hapticsEnabled: !settings.hapticsEnabled });
    const toggleLeaderboardMode = () => onUpdateSettings({ ...settings, showLocalOnly: !settings.showLocalOnly });

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in font-['Fredoka']">
            <div className="bg-white/95 backdrop-blur-xl border border-white/50 shadow-[0_20px_60px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-6 w-full max-w-lg flex flex-col items-center max-h-[85vh] overflow-hidden">

                <h2
                    className="text-4xl font-bold text-gray-800 mb-6 tracking-wide drop-shadow-sm select-none"
                    onClick={onSecretTap}
                >
                    PAUSED
                </h2>

                <RankingTable
                    entries={leaderboard}
                    title={settings.showLocalOnly ? "Local History" : "Global Ranking"}
                    maxHeight="max-h-56 mb-6"
                />

                <div className="w-full space-y-3 mb-6">
                    <button onClick={onResume} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Play size={24} fill="currentColor" /> RESUME
                    </button>
                    <button onClick={onRestart} className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                        <RotateCcw size={24} /> RESTART
                    </button>
                    <button onClick={onEndGame} className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Home size={24} /> END GAME
                    </button>
                </div>

                <div className="flex gap-3 w-full justify-center border-t border-gray-200 pt-4">
                    <button onClick={toggleMusic} className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.musicEnabled ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-gray-200 text-gray-400'}`}>
                        {settings.musicEnabled ? <Music size={24} /> : <Music4 size={24} />}
                    </button>
                    <button onClick={toggleSfx} className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.sfxEnabled ? 'bg-orange-500 text-white hover:bg-orange-400' : 'bg-gray-200 text-gray-400'}`}>
                        {settings.sfxEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </button>
                    <button onClick={toggleHaptics} className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.hapticsEnabled ? 'bg-purple-500 text-white hover:bg-purple-400' : 'bg-gray-200 text-gray-400'}`}>
                        {settings.hapticsEnabled ? <Vibrate size={24} /> : <VibrateOff size={24} />}
                    </button>
                    <button onClick={toggleLeaderboardMode} className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${!settings.showLocalOnly ? 'bg-teal-500 text-white hover:bg-teal-400' : 'bg-gray-200 text-gray-400'}`}>
                        {!settings.showLocalOnly ? <Globe size={24} /> : <User size={24} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
