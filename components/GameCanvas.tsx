
import React, { useEffect, useRef, useState } from 'react';
import { Difficulty, GameSettings, GameStats, FruitTier, LeaderboardEntry } from '../types';
import { GameEngine } from '../services/GameEngine';
import { FRUIT_DEFS } from '../constants';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Vibrate, VibrateOff, Home, Trophy, Music, Music4, Clock, Globe, User, X } from 'lucide-react';
import { RankingTable } from './RankingTable';
import { saveData } from '../utils/storage';

interface GameCanvasProps {
    difficulty: Difficulty;
    settings: GameSettings;
    onUpdateSettings: (s: GameSettings) => void;
    leaderboard: LeaderboardEntry[];
    onGameOver: (stats: GameStats) => void;
    setScore: (s: number) => void;
    onSync?: () => void;
}

// Simple large SVG patterns
const BACKGROUND_PATTERNS = [
    `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /%3E%3C/svg%3E`,
    // Removed Waves (Too small)
    // Replaced with cleaner Heart Path:
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L70 70 L10 70 Z' fill='black' /%3E%3C/svg%3E`
];

// --- FRUIT SVG RENDERER (Exact Match to PIXI GameEngine) ---
const FruitSVG: React.FC<{ tier: FruitTier, size: number }> = ({ tier, size }) => {
    const def = FRUIT_DEFS[tier] || FRUIT_DEFS[FruitTier.CHERRY];
    return <>{def.renderSvg(size)}</>;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ difficulty, settings, onUpdateSettings, leaderboard, onGameOver, setScore }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const [combo, setCombo] = useState(0);
    const [fever, setFever] = useState(false);
    const [dangerTime, setDangerTime] = useState(0);
    const [juice, setJuice] = useState(0);
    const [nextFruit, setNextFruit] = useState<FruitTier>(FruitTier.CHERRY);
    const [savedFruit, setSavedFruit] = useState<FruitTier | null>(null);
    const [playTime, setPlayTime] = useState(0);
    const [maxTier, setMaxTier] = useState<FruitTier>(FruitTier.CHERRY);
    const [isPaused, setIsPaused] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [pauseTapCount, setPauseTapCount] = useState(0);
    const [showCelebration, setShowCelebration] = useState(false);

    // Background State
    const [bgPatternIndex, setBgPatternIndex] = useState(0);
    const [bgColor, setBgColor] = useState(FRUIT_DEFS[FruitTier.CHERRY].color);
    const [currentFeverMult, setCurrentFeverMult] = useState(1);

    useEffect(() => {
        // Cycle patterns randomly every 20-30 seconds
        const interval = setInterval(() => {
            setBgPatternIndex(Math.floor(Math.random() * BACKGROUND_PATTERNS.length));
        }, 25000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;

        const engine = new GameEngine(canvasRef.current, difficulty, settings, {
            onScore: (amt: number, total: number) => setScore(total),
            onGameOver: onGameOver,
            onCombo: (c: number) => setCombo(c),
            onFeverStart: (mult: number) => {
                setFever(true);
                setCurrentFeverMult(mult);
            },
            onFeverEnd: () => setFever(false),
            onDanger: (active: boolean, ms: number) => setDangerTime(active ? ms : 0),
            onJuiceUpdate: (j: number, max: number) => setJuice((j / max) * 100),
            onNextFruit: (t: FruitTier) => setNextFruit(t),
            onMaxFruit: (t: FruitTier) => {
                if (FRUIT_DEFS[t]) { // Safety check
                    setBgColor(FRUIT_DEFS[t].patternColor);
                }
                setMaxTier(prev => Math.max(prev, t));
            },
            onTimeUpdate: (ms: number) => setPlayTime(ms),
            onSaveUpdate: (t: FruitTier | null) => setSavedFruit(t),
            onCelebration: () => {
                setShowCelebration(true);
                setTimeout(() => setShowCelebration(false), 4000);
            }
        });

        engine.initialize().catch(e => console.error("Game init failed", e));

        engineRef.current = engine;

        return () => {
            engine.cleanup();
            engineRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update engine settings when props change
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.updateSettings(settings);
        }
    }, [settings]);

    const handlePauseToggle = () => {
        const newState = !isPaused;
        setIsPaused(newState);
        if (newState && onSync) {
            onSync();
        }
        if (engineRef.current) {
            engineRef.current.setPaused(newState);
        }
    };

    const handleRestart = () => {
        if (engineRef.current) {
            engineRef.current.reset(); // Use new reset method instead of destroy/init
        }
        setIsPaused(false);
        setScore(0);
        setCombo(0);
        setFever(false);
        setJuice(0);
        setPlayTime(0);
        setSavedFruit(null);
        setMaxTier(FruitTier.CHERRY);
        setShowCelebration(false);
    };

    const handleEndGame = () => {
        if (engineRef.current) {
            engineRef.current.gameOver();
        }
    };

    const toggleMusic = () => onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled });
    const toggleSfx = () => onUpdateSettings({ ...settings, sfxEnabled: !settings.sfxEnabled });
    const toggleHaptics = () => onUpdateSettings({ ...settings, hapticsEnabled: !settings.hapticsEnabled });
    const toggleLeaderboardMode = () => onUpdateSettings({ ...settings, showLocalOnly: !settings.showLocalOnly });

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative w-full h-full bg-white font-['Fredoka'] overflow-hidden">

            {/* --- BACKGROUND LAYER 0: Static Cream Base --- */}
            <div className="absolute inset-0 bg-[#FFF8E1] z-0"></div>

            {/* --- BACKGROUND LAYER 1: Scrolling Pattern (Masked) --- */}
            <div
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                    // Apply static gradient fade mask here on the container
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
                    maskComposite: 'intersect',
                    WebkitMaskComposite: 'source-in'
                }}
            >
                {/* Use opacity transition for pattern switching */}
                {BACKGROUND_PATTERNS.map((pat, idx) => (
                    <div
                        key={idx}
                        className={`absolute inset-0 animate-mask-scroll transition-opacity duration-2000`}
                        style={{
                            // Masking technique to color the pattern dynamically
                            maskImage: `url("${pat}")`,
                            WebkitMaskImage: `url("${pat}")`,
                            maskSize: '50px',       // 50px size
                            WebkitMaskSize: '50px',
                            backgroundColor: bgColor, // The pattern takes this color
                            opacity: bgPatternIndex === idx ? 0.18 : 0, // Slightly increased transparency (Was 0.12)
                            animationDuration: fever ? '2.5s' : '20s' // 8x speed (DOUBLE previous frenzy) during fever
                        }}
                    />
                ))}
            </div>

            {/* --- BACKGROUND LAYER 2: Juice/Water Level (Seamless Wave) --- */}
            <div className="absolute inset-0 pointer-events-none z-0 flex items-end opacity-40">
                <div
                    className={`w-full relative transition-all ease-in-out ${fever ? 'bg-purple-500' : 'bg-blue-400'}`}
                    // Slow down the filling animation (3s)
                    style={{ height: `${juice}%`, transitionDuration: '3000ms' }}
                >
                    {/* Animated Wave SVG */}
                    <div
                        className="absolute top-0 left-0 right-0 -mt-6 h-6 w-full animate-wave"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z' fill='${fever ? '%23A855F7' : '%2360A5FA'}' /%3E%3C/svg%3E")`,
                            backgroundSize: '100px 100%',
                            backgroundRepeat: 'repeat-x'
                        }}
                    />
                </div>
            </div>

            {/* Graffiti Combo / Fever Text (Centered & Moved Down) */}
            <div className="absolute top-[35%] left-[15%] right-[15%] w-[70%] flex justify-center items-center pointer-events-none z-30 opacity-60">
                {(fever || combo > 1) && (
                    <div className="transform -rotate-6 transition-all duration-200 select-none flex flex-col items-center animate-pop">
                        <h1
                            className="text-7xl font-black text-yellow-400 tracking-wide text-center leading-tight"
                            style={{
                                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                                textShadow: '3px 3px 0 #F97316'
                            }}
                        >
                            {fever ? (
                                <>
                                    <span className="text-8xl block text-gray-900 drop-shadow-sm leading-tight">FRENZY!! x{currentFeverMult}</span>
                                </>
                            ) : (
                                <span className="text-7xl block text-gray-900 drop-shadow-sm leading-tight">{combo} CHAIN!</span>
                            )}
                        </h1>
                    </div>
                )}
            </div>

            {/* HUD Layers */}

            {/* Time Display & Level Display - Top Left under Score */}
            <div className="absolute top-28 left-6 z-20 pointer-events-none flex flex-col items-start font-['Fredoka'] gap-1">
                {/* TIME */}
                <div className="text-2xl font-black text-gray-900 drop-shadow-sm tracking-wide flex items-center gap-2 opacity-90">
                    <Clock size={20} className="text-gray-900" strokeWidth={3} />
                    {formatTime(playTime)}
                </div>

                {/* MAX LEVEL */}
                <div className="text-2xl font-black text-gray-900 drop-shadow-sm tracking-wide flex items-center gap-2 opacity-90">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-900 shadow-sm" style={{ backgroundColor: (FRUIT_DEFS[maxTier] || FRUIT_DEFS[FruitTier.WATERMELON])?.color }}></div>
                    LVL {maxTier >= 10 ? 11 : maxTier + 1}
                </div>
            </div>

            {/* Top Right Container: Next Fruit & Save Box */}
            <div className="absolute top-6 right-6 pointer-events-auto z-20 flex flex-col items-center gap-6 animate-fade-in">

                {/* Next Fruit */}
                <div className="flex flex-col items-center pointer-events-none drop-shadow-md">
                    <div className="text-sm text-gray-900 font-bold mb-1 tracking-widest drop-shadow-sm opacity-80">NEXT</div>
                    <FruitSVG tier={nextFruit} size={60} />
                </div>

                {/* Save Box */}
                <div
                    className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform group"
                    onClick={() => engineRef.current?.swapSavedFruit()}
                    title="Tap to Save/Swap Fruit"
                >
                    <div className="text-sm text-gray-900 font-bold mb-1 tracking-widest drop-shadow-sm opacity-80">SAVE</div>
                    <div className="w-[70px] h-[70px] rounded-2xl border-4 border-gray-900 bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg relative overflow-hidden">
                        {savedFruit !== null ? (
                            <div className="animate-pop">
                                <FruitSVG tier={savedFruit} size={60} />
                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            </div>
                        ) : (
                            <div className="text-gray-500 text-xs font-bold opacity-40">EMPTY</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Pause Button - Bottom Center (On the Floor) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-fade-in">
                <button
                    onClick={handlePauseToggle}
                    className="w-14 h-14 bg-[#558B2F] hover:bg-[#33691E] text-white border-4 border-[#2E5A1C] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    aria-label="Pause Game"
                >
                    <Pause size={28} fill="currentColor" />
                </button>
            </div>

            {/* Debug/Cheat Menu - Left Side Under Level/Score */}
            {debugMode && (
                <div className="absolute left-6 top-56 z-30 animate-fade-in pointer-events-auto flex flex-col gap-2 mt-4">
                    {/* Bomb Button - 50% transparent */}
                    <button
                        onClick={() => {
                            if (engineRef.current) {
                                engineRef.current.forceCurrentFruit(FruitTier.BOMB);
                            }
                        }}
                        className="w-14 h-14 bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800/50 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-600 active:scale-95 transition-all group"
                        title="Spawn Bomb"
                    >
                        <FruitSVG tier={FruitTier.BOMB} size={40} />
                    </button>
                    {/* Rainbow Button - 50% transparent */}
                    <button
                        onClick={() => {
                            if (engineRef.current) {
                                engineRef.current.forceCurrentFruit(FruitTier.RAINBOW);
                            }
                        }}
                        className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-pink-300 active:scale-95 transition-all group"
                        title="Spawn Rainbow"
                    >
                        <FruitSVG tier={FruitTier.RAINBOW} size={40} />
                    </button>
                    {/* Tomato Button - 50% transparent */}
                    <button
                        onClick={() => {
                            if (engineRef.current) {
                                engineRef.current.forceCurrentFruit(FruitTier.TOMATO);
                            }
                        }}
                        className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-red-400 active:scale-95 transition-all"
                        title="Spawn Tomato"
                    >
                        <FruitSVG tier={FruitTier.TOMATO} size={40} />
                    </button>
                    {/* Close Cheat Menu Button - 50% transparent */}
                    <button
                        onClick={() => setDebugMode(false)}
                        className="w-14 h-14 bg-red-500/50 backdrop-blur-sm hover:bg-red-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-red-700 active:scale-95 transition-all"
                        title="Close Cheat Menu"
                    >
                        <X size={24} className="text-white" strokeWidth={3} />
                    </button>
                </div>
            )}


            {/* Watermelon Celebration Overlay (Level 11) */}
            {showCelebration && (
                <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center animate-pop-in">
                    <div className="flex flex-col items-center transform -rotate-3">
                        <h1 className="text-6xl font-black text-green-500 drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] tracking-tighter text-center leading-none"
                            style={{ WebkitTextStroke: '3px #1B5E20' }}>
                            WATERMELON<br/>CRUSH!
                        </h1>
                        <div className="text-4xl font-black text-white mt-4 drop-shadow-lg stroke-black"
                            style={{ WebkitTextStroke: '2px black' }}>
                            LEVEL 11 REACHED!
                        </div>
                    </div>
                </div>
            )}

            {/* Danger Overlay */}
            {dangerTime > 0 && (
                <div className="absolute inset-0 pointer-events-none z-0 flex flex-col items-center pt-32 animate-pulse-danger">
                    <div className="w-full h-1 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.8)]"></div>
                    <div className="mt-4 text-6xl font-black text-red-600 drop-shadow-lg" style={{ WebkitTextStroke: '2px white' }}>
                        {(dangerTime / 1000).toFixed(1)}
                    </div>
                    <div className="text-red-500 font-bold uppercase tracking-widest text-2xl drop-shadow-md">DANGER!</div>
                </div>
            )}

            {/* PAUSE MENU OVERLAY (Fixed High Contrast) */}
            {isPaused && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
                    {/* High opacity white bg for readability */}
                    <div className="bg-white/95 backdrop-blur-xl border border-white/50 shadow-[0_20px_60px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-6 w-full max-w-lg flex flex-col items-center max-h-[85vh] overflow-hidden">

                        <h2
                            className="text-4xl font-black text-gray-800 mb-6 tracking-wide drop-shadow-sm select-none"
                            onClick={() => {
                                setPauseTapCount(prev => {
                                    const newCount = prev + 1;
                                    if (newCount >= 10) {
                                        setDebugMode(true);
                                    }
                                    return newCount;
                                });
                            }}
                        >
                            PAUSED
                        </h2>

                        {/* High Score Table (Scrollable) */}
                        <RankingTable
                            entries={leaderboard}
                            title={settings.showLocalOnly ? "Local History" : "Global Ranking"}
                            maxHeight="max-h-56 mb-6"
                        />

                        <div className="w-full space-y-3 mb-6">
                            {/* Resume - Blue Solid */}
                            <button
                                onClick={handlePauseToggle}
                                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <Play size={24} fill="currentColor" /> RESUME
                            </button>

                            {/* Restart - Amber Solid */}
                            <button
                                onClick={handleRestart}
                                className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <RotateCcw size={24} /> RESTART
                            </button>

                            {/* End Game - Red Solid */}
                            <button
                                onClick={handleEndGame}
                                className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <Home size={24} /> END GAME
                            </button>
                        </div>

                        {/* Settings Row */}
                        <div className="flex gap-3 w-full justify-center border-t border-gray-200 pt-4">
                            <button
                                onClick={toggleMusic}
                                className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.musicEnabled
                                    ? 'bg-blue-500 text-white hover:bg-blue-400'
                                    : 'bg-gray-200 text-gray-400'
                                    }`}
                                aria-label="Toggle Music"
                            >
                                {settings.musicEnabled ? <Music size={24} /> : <Music4 size={24} />}
                            </button>
                            <button
                                onClick={toggleSfx}
                                className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.sfxEnabled
                                    ? 'bg-orange-500 text-white hover:bg-orange-400'
                                    : 'bg-gray-200 text-gray-400'
                                    }`}
                                aria-label="Toggle SFX"
                            >
                                {settings.sfxEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                            </button>
                            <button
                                onClick={toggleHaptics}
                                className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${settings.hapticsEnabled
                                    ? 'bg-purple-500 text-white hover:bg-purple-400'
                                    : 'bg-gray-200 text-gray-400'
                                    }`}
                                aria-label="Toggle Haptics"
                            >
                                {settings.hapticsEnabled ? <Vibrate size={24} /> : <VibrateOff size={24} />}
                            </button>
                            <button
                                onClick={toggleLeaderboardMode}
                                className={`flex-1 py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center ${!settings.showLocalOnly
                                    ? 'bg-teal-500 text-white hover:bg-teal-400'
                                    : 'bg-gray-200 text-gray-400'
                                    }`}
                                aria-label="Toggle Leaderboard Mode"
                            >
                                {!settings.showLocalOnly ? <Globe size={24} /> : <User size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <canvas ref={canvasRef} className="w-full h-full touch-none cursor-grab active:cursor-grabbing relative z-10" />
        </div>
    );
};
