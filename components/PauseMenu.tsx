import React from 'react';
import { Play, RotateCcw, Home, Music, Music4, Volume2, VolumeX, Vibrate, VibrateOff, Globe, User, Maximize, Minimize } from 'lucide-react';
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

    const [isCoolingDown, setIsCoolingDown] = React.useState(true);

    React.useEffect(() => {
        // Cooldown timer - resets when pause menu opens
        setIsCoolingDown(true);
        const timer = setTimeout(() => {
            setIsCoolingDown(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, [isPaused]);

    const toggleMusic = () => onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled });
    const toggleSfx = () => onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled });
    const toggleHaptics = () => onUpdateSettings({ ...settings, hapticsEnabled: !settings.hapticsEnabled });
    const toggleLeaderboardMode = () => onUpdateSettings({ ...settings, showLocalOnly: !settings.showLocalOnly });

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                onUpdateSettings({ ...settings, fullscreenEnabled: true });
            } else {
                await document.exitFullscreen();
                onUpdateSettings({ ...settings, fullscreenEnabled: false });
            }
        } catch (err) {
            console.warn('Fullscreen toggle failed:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md animate-fade-in font-['Fredoka']">
            <div className="bg-white/95 backdrop-blur-xl border border-white/50 shadow-[0_20px_60px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-6 w-full max-w-lg mx-4 flex flex-col items-center max-h-[85vh] overflow-hidden">

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
                    <button onClick={onResume} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold text-base md:text-xl py-3 md:py-6 rounded-2xl md:rounded-3xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                        <Play size={20} fill="currentColor" /> RESUME
                    </button>

                    {/* Combined Restart and End Game buttons */}
                    <div className="w-full flex gap-3">
                        <button
                            onClick={onEndGame}
                            disabled={isCoolingDown}
                            className={`flex-1 font-bold text-base md:text-xl py-3 md:py-6 rounded-2xl md:rounded-3xl shadow-lg transition-all flex items-center justify-center gap-2 ${isCoolingDown
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                : 'bg-red-500 hover:bg-red-400 text-white active:scale-95'
                                }`}
                        >
                            <Home size={20} /> END GAME
                        </button>
                        <button
                            onClick={onRestart}
                            disabled={isCoolingDown}
                            className={`flex-1 font-bold text-base md:text-xl py-3 md:py-6 rounded-2xl md:rounded-3xl shadow-lg transition-all flex items-center justify-center gap-2 ${isCoolingDown
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                                : 'bg-amber-500 hover:bg-amber-400 text-white active:scale-95'
                                }`}
                        >
                            <RotateCcw size={20} /> RESTART
                        </button>
                    </div>
                </div>

                <div className="flex gap-3 w-full justify-center border-t border-gray-200 pt-4">
                    <button onClick={toggleMusic} className={`flex-1 p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.musicEnabled ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-gray-200 text-gray-400'}`}>
                        {settings.musicEnabled ? <Music size={24} className="hidden md:block" /> : <Music4 size={24} className="hidden md:block" />}
                        {settings.musicEnabled ? <Music size={20} className="block md:hidden" /> : <Music4 size={20} className="block md:hidden" />}
                    </button>
                    <button onClick={toggleSfx} className={`flex-1 p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.sfxEnabled ? 'bg-orange-500 text-white hover:bg-orange-400' : 'bg-gray-200 text-gray-400'}`}>
                        {settings.sfxEnabled ? <Volume2 size={24} className="hidden md:block" /> : <VolumeX size={24} className="hidden md:block" />}
                        {settings.sfxEnabled ? <Volume2 size={20} className="block md:hidden" /> : <VolumeX size={20} className="block md:hidden" />}
                    </button>
                    <button onClick={toggleHaptics} className={`flex-1 p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.hapticsEnabled ? 'bg-purple-500 text-white hover:bg-purple-400' : 'bg-gray-200 text-gray-400'}`}>
                        {settings.hapticsEnabled ? <Vibrate size={24} className="hidden md:block" /> : <VibrateOff size={24} className="hidden md:block" />}
                        {settings.hapticsEnabled ? <Vibrate size={20} className="block md:hidden" /> : <VibrateOff size={20} className="block md:hidden" />}
                    </button>
                    <button onClick={toggleLeaderboardMode} className={`flex-1 p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${!settings.showLocalOnly ? 'bg-teal-500 text-white hover:bg-teal-400' : 'bg-gray-200 text-gray-400'}`}>
                        {!settings.showLocalOnly ? <Globe size={24} className="hidden md:block" /> : <User size={24} className="hidden md:block" />}
                        {!settings.showLocalOnly ? <Globe size={20} className="block md:hidden" /> : <User size={20} className="block md:hidden" />}
                    </button>
                    <button onClick={toggleFullscreen} className={`flex-1 p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${document.fullscreenElement ? 'bg-indigo-500 text-white hover:bg-indigo-400' : 'bg-gray-200 text-gray-400'}`}>
                        {document.fullscreenElement ? <Minimize size={24} className="hidden md:block" /> : <Maximize size={24} className="hidden md:block" />}
                        {document.fullscreenElement ? <Minimize size={20} className="block md:hidden" /> : <Maximize size={20} className="block md:hidden" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
