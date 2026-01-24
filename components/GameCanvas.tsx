
// ... imports
import React, { useEffect, useRef, useState } from 'react';
import { GameSettings, GameStats, FruitTier, LeaderboardEntry, PopupData, PointEvent, PopUpType } from '../types';
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
import { EffectCanvas } from './EffectCanvas';
import { PointTicker } from './PointTicker';
import { TextPopup } from './TextPopup';
import { ScoreFlyEffect } from './ScoreFlyEffect';
import { DangerOverlay } from './DangerOverlay';
import { Pause } from 'lucide-react';

interface GameCanvasProps {
    settings: GameSettings;
    onUpdateSettings: (s: GameSettings) => void;
    leaderboard: LeaderboardEntry[];
    onGameOver: (stats: GameStats) => void;
    setScore: (s: number) => void;
    onSync?: () => void;
    onPauseChange?: (paused: boolean) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ settings, onUpdateSettings, leaderboard, onGameOver, setScore, onSync, onPauseChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const gameAreaRef = useRef<HTMLDivElement>(null);

    // Game State
    const [combo, setCombo] = useState(0);
    const [fever, setFever] = useState(false);
    const [limitTime, setLimitTime] = useState(0);
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
    const [latestPointEvent, setLatestPointEvent] = useState<PointEvent | null>(null);

    // New Popup Sync State
    const [popupData, setPopupData] = useState<PopupData | null>(null);
    const lastPopupTotalRef = useRef(0);
    const [suckUpPayload, setSuckUpPayload] = useState<number | null>(null);
    const [popupColor, setPopupColor] = useState<string>('#fbbf24'); // Default Yellow

    // Track fever state for closure access
    const feverRef = useRef(false);

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

    // --- Helper to Trigger Suck Up ---
    const triggerSuckUp = () => {
        // Prevent suck up during fever - score should accumulate
        if (feverRef.current) return;

        const val = lastPopupTotalRef.current;
        if (val > 0) {
            setSuckUpPayload(val);
            engineRef.current?.audio.playScoreFlyUp();
            setPopupData(null); // Clear central popup
            lastPopupTotalRef.current = 0; // Reset accumulator
        }
    };

    const handleSuckUpComplete = () => {
        if (suckUpPayload !== null) {
            // Now we finally add the batched score to the visible HUD score
            const newTotal = currentStateScore + suckUpPayload;
            setCurrentStateScore(newTotal);
            setScore(newTotal); // Notify App
            setSuckUpPayload(null);
        }
    };

    // --- Background Cycle Effect ---
    useEffect(() => {
        const interval = setInterval(() => {
            setBgPatternIndex(prev => (prev + 1) % 4);
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

        const engine = new GameEngine(canvasRef.current, settings, {
            onScore: (amt: number, total: number) => {
                // Legacy
                if (total > currentStateScore + (lastPopupTotalRef.current || 0)) {
                    setScore(total);
                    setCurrentStateScore(total);
                }
            },
            onGameOver: onGameOver,
            onCombo: (c: number) => {
                setCombo(c);
                if (c === 0) {
                    triggerSuckUp();
                }
            },
            onFeverStart: (mult: number) => {
                setFever(true);
                feverRef.current = true;
                setCurrentFeverMult(mult);
            },
            onFeverEnd: () => {
                setFever(false);
                feverRef.current = false;
                triggerSuckUp();
            },
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
            },
            onPointEvent: (event: PointEvent) => {
                setLatestPointEvent(event);
            },
            onPopupUpdate: (data: PopupData) => {
                if (data.runningTotal > 0) {
                    setPopupData(data);
                    lastPopupTotalRef.current = data.runningTotal;

                    // Determine Color based on Type
                    let c = '#fbbf24'; // Default Yellow
                    if (data.type === PopUpType.WATERMELON_CRUSH) c = '#4ade80'; // Green-400 (Matches TextPopup.tsx)
                    else if (data.type === PopUpType.FRENZY) c = '#facc15'; // Yellow-400
                    else if (data.type === PopUpType.CHAIN) c = '#fb923c'; // Orange-400 (Matches TextPopup.tsx)
                    setPopupColor(c);

                } else if (data.runningTotal === 0) {
                    triggerSuckUp();
                }
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
        setCurrentStateScore(0);
        setCombo(0);
        setFever(false);
        setJuice(0);
        setPlayTime(0);
        setSavedFruit(null);
        setMaxTier(FruitTier.CHERRY);
        setShowCelebration(false);
        setPopupData(null);
        lastPopupTotalRef.current = 0;
        setSuckUpPayload(null);
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

            {/* 1.7. Effect Canvas - Overlay on top of walls */}
            {gameAreaDimensions.width > 0 && (
                <EffectCanvas
                    engine={engineRef.current}
                    gameAreaWidth={gameAreaDimensions.width}
                    gameAreaHeight={gameAreaDimensions.height}
                    containerTop={gameAreaDimensions.top}
                    containerLeft={gameAreaDimensions.left}
                />
            )}

            {/* 1.8. Point Ticker - Overlay for score popups */}
            {gameAreaDimensions.width > 0 && (
                <div
                    className="absolute z-20 pointer-events-none"
                    style={{
                        width: gameAreaDimensions.width,
                        height: gameAreaDimensions.height,
                        top: gameAreaDimensions.top,
                        left: gameAreaDimensions.left
                    }}
                >
                    <PointTicker latestEvent={latestPointEvent} settings={settings} />
                </div>
            )}

            {/* 1.9 Text Popup (Master Popup) */}
            <TextPopup data={popupData} />

            {/* 1.95 Score Fly Effect (Suck Up) */}
            {suckUpPayload !== null && (
                <div className="fixed z-[100]">
                    <ScoreFlyEffect
                        startAmount={suckUpPayload}
                        targetElementId="hud-score-display"
                        onComplete={handleSuckUpComplete}
                        color={popupColor}
                    />
                </div>
            )}

            {/* 2. Main Layout Container */}
            <LayoutContainer>

                {/* TOP UI (HUD) - Flexible spacer with 20px top padding as requested */}
                <div className="flex-[1.5] flex flex-col justify-start relative z-30 min-h-[100px] pt-[20px] pb-1">
                    <GameHUD
                        score={currentStateScore}
                        playTime={playTime}
                        maxTier={maxTier}
                        nextFruit={nextFruit}
                        savedFruit={savedFruit}
                        onSwap={() => engineRef.current?.swapSavedFruit()}
                    />
                </div>

                {/* 3. Game Area (4:5 Aspect Ratio) - The Anchor */}
                <div ref={gameAreaRef} className="w-full aspect-[4/5] relative shrink-1 z-10">
                    <GameArea canvasRef={canvasRef}>
                        {/* Overlays moved to root level for correct z-index stacking */}
                        {/* New Danger Overlay sits INSIDE the game area scaling context */}
                        <DangerOverlay dangerTime={limitTime} />
                    </GameArea>
                </div>

                {/* BOTTOM UI - Fixed height spacer. */}
                <div className="h-[75px] shrink-0 flex flex-col justify-end items-center z-40 w-full pb-[20px]">
                    <button
                        onClick={handlePauseToggle}
                        className="w-12 h-12 bg-[#558B2F] hover:bg-[#33691E] text-white border-4 border-[#2E5A1C] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        aria-label="Pause Game"
                    >
                        <Pause size={24} fill="currentColor" />
                    </button>
                </div>

            </LayoutContainer>

            {/* 4. Global Overlays (Fixed z-50) */}
            <GameOverlays
                showCelebration={showCelebration}
                fever={fever}
                combo={combo}
                currentFeverMult={currentFeverMult}
            />

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

