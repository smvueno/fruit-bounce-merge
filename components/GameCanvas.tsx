
import React, { useEffect, useRef, useState } from 'react';
import { Difficulty, GameSettings, GameStats, FruitTier, LeaderboardEntry } from '../types';
import { GameEngine } from '../services/GameEngine';
import { FRUIT_DEFS } from '../constants';
import { DebugMenu } from './DebugMenu';

// Components
import { GameBackground } from './GameBackground';
import { LayoutContainer } from './LayoutContainer';
import { GameArea } from './GameArea';
import { GameHUD } from './GameHUD';
import { GameOverlays } from './GameOverlays';
import { PauseMenu } from './PauseMenu';
import { GroundCanvas } from './GroundCanvas';
import { WallCanvas } from './WallCanvas';
import { Pause } from 'lucide-react';

interface GameCanvasProps {
    difficulty: Difficulty;
    settings: GameSettings;
    onUpdateSettings: (s: GameSettings) => void;
    leaderboard: LeaderboardEntry[];
    onGameOver: (stats: GameStats) => void;
    setScore: (s: number) => void;
    onSync?: () => void;
    onPauseChange?: (paused: boolean) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ difficulty, settings, onUpdateSettings, leaderboard, onGameOver, setScore, onSync, onPauseChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const gameAreaRef = useRef<HTMLDivElement>(null);

    // Game State
    const [combo, setCombo] = useState(0);
    const [fever, setFever] = useState(false);
    const [limitTime, setLimitTime] = useState(0); // Using limitTime instead of dangerTime for generic name if desired, keeping logic exact
    const [juice, setJuice] = useState(0);
    const [nextFruit, setNextFruit] = useState<FruitTier>(FruitTier.CHERRY);
    const [savedFruit, setSavedFruit] = useState<FruitTier | null>(null);
    const [playTime, setPlayTime] = useState(0);
    const [maxTier, setMaxTier] = useState<FruitTier>(FruitTier.CHERRY);
    const [isPaused, setIsPaused] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [pauseTapCount, setPauseTapCount] = useState(0);
    const [showCelebration, setShowCelebration] = useState(false);
    const [currentFeverMult, setCurrentFeverMult] = useState(1);
    const [currentStateScore, setCurrentStateScore] = useState(0);

    // Visual State
    const [bgPatternIndex, setBgPatternIndex] = useState(0);
    const [bgColor, setBgColor] = useState(FRUIT_DEFS[FruitTier.CHERRY].color);

    // Game Area Position for Ground Canvas
    const [gameAreaDimensions, setGameAreaDimensions] = useState({
        width: 0,
        height: 0,
        top: 0,
        left: 0
    });

    // --- Background Cycle Effect ---
    useEffect(() => {
        const interval = setInterval(() => {
            setBgPatternIndex(prev => (prev + 1) % 4); // 4 patterns hardcoded in Background
        }, 25000);
        return () => clearInterval(interval);
    }, []);

    // --- Track Game Area Position for Ground Canvas ---
    useEffect(() => {
        const updateGameAreaPosition = () => {
            if (gameAreaRef.current) {
                const rect = gameAreaRef.current.getBoundingClientRect();
                setGameAreaDimensions({
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    left: rect.left
                });
            }
        };

        updateGameAreaPosition();
        window.addEventListener('resize', updateGameAreaPosition);

        return () => window.removeEventListener('resize', updateGameAreaPosition);
    }, []);

