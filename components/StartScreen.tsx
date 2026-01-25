import React from 'react';
import { GameSettings, LeaderboardEntry } from '../types';
import { RankingTable } from './RankingTable';
import { Music, Music4, Volume2, VolumeX, Vibrate, VibrateOff, Play, Trophy, Globe, User, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { InstallPromptModal } from './InstallPromptModal';

interface StartScreenProps {
  onStart: () => void;
  leaderboard: LeaderboardEntry[];
  settings: GameSettings;
  onUpdateSettings: (s: GameSettings) => void;
  onSync?: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart, leaderboard, settings, onUpdateSettings, onSync }) => {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [showIOSPrompt, setShowIOSPrompt] = React.useState(false);

  React.useEffect(() => {
    if (onSync) onSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMusic = () => onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled });
  const toggleSfx = () => onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled });
  const toggleHaptics = () => onUpdateSettings({ ...settings, hapticsEnabled: !settings.hapticsEnabled });
  const toggleLeaderboardMode = () => onUpdateSettings({ ...settings, showLocalOnly: !settings.showLocalOnly });

  const handleInstallClick = async () => {
    const result = await promptInstall();
    if (result === 'iOS') {
      setShowIOSPrompt(true);
    }
  };

  const leaderboardTitle = settings.showLocalOnly ? "Local Best" : "Global Ranking";

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pt-4 pb-4 md:pt-6 md:pb-6 z-20 text-center font-['Fredoka']">

      {showIOSPrompt && (
        <InstallPromptModal onClose={() => setShowIOSPrompt(false)} />
      )}

      {/* Main Container - Removed heavy card styling to blend with global background */}
      <div className="relative w-full max-w-lg max-h-[100vh] flex flex-col items-center min-h-0 mx-4">

        {/* Header */}
        <div className="mb-4 md:mb-6 relative shrink-0">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 drop-shadow-sm tracking-tight leading-none">
            FRUITY<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">FUSE</span>
          </h1>
          <div className="text-lg md:text-xl font-bold text-orange-400 mt-2 tracking-wider">
            Flick & Bounce
          </div>
        </div>

        {/* Standardized Leaderboard */}
        <RankingTable
          entries={leaderboard}
          title={leaderboardTitle}
          maxHeight="max-h-[35vh] md:max-h-[30vh] mb-3 md:mb-4 overflow-hidden"
        />

        {/* Main Actions Area */}
        <div className="w-full mb-4 md:mb-6 shrink-0 flex gap-2 md:gap-3">
            {isInstallable && (
                <button
                    onClick={handleInstallClick}
                    className="group relative bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-300 hover:to-blue-400 text-white font-bold p-3 md:p-6 rounded-2xl md:rounded-3xl shadow-[0_10px_20px_rgba(59,130,246,0.4)] transition-all transform active:scale-95 active:shadow-inner flex items-center justify-center shrink-0 aspect-square h-auto"
                    aria-label="Install App"
                >
                    <div className="hidden md:block">
                        <Download size={32} strokeWidth={3} />
                    </div>
                    <div className="block md:hidden">
                        <Download size={24} strokeWidth={3} />
                    </div>
                    {/* Shine Effect */}
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                </button>
            )}

            <button
                onClick={() => onStart()}
                className="group relative flex-grow bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-white font-bold text-xl md:text-2xl py-3 md:py-6 rounded-2xl md:rounded-3xl shadow-[0_10px_20px_rgba(16,185,129,0.4)] transition-all transform active:scale-95 active:shadow-inner overflow-hidden"
            >
                <span className="relative z-10 flex items-center justify-center gap-2 md:gap-3 drop-shadow-md">
                    <div className="hidden md:block">
                        <Play size={32} fill="currentColor" />
                    </div>
                    <div className="block md:hidden">
                        <Play size={24} fill="currentColor" />
                    </div>
                     PLAY
                </span>
                {/* Shine Effect */}
                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
            </button>
        </div>

        {/* Settings Toggles - Solid Backgrounds */}
        <div className="flex gap-2 md:gap-3 w-full justify-center shrink-0">
          <button
            onClick={toggleMusic}
            className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.musicEnabled
              ? 'bg-blue-500 text-white hover:bg-blue-400'
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
              }`}
            aria-label="Toggle Music"
          >
            {settings.musicEnabled ?
                <><Music size={24} className="hidden md:block" /><Music size={20} className="block md:hidden" /></> :
                <><Music4 size={24} className="hidden md:block" /><Music4 size={20} className="block md:hidden" /></>
            }
          </button>
          <button
            onClick={toggleSfx}
            className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.sfxEnabled
              ? 'bg-orange-500 text-white hover:bg-orange-400'
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
              }`}
            aria-label="Toggle SFX"
          >
            {settings.sfxEnabled ?
                <><Volume2 size={24} className="hidden md:block" /><Volume2 size={20} className="block md:hidden" /></> :
                <><VolumeX size={24} className="hidden md:block" /><VolumeX size={20} className="block md:hidden" /></>
            }
          </button>
          <button
            onClick={toggleHaptics}
            className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.hapticsEnabled
              ? 'bg-purple-500 text-white hover:bg-purple-400'
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
              }`}
            aria-label="Toggle Haptics"
          >
            {settings.hapticsEnabled ?
                <><Vibrate size={24} className="hidden md:block" /><Vibrate size={20} className="block md:hidden" /></> :
                <><VibrateOff size={24} className="hidden md:block" /><VibrateOff size={20} className="block md:hidden" /></>
            }
          </button>
          <button
            onClick={toggleLeaderboardMode}
            className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-md transition-all active:scale-95 flex justify-center items-center ${!settings.showLocalOnly
              ? 'bg-teal-500 text-white hover:bg-teal-400'
              : 'bg-gray-200 text-gray-400 hover:bg-gray-300'
              }`}
            aria-label="Toggle Leaderboard Mode"
          >
            {!settings.showLocalOnly ?
                <><Globe size={24} className="hidden md:block" /><Globe size={20} className="block md:hidden" /></> :
                <><User size={24} className="hidden md:block" /><User size={20} className="block md:hidden" /></>
            }
          </button>
        </div>
      </div>

      <div className="mt-4 md:mt-8 flex flex-col items-center gap-2">
        <div className="text-gray-400 text-[10px] md:text-xs font-medium max-w-[250px] leading-tight">
          For my bro who's also called Jens, you're fkn awesome!
        </div>
        <div className="text-gray-500/60 text-[10px] md:text-xs font-bold flex flex-col items-center">
          <span>Build Date: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Dev'}</span>
          <span>Jens Madsen</span>
        </div>
      </div>
    </div>
  );
};
