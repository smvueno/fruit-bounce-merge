
import React, { useEffect, useRef, useState } from 'react';
import { Difficulty, GameSettings, GameStats, FruitTier, LeaderboardEntry } from '../types';
import { GameEngine } from '../services/GameEngine';
import { FRUIT_DEFS } from '../constants';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Vibrate, VibrateOff, Home, Trophy, Music, Music4, Clock, Globe, User } from 'lucide-react';
import { RankingTable } from './RankingTable';
import { saveData } from '../utils/storage';

interface GameCanvasProps {
    difficulty: Difficulty;
    settings: GameSettings;
    onUpdateSettings: (s: GameSettings) => void;
    leaderboard: LeaderboardEntry[];
    onGameOver: (stats: GameStats) => void;
    setScore: (s: number) => void;
}

// Simple large SVG patterns
const BACKGROUND_PATTERNS = [
    `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q25 20 50 10 T100 10' stroke-width='4' stroke='black' fill='none' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L70 70 L10 70 Z' fill='black' /%3E%3C/svg%3E`
];

// --- FRUIT SVG RENDERER (Exact Match to PIXI GameEngine) ---
const FruitSVG: React.FC<{ tier: FruitTier, size: number }> = ({ tier, size }) => {
    const def = FRUIT_DEFS[tier] || FRUIT_DEFS[FruitTier.CHERRY];
    const r = size / 2;
    const eyeColor = "#221111";
    const mouthColor = "#221111";

    // Face positions relative to center (0,0) scaled to radius
    // In PIXI: yEye = -r * 0.1, xEye = r * 0.35, rEye = r * 0.18
    // SVG center is (r, r). 
    const cx = r;
    const cy = r;
    const yEyeOff = -r * 0.1;
    const xEyeOff = r * 0.35;
    const rEye = Math.max(2, r * 0.18);

    const renderPattern = () => {
        const pColor = def.patternColor;
        switch (tier) {
            case FruitTier.CHERRY:
                return <circle cx={cx + r * 0.3} cy={cy - r * 0.3} r={r * 0.2} fill="white" fillOpacity="0.3" />;
            case FruitTier.STRAWBERRY:
                // Random dots (simulated fixed positions for SVG)
                return (
                    <g fill={pColor}>
                        <circle cx={cx - r * 0.4} cy={cy - r * 0.4} r={2} />
                        <circle cx={cx + r * 0.5} cy={cy - r * 0.3} r={2} />
                        <circle cx={cx - r * 0.2} cy={cy + r * 0.5} r={2} />
                        <circle cx={cx + r * 0.4} cy={cy + r * 0.4} r={2} />
                        <circle cx={cx - r * 0.6} cy={cy + r * 0.1} r={2} />
                    </g>
                );
            case FruitTier.CLEMENTINE:
                return <ellipse cx={cx} cy={cy} rx={r * 0.9} ry={r * 0.8} fill="white" fillOpacity="0.1" />;
            case FruitTier.ORANGE:
                return <circle cx={cx} cy={cy} r={r - 2} stroke={pColor} strokeWidth="4" strokeOpacity="0.5" fill="none" />;
            case FruitTier.APPLE:
                return (
                    <g>
                        <ellipse cx={cx - r * 0.3} cy={cy - r * 0.3} rx={r * 0.2} ry={r * 0.3} fill="white" fillOpacity="0.2" />
                        <path d={`M ${cx} ${cy - r * 0.8} Q ${cx + r * 0.2} ${cy - r * 1.1} ${cx + r * 0.4} ${cy - r * 0.9}`} stroke="#33691E" strokeWidth="3" fill="none" />
                    </g>
                );
            case FruitTier.PINEAPPLE:
                return (
                    <g>
                        {/* Cross hatch */}
                        <path d={`M ${cx - r * 0.7} ${cy - r * 0.7} L ${cx + r * 0.7} ${cy + r * 0.7}`} stroke={pColor} strokeWidth="2" strokeOpacity="0.5" />
                        <path d={`M ${cx + r * 0.7} ${cy - r * 0.7} L ${cx - r * 0.7} ${cy + r * 0.7}`} stroke={pColor} strokeWidth="2" strokeOpacity="0.5" />
                        {/* Leaf */}
                        <polygon points={`${cx - 5},${cy - r * 0.9} ${cx},${cy - r * 1.2} ${cx + 5},${cy - r * 0.9}`} fill="#4CAF50" />
                    </g>
                );
            case FruitTier.COCONUT:
                return <circle cx={cx} cy={cy} r={r - 2} stroke={pColor} strokeWidth="4" fill="none" />;
            case FruitTier.PUMPKIN:
                return <ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r} stroke={pColor} strokeWidth="2" strokeOpacity="0.3" fill="none" />;
            case FruitTier.WATERMELON:
                return <circle cx={cx} cy={cy} r={r * 0.9} stroke={pColor} strokeWidth="6" fill="none" />;
            case FruitTier.TOMATO:
                return (
                    <g>
                        <circle cx={cx + r * 0.3} cy={cy - r * 0.3} r={r * 0.35} fill="white" fillOpacity="0.4" />
                        {/* Leaf star */}
                        <polygon points={`${cx},${cy - r * 0.85} ${cx - r * 0.2},${cy - r * 0.7} ${cx + r * 0.2},${cy - r * 0.7}`} fill="#2E7D32" />
                    </g>
                );
            default: return null;
        }
    };

    const renderFace = () => {
        // Shared Eye Styles
        const dotEye = (ox: number) => (
            <g>
                <circle cx={cx + ox} cy={cy + yEyeOff} r={rEye} fill={eyeColor} />
                <circle cx={cx + ox - rEye * 0.3} cy={cy + yEyeOff - rEye * 0.3} r={rEye * 0.3} fill="white" />
            </g>
        );
        const happyEye = (ox: number, s: number = 1.0) => (
            <path d={`M ${cx + ox - rEye * s} ${cy + yEyeOff} A ${rEye * s} ${rEye * s} 0 0 1 ${cx + ox + rEye * s} ${cy + yEyeOff}`} stroke={eyeColor} strokeWidth={rEye / 2} fill="none" strokeLinecap="round" />
        );
        const winkEye = (ox: number) => (
            <path d={`M ${cx + ox - rEye} ${cy + yEyeOff} L ${cx + ox + rEye} ${cy + yEyeOff}`} stroke={eyeColor} strokeWidth={rEye / 2} strokeLinecap="round" />
        );
        const lineEye = (ox: number) => (
            <path d={`M ${cx + ox - rEye} ${cy + yEyeOff} L ${cx + ox + rEye} ${cy + yEyeOff}`} stroke={eyeColor} strokeWidth={rEye / 2} strokeLinecap="round" />
        );
        const starEye = (ox: number) => {
            // Simple star shape
            const pts = [0, -1, 0.3, -0.3, 1, 0, 0.3, 0.3, 0, 1, -0.3, 0.3, -1, 0, -0.3, -0.3].map((v, i) => (i % 2 === 0 ? cx + ox + v * rEye * 1.8 : cy + yEyeOff + v * rEye * 1.8)).join(',');
            return <polygon points={pts} fill="#FFD700" stroke={eyeColor} strokeWidth="1" />;
        };

        switch (tier) {
            case FruitTier.CHERRY:
                return (
                    <g>
                        {dotEye(-xEyeOff)}
                        {dotEye(xEyeOff)}
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye} Q ${cx} ${cy + yEyeOff + rEye + 5} ${cx + rEye} ${cy + yEyeOff + rEye}`} stroke={mouthColor} strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                );
            case FruitTier.STRAWBERRY:
                return (
                    <g>
                        {happyEye(-xEyeOff, 1.2)}
                        {happyEye(xEyeOff, 1.2)}
                        {/* Cat Mouth */}
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 3} ${cx + rEye} ${cy + yEyeOff + rEye * 2}`} stroke={mouthColor} strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                );
            case FruitTier.GRAPE:
                return (
                    <g>
                        {dotEye(-xEyeOff)}
                        {dotEye(xEyeOff)}
                        <circle cx={cx} cy={cy + yEyeOff + rEye * 2} r={rEye * 0.5} stroke={mouthColor} strokeWidth="2" fill="none" />
                    </g>
                );
            case FruitTier.CLEMENTINE:
                return (
                    <g>
                        {winkEye(-xEyeOff)}
                        {dotEye(xEyeOff)}
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 1.5} A ${rEye} ${rEye} 0 0 0 ${cx + rEye} ${cy + yEyeOff + rEye * 1.5} Z`} fill={mouthColor} />
                    </g>
                );
            case FruitTier.ORANGE:
                return (
                    <g>
                        {lineEye(-xEyeOff)}
                        {lineEye(xEyeOff)}
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2.5} L ${cx + rEye} ${cy + yEyeOff + rEye * 2.5}`} stroke={mouthColor} strokeWidth="3" strokeLinecap="round" />
                    </g>
                );
            case FruitTier.APPLE:
                return (
                    <g>
                        {happyEye(-xEyeOff)}
                        {happyEye(xEyeOff)}
                        <path d={`M ${cx - rEye * 0.8} ${cy + yEyeOff + rEye * 1.5} Q ${cx} ${cy + yEyeOff + rEye * 2.5} ${cx + rEye * 0.8} ${cy + yEyeOff + rEye * 1.5}`} stroke={mouthColor} strokeWidth="3" fill="none" strokeLinecap="round" />
                    </g>
                );
            case FruitTier.PINEAPPLE:
                return (
                    <g>
                        {/* Sunglasses */}
                        <rect x={cx - xEyeOff - rEye * 1.5} y={cy + yEyeOff - rEye * 0.5} width={rEye * 3} height={rEye * 1.5} fill="#111" />
                        <rect x={cx + xEyeOff - rEye * 1.5} y={cy + yEyeOff - rEye * 0.5} width={rEye * 3} height={rEye * 1.5} fill="#111" />
                        <line x1={cx - xEyeOff} y1={cy + yEyeOff} x2={cx + xEyeOff} y2={cy + yEyeOff} stroke="#111" strokeWidth="2" />
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 3} ${cx + rEye} ${cy + yEyeOff + rEye * 2}`} stroke={mouthColor} strokeWidth="3" fill="none" strokeLinecap="round" />
                    </g>
                );
            case FruitTier.COCONUT:
                return (
                    <g>
                        {winkEye(-xEyeOff)}
                        {winkEye(xEyeOff)}
                        <circle cx={cx} cy={cy + yEyeOff + rEye * 2.5} r={rEye * 0.5} stroke={mouthColor} strokeWidth="2" fill="none" />
                    </g>
                );
            case FruitTier.PUMPKIN:
                return (
                    <g>
                        {/* Triangle eyes */}
                        <polygon points={`${cx - xEyeOff},${cy + yEyeOff - rEye} ${cx - xEyeOff - rEye},${cy + yEyeOff + rEye} ${cx - xEyeOff + rEye},${cy + yEyeOff + rEye}`} fill={mouthColor} />
                        <polygon points={`${cx + xEyeOff},${cy + yEyeOff - rEye} ${cx + xEyeOff - rEye},${cy + yEyeOff + rEye} ${cx + xEyeOff + rEye},${cy + yEyeOff + rEye}`} fill={mouthColor} />
                        {/* Zigzag mouth */}
                        <polygon points={`${cx - rEye * 2},${cy + yEyeOff + rEye * 2} ${cx - rEye},${cy + yEyeOff + rEye * 3} ${cx},${cy + yEyeOff + rEye * 2} ${cx + rEye},${cy + yEyeOff + rEye * 3} ${cx + rEye * 2},${cy + yEyeOff + rEye * 2}`} stroke={mouthColor} strokeWidth="3" fill="none" strokeLinejoin="round" />
                    </g>
                );
            case FruitTier.WATERMELON:
                return (
                    <g>
                        {starEye(-xEyeOff)}
                        {starEye(xEyeOff)}
                        {/* Tongue mouth */}
                        <path d={`M ${cx - rEye * 1.5} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 5} ${cx + rEye * 1.5} ${cy + yEyeOff + rEye * 2} Z`} fill="#660000" />
                        <path d={`M ${cx - rEye * 0.8} ${cy + yEyeOff + rEye * 3.5} A ${rEye * 0.8} ${rEye * 0.8} 0 0 0 ${cx + rEye * 0.8} ${cy + yEyeOff + rEye * 3.5}`} fill="#FF6666" />
                    </g>
                );
            case FruitTier.TOMATO:
                return (
                    <g>
                        {winkEye(-xEyeOff)}
                        {winkEye(xEyeOff)}
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye * 2} Q ${cx} ${cy + yEyeOff + rEye * 3} ${cx + rEye} ${cy + yEyeOff + rEye * 2}`} stroke={mouthColor} strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                );
            default:
                return (
                    <g>
                        {dotEye(-xEyeOff)}
                        {dotEye(xEyeOff)}
                        <path d={`M ${cx - rEye} ${cy + yEyeOff + rEye} Q ${cx} ${cy + yEyeOff + rEye + 5} ${cx + rEye} ${cy + yEyeOff + rEye}`} stroke={mouthColor} strokeWidth="2" fill="none" strokeLinecap="round" />
                    </g>
                );
        }
    };

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={cx} cy={cy} r={r - 2} fill={def.color} stroke={tier !== FruitTier.TOMATO ? def.patternColor : 'none'} strokeWidth={tier !== FruitTier.TOMATO ? 2 : 0} />
            {renderPattern()}
            {renderFace()}
        </svg>
    );
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ difficulty, settings, onUpdateSettings, leaderboard, onGameOver, setScore }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const [combo, setCombo] = useState(0);
    const [fever, setFever] = useState(false);
    const [dangerTime, setDangerTime] = useState(0);
    const [juice, setJuice] = useState(0);
    const [nextFruit, setNextFruit] = useState<FruitTier>(FruitTier.CHERRY);
    const [playTime, setPlayTime] = useState(0);
    const [maxTier, setMaxTier] = useState<FruitTier>(FruitTier.CHERRY);
    const [isPaused, setIsPaused] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [pauseTapCount, setPauseTapCount] = useState(0);

    // Background State
    const [bgPatternIndex, setBgPatternIndex] = useState(0);
    const [bgColor, setBgColor] = useState(FRUIT_DEFS[FruitTier.CHERRY].color);

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
            onFeverStart: () => setFever(true),
            onFeverEnd: () => setFever(false),
            onDanger: (active: boolean, ms: number) => setDangerTime(active ? ms : 0),
            onJuiceUpdate: (j: number, max: number) => setJuice((j / max) * 100),
            onNextFruit: (t: FruitTier) => setNextFruit(t),
            onMaxFruit: (t: FruitTier) => {
                setBgColor(FRUIT_DEFS[t].patternColor);
                setMaxTier(prev => Math.max(prev, t));
            },
            onTimeUpdate: (ms: number) => setPlayTime(ms),
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
        setMaxTier(FruitTier.CHERRY);
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
            <div className="absolute inset-0 pointer-events-none z-0">
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
                            opacity: bgPatternIndex === idx ? 0.12 : 0 // Slightly increased transparency
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
            <div className="absolute top-[35%] left-0 right-0 flex justify-center items-center pointer-events-none z-0">
                {(fever || combo > 1) && (
                    <div className="transform -rotate-6 transition-all duration-200 select-none flex flex-col items-center animate-pop">
                        <h1
                            className="text-5xl font-black text-yellow-400 tracking-wide text-center leading-tight"
                            style={{
                                textShadow: '4px 4px 0px #F97316, 8px 8px 0px rgba(0,0,0,0.2)',
                                WebkitTextStroke: '2px #fff',
                                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
                            }}
                        >
                            {fever ? (
                                <>
                                    <span className="text-6xl block text-purple-400" style={{ textShadow: '4px 4px 0px #6B21A8' }}>FRENZY!! x2</span>
                                </>
                            ) : (
                                `${combo} CHAIN!`
                            )}
                        </h1>
                    </div>
                )}
            </div>

            {/* HUD Layers */}

            {/* Time Display & Level Display - Top Left under Score */}
            <div className="absolute top-24 left-6 z-20 pointer-events-none flex flex-col items-start font-['Fredoka'] gap-1">
                {/* TIME */}
                <div
                    className="text-2xl font-black text-white drop-shadow-md tracking-wide flex items-center gap-2"
                    style={{
                        WebkitTextStroke: '1.5px #4B5563', // Gray-700 outline
                        textShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                    }}
                >
                    {/* Added drop-shadow filter for heavy outlining effect on the SVG */}
                    <Clock size={20} strokeWidth={3} style={{ filter: 'drop-shadow(1px 1px 0 #4B5563) drop-shadow(-1px -1px 0 #4B5563)' }} />
                    {formatTime(playTime)}
                </div>

                {/* MAX LEVEL */}
                <div
                    className="text-2xl font-black text-white drop-shadow-md tracking-wide flex items-center gap-2"
                    style={{
                        WebkitTextStroke: '1.5px #4B5563', // Gray-700 outline
                        textShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                    }}
                >
                    {/* Changed border from white to gray-600 to match text outline (#4B5563) */}
                    <div className="w-5 h-5 rounded-full border-2 border-[#4B5563] shadow-sm" style={{ backgroundColor: FRUIT_DEFS[maxTier]?.color }}></div>
                    LVL {maxTier + 1}
                </div>
            </div>

            {/* Next Fruit Preview - Top Right */}
            <div className="absolute top-6 right-6 pointer-events-auto z-20 flex flex-col items-end gap-3 animate-fade-in">
                <div className="flex flex-col items-center pointer-events-none drop-shadow-md">
                    <div className="text-sm text-gray-400 font-bold mb-1 tracking-widest drop-shadow-sm" style={{ WebkitTextStroke: '0.5px white' }}>NEXT</div>
                    <FruitSVG tier={nextFruit} size={60} />
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

            {/* Debug/Cheat Menu */}
            {debugMode && (
                <div className="absolute bottom-6 left-6 z-30 animate-fade-in pointer-events-auto">
                    <button
                        onClick={() => {
                            if (engineRef.current) {
                                engineRef.current.forceCurrentFruit(FruitTier.TOMATO);
                            }
                        }}
                        className="w-14 h-14 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-red-400 active:scale-95 transition-all"
                        title="Spawn Tomato"
                    >
                        <FruitSVG tier={FruitTier.TOMATO} size={40} />
                    </button>
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
                            className="text-4xl font-black text-gray-800 mb-6 tracking-wide drop-shadow-sm select-none cursor-pointer active:scale-95 transition-transform"
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