    // --- Engine Initialization ---
    useEffect(() => {
        if (!canvasRef.current) return;

        const engine = new GameEngine(canvasRef.current, difficulty, settings, {
            onScore: (amt: number, total: number) => {
                setScore(total); // Parent update
                setCurrentStateScore(total); // Local update
            },
            onGameOver: onGameOver,
            onCombo: (c: number) => setCombo(c),
            onFeverStart: (mult: number) => {
                setFever(true);
                setCurrentFeverMult(mult);
            },
            onFeverEnd: () => setFever(false),
            // Map "Danger" callback to state
            onDanger: (active: boolean, ms: number) => setLimitTime(active ? ms : 0),
            onJuiceUpdate: (j: number, max: number) => setJuice((j / max) * 100),
            onNextFruit: (t: FruitTier) => setNextFruit(t),
            onMaxFruit: (t: FruitTier) => {
                if (FRUIT_DEFS[t]) setBgColor(FRUIT_DEFS[t].patternColor);
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

    // Update settings live
    useEffect(() => {
        if (engineRef.current) engineRef.current.updateSettings(settings);
    }, [settings]);

    const handlePauseToggle = () => {
        const newState = !isPaused;
        setIsPaused(newState);
        if (onPauseChange) onPauseChange(newState);
        if (newState && onSync) onSync();
        if (engineRef.current) engineRef.current.setPaused(newState);
    };

    const handleRestart = () => {
        engineRef.current?.reset();
        setIsPaused(false);
        if (onPauseChange) onPauseChange(false);
        setScore(0);
        setCombo(0);
        setFever(false);
        setJuice(0);
        setPlayTime(0);
        setSavedFruit(null);
        setMaxTier(FruitTier.CHERRY);
        setShowCelebration(false);
    };

    const handleSecretTap = () => {
        setPauseTapCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 10) setDebugMode(true);
            return newCount;
        });
    };

    return (
        <>
            {/* 1. Full Screen Background */}
            <GameBackground
                patternIndex={bgPatternIndex}
                bgColor={bgColor}
                fever={fever}
                juice={juice}
            />

            {/* 1.5. Ground Canvas - Extends to screen edges */}
            {gameAreaDimensions.width > 0 && (
                <GroundCanvas
                    gameAreaWidth={gameAreaDimensions.width}
                    gameAreaHeight={gameAreaDimensions.height}
                    containerTop={gameAreaDimensions.top}
                    containerLeft={gameAreaDimensions.left}
                />
            )}

            {/* 1.6. Wall Canvas - Brick walls on sides */}
            {gameAreaDimensions.width > 0 && (
                <WallCanvas
                    gameAreaWidth={gameAreaDimensions.width}
                    gameAreaHeight={gameAreaDimensions.height}
                    containerTop={gameAreaDimensions.top}
                    containerLeft={gameAreaDimensions.left}
                />
            )}

            {/* 2. Main Layout Container */}
            <LayoutContainer>

                {/* TOP UI (HUD) - Occupies top section of 9:20 Container */}
                <div className="w-full flex flex-col justify-end pb-2 relative z-30">
                    <GameHUD
                        score={currentStateScore}
                        playTime={playTime}
                        maxTier={maxTier}
                        nextFruit={nextFruit}
                        savedFruit={savedFruit}
                        onSwap={() => engineRef.current?.swapSavedFruit()}
                    />
                </div>

                {/* 3. Game Area (4:5 Aspect Ratio) */}
                <div ref={gameAreaRef} className="w-full aspect-[4/5] relative shrink-0 z-10">
                    <GameArea canvasRef={canvasRef}>
                        <GameOverlays
                            dangerTime={limitTime}
                            showCelebration={showCelebration}
                            fever={fever}
                            combo={combo}
                            currentFeverMult={currentFeverMult}
                        />
                    </GameArea>
                </div>

                {/* BOTTOM UI - REMOVED (Pause Button moved to absolute) */}

            </LayoutContainer>

            {/* ABSOLUTE PAUSE BUTTON - Bottom Center */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
                <button
                    onClick={handlePauseToggle}
                    className="w-16 h-16 bg-[#558B2F] hover:bg-[#33691E] text-white border-4 border-[#2E5A1C] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    aria-label="Pause Game"
                >
                    <Pause size={32} fill="currentColor" />
                </button>
            </div>

            {/* 5. Modals/Menus */}
            <PauseMenu
                isPaused={isPaused}
                onResume={handlePauseToggle}
                onRestart={handleRestart}
                onEndGame={() => engineRef.current?.gameOver()}
                onSecretTap={handleSecretTap}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                leaderboard={leaderboard}
            />

            {debugMode && (
                <DebugMenu
                    engine={engineRef.current}
                    onClose={() => setDebugMode(false)}
                />
            )}
        </>
    );
};
