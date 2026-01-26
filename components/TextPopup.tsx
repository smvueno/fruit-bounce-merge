
import React, { useEffect, useState, useRef } from 'react';
import { PopupData, PopUpType } from '../types';
import { DANGER_Y_PERCENT } from '../constants';

interface TextPopupProps {
    data: PopupData | null;
    gameAreaTop: number;
    gameAreaHeight: number;
    gameAreaWidth: number;
}

type VisualState = 'HIDDEN' | 'ENTERING' | 'ACTIVE' | 'IDLE' | 'EXITING';

export const TextPopup: React.FC<TextPopupProps> = React.memo(({ data, gameAreaTop, gameAreaHeight, gameAreaWidth }) => {
    // We cache the data so we can display it while "EXITING" even after prop is null
    const [cachedData, setCachedData] = useState<PopupData | null>(data);
    const [visualState, setVisualState] = useState<VisualState>('HIDDEN');

    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate popup position based on danger line
    // Calculate popup position based on danger line
    const canvasHeightRatio = 1.4;
    const canvasTopOffsetRatio = -0.2;
    const dangerYInScreen = gameAreaTop + gameAreaHeight * (canvasTopOffsetRatio + canvasHeightRatio * DANGER_Y_PERCENT);
    const popupTopPosition = dangerYInScreen + 90; // 90px below danger line for better clearance
    const popupWidth = gameAreaWidth * 0.95; // Use 95% of game area width

    // Main Logic: Watch for Data Changes
    useEffect(() => {
        // Clear existing timers on any data change to prevent race conditions
        const clearTimers = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
        };

        if (data) {
            // CASE 1: New Data Arrived
            if (visualState === 'HIDDEN' || visualState === 'EXITING') {
                // START (or RE-START) sequence
                clearTimers();
                setCachedData(data);
                setVisualState('ENTERING');

                // Transition to ACTIVE after anim
                transitionTimerRef.current = setTimeout(() => {
                    setVisualState('ACTIVE');
                    startIdleTimer();
                }, 500); // 500ms match .animate-pop-enter
            } else {
                // Already Visible (ACTIVE or IDLE)
                if (cachedData && data.type !== cachedData.type) {
                    // TYPE CHANGE (Replace old with new)

                    // SPECIAL CASE: Immediate switch for FRENZY
                    if (data.type === PopUpType.FRENZY) {
                        clearTimers();
                        setCachedData(data);
                        setVisualState('ENTERING'); // Jump striaght to enter

                        transitionTimerRef.current = setTimeout(() => {
                            setVisualState('ACTIVE');
                            startIdleTimer();
                        }, 500);
                        return;
                    }

                    // 1. Exit Old
                    clearTimers();
                    setVisualState('EXITING');

                    // 2. Wait for exit, then Enter New
                    transitionTimerRef.current = setTimeout(() => {
                        setCachedData(data);
                        setVisualState('ENTERING');

                        transitionTimerRef.current = setTimeout(() => {
                            setVisualState('ACTIVE');
                            startIdleTimer();
                        }, 500);
                    }, 300); // 300ms exit anim
                } else {
                    // SAME TYPE UPDATE (Just score updating)
                    // Don't clear timers here! That prevents IDLE state from ever being reached.
                    setCachedData(data);

                    // Only force to ACTIVE if we were in a transition
                    if (visualState === 'ENTERING' || visualState === 'EXITING') {
                        setVisualState('ACTIVE');
                    }

                    // Ensure timer is running if checking for idle, but don't reset it if already running
                    if (visualState !== 'IDLE' && !idleTimerRef.current) {
                        startIdleTimer();
                    }
                }
            }
        } else {
            // CASE 2: Data Removed (e.g. chain ended)
            if (visualState !== 'HIDDEN' && visualState !== 'EXITING') {
                clearTimers();
                setVisualState('EXITING');
                transitionTimerRef.current = setTimeout(() => {
                    setVisualState('HIDDEN');
                    setCachedData(null);
                }, 300);
            }
        }

        return () => {
            // Cleanup only if component unmounts (rare)
            // We usually let timers run, but clearing on unmount is safe
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const startIdleTimer = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setVisualState('IDLE');
        }, 2000); // 2 seconds before fading to 50%
    };

    // --- Render Logic ---
    if (visualState === 'HIDDEN' || !cachedData) return null;

    // Determine colors and labels
    let mainText = '';
    let textColor = '';
    let showMultiplier = false;

    switch (cachedData.type) {
        case PopUpType.WATERMELON_CRUSH:
            mainText = 'WATERMELON CRUSH!';
            textColor = '#4ade80'; // Green-400
            break;

        case PopUpType.FRENZY:
            mainText = 'FRENZY!!';
            showMultiplier = true;
            textColor = '#facc15'; // Yellow-400
            break;

        case PopUpType.CHAIN:
            mainText = 'CHAIN BONUS!';
            showMultiplier = true;
            textColor = '#fb923c'; // Orange-400
            break;

        case PopUpType.DANGER:
            mainText = 'DANGER!';
            textColor = '#ef4444'; // Red-500
            break;
    }

    const commonStyle: React.CSSProperties = {
        color: textColor,
        WebkitTextStroke: '6px #1a1a1a',
        textShadow: '3px 3px 0px #1a1a1a',
        paintOrder: 'stroke fill'
    };

    // Dynamic Classes based on State
    const getContainerClasses = () => {
        const base = "flex flex-col items-center justify-center text-center transform transition-all duration-300 ";

        switch (visualState) {
            case 'ENTERING':
                return base + "animate-pop-enter opacity-100";
            case 'ACTIVE':
                if (cachedData.type === PopUpType.DANGER) {
                    return base + "animate-pulse-danger opacity-100 scale-110";
                }
                return base + "animate-bob opacity-80 scale-100";
            case 'IDLE':
                // Keeping animate-bob in IDLE looks nice (gentle breathing), just faded
                if (cachedData.type === PopUpType.DANGER) {
                    return base + "animate-pulse-danger opacity-100 scale-110";
                }
                return base + "animate-bob opacity-60 scale-95";
            case 'EXITING':
                return base + "opacity-0 scale-75";
            default:
                return base;
        }
    };
    // ... (render logic continues)

    return (
        <div
            className="fixed left-1/2 pointer-events-none z-50 font-['Fredoka']"
            style={{
                top: `${popupTopPosition}px`,
                transform: 'translateX(-50%)',
                width: `${popupWidth}px`,
                paddingTop: '20px',
                paddingBottom: '20px'
            }}
        >
            <div className={getContainerClasses()}>

                {/* Multiplier (Top) */}
                {showMultiplier && cachedData.multiplier > 1 && cachedData.type !== PopUpType.DANGER && (
                    <div
                        className="text-2xl md:text-4xl font-black opacity-90 tracking-widest mb-1 transition-all duration-300"
                        style={commonStyle}
                    >
                        x{cachedData.multiplier}
                    </div>
                )}

                {/* Main Text (Middle) */}
                {/* For Danger, we swap order: Countdown on top (big), Text on bottom (smaller) like original DangerOverlay? 
                    User said: "move the danger notification with countdown into the middle screen popup"
                    Original Popup: Multiplier -> Text -> Score
                    DangerOverlay: Countdown -> "DANGER!"
                    Let's adapt Popup slot:
                    If Danger:
                    Top (Multiplier slot): Countdown (Big)
                    Middle (Text slot): "DANGER!"
                    Bottom (Score slot): Empty
                */}

                {cachedData.type === PopUpType.DANGER ? (
                    <>
                        <div
                            className="text-5xl md:text-7xl font-black mb-2 leading-none transition-all duration-300"
                            style={commonStyle}
                        >
                            {cachedData.dangerTime ? (cachedData.dangerTime / 1000).toFixed(1) : "0.0"}
                        </div>
                        <h1
                            className="text-4xl md:text-6xl font-black tracking-wide leading-none transition-all duration-300"
                            style={commonStyle}
                        >
                            {mainText}
                        </h1>
                    </>
                ) : (
                    <>
                        <h1
                            className="text-4xl md:text-6xl font-black tracking-wide mb-2 leading-none transition-all duration-300"
                            style={commonStyle}
                        >
                            {mainText}
                        </h1>

                        {/* Main Score (Bottom) */}
                        {/* Only show score if > 0 (Hides the initial "0" when Frenzy starts) */}
                        {cachedData.runningTotal > 0 && (
                            <div
                                className="text-5xl md:text-7xl font-black leading-none tracking-wide transition-all duration-300"
                                style={commonStyle}
                            >
                                {cachedData.runningTotal.toLocaleString()}
                            </div>
                        )}
                    </>
                )}

                {/* Optional "Clearing board..." text for Watermelon Crush */}
                {cachedData.type === PopUpType.WATERMELON_CRUSH && (
                    <div className="text-white text-lg mt-3 font-bold uppercase tracking-widest animate-pulse opacity-90"
                        style={{ textShadow: '2px 2px 0px #000' }}>
                        Clearing board...
                    </div>
                )}

            </div>
        </div>
    );
});
