
// ... imports
import React, { useEffect, useRef, useState } from 'react';
import { GameSettings, GameStats, FruitTier, LeaderboardEntry, PopupData, PointEvent, PopUpType } from '../types';
import { GameEngine } from '../services/GameEngine';
import { FRUIT_DEFS, DANGER_Y_PERCENT } from '../constants';
import { DebugMenu } from './DebugMenu';

// Components
import { GameBackground } from './GameBackground';
import { JuiceOverlay } from './JuiceOverlay';
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

    // Score State
    // currentStateScore represents the "Visible HUD Score".
    // It lags behind the engine's "Real Score" until a streak ends (Suck Up).
    const [currentStateScore, setCurrentStateScore] = useState(0);
    const currentStateScoreRef = useRef(0);

    const [latestPointEvent, setLatestPointEvent] = useState<PointEvent | null>(null);

    // Sync Ref with State
    useEffect(() => {
        currentStateScoreRef.current = currentStateScore;
    }, [currentStateScore]);

    // Popup & Suck Up State
    const [popupData, setPopupData] = useState<PopupData | null>(null);
    const lastPopupDataRef = useRef<PopupData | null>(null); // To keep context (color/position) for suck up
    const [suckUpPayload, setSuckUpPayload] = useState<number | null>(null);
    // New: Store the target total score to snap to after suck up
    const [pendingTotalScore, setPendingTotalScore] = useState<number | null>(null);
    const [popupColor, setPopupColor] = useState<string>('#fbbf24'); // Default Yellow

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
    const triggerSuckUp = (amount: number, targetTotal: number) => {
        if (amount > 0) {
            setSuckUpPayload(amount);
            setPendingTotalScore(targetTotal); // Store the authoritative total
            engineRef.current?.audio.playScoreFlyUp();
            setPopupData(null); // Clear central popup as the points fly away
        }
    };

    const handleSuckUpComplete = () => {
        if (suckUpPayload !== null) {
            // Convergence Logic:
            // Instead of adding the payload to the current state (which might be stale/drifted),
            // we simply snap to the 'pendingTotalScore' provided by the engine.
            // This guarantees the HUD always matches the Real Score eventually.

            let newTotal = 0;
            if (pendingTotalScore !== null) {
                newTotal = pendingTotalScore;
            } else {
                // Fallback (should rare/never happen if flow is correct)
                newTotal = currentStateScoreRef.current + suckUpPayload;
            }

            setCurrentStateScore(newTotal);
            setScore(newTotal); // Notify Parent App

            setSuckUpPayload(null);
            setPendingTotalScore(null);
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
            // Score Updates
            onScore: (amt: number, total: number) => {
                // We intentionally ignore 'total' here to keep the HUD detached
                // The HUD only updates via Suck Up (onStreakEnd)
                // However, if total is 0 (reset), we should sync.
                if (total === 0) {
                    setCurrentStateScore(0);
                    setScore(0);
                }
            },

            // Core Game Events
            onGameOver: (stats: GameStats) => {
                // Force sync HUD to Real Score on Game Over to ensure no points are lost
                setCurrentStateScore(stats.score);
                setScore(stats.score);
                onGameOver(stats);
            },

            // Combo & Fever
            onCombo: (c: number) => setCombo(c),
            onFeverStart: (mult: number) => {
                setFever(true);
                setCurrentFeverMult(mult);
            },
            onFeverEnd: (finalScore?: number) => {
                setFever(false);
                // Legacy support cleanup
                // We don't use this for score sync anymore (GameEngine calls onStreakEnd)
                // But we keep it to ensure fever state is cleared in UI
            },

            // New Score System Events
            onPopupStash: () => {
                setPopupData(null); // Hide popup temporarily
            },
            onPopupRestore: (data: PopupData) => {
                setPopupData(data); // Restore popup
            },
            // Updated signature to accept totalRealScore
            onStreakEnd: (amount: number, totalRealScore: number) => {
                triggerSuckUp(amount, totalRealScore);
            },

            // Visuals
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
                setPopupData(data);
                lastPopupDataRef.current = data; // Cache context

                // Update Color
                let c = '#fbbf24'; // Default Yellow
                if (data.type === PopUpType.WATERMELON_CRUSH) c = '#4ade80';
                else if (data.type === PopUpType.FRENZY) c = '#facc15';
                else if (data.type === PopUpType.CHAIN) c = '#fb923c';
                setPopupColor(c);
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
        currentStateScoreRef.current = 0; // Reset ref
        setCombo(0);
        setFever(false);
        setJuice(0);
        setPlayTime(0);
        setSavedFruit(null);
        setMaxTier(FruitTier.CHERRY);
        setShowCelebration(false);
        setPopupData(null);
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
                    className="fixed z-20 pointer-events-none"
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

            {/* 1.9 Text Popup (Master Popup) - DANGER PRIORITY */}
            <TextPopup
                data={limitTime > 0 ? {
                    type: PopUpType.DANGER,
                    runningTotal: 0,
                    multiplier: 0,
                    dangerTime: limitTime
                } : popupData}
                gameAreaTop={gameAreaDimensions.top}
                gameAreaHeight={gameAreaDimensions.height}
                gameAreaWidth={gameAreaDimensions.width}
            />

            {/* 1.95 Score Fly Effect (Suck Up) */}
            {suckUpPayload !== null && (
                <div className="fixed z-[100]">
                    <ScoreFlyEffect
                        startAmount={suckUpPayload}
                        targetElementId="hud-score-display"
                        onComplete={handleSuckUpComplete}
                        color={popupColor}
                        contextData={lastPopupDataRef.current}
                        gameAreaTop={gameAreaDimensions.top}
                        gameAreaHeight={gameAreaDimensions.height}
                        gameAreaWidth={gameAreaDimensions.width}
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

            {/* 1.15 Juice/Water Overlay - Moved OUT of GameArea to be betwen Background and Ground */}
            {/* Placed here in DOM order: After Background, but z-index controlled to be < Ground (z-5) */}
            {gameAreaDimensions.width > 0 && (
                <div
                    className="fixed overflow-hidden rounded-t-3xl pointer-events-none"
                    style={{
                        zIndex: 2, // Above Background (0), Below Ground (5)
                        width: gameAreaDimensions.width,
                        height: gameAreaDimensions.height,
                        top: gameAreaDimensions.top,
                        left: gameAreaDimensions.left
                    }}
                >
                    <JuiceOverlay
                        fever={fever}
                        juice={juice}
                        dangerYPercent={DANGER_Y_PERCENT}
                    />
                </div>
            )}

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
