
import React, { useEffect, useState, useRef } from 'react';
import { PopupData, PopUpType } from '../types';

interface TextPopupProps {
    data: PopupData | null;
}

type VisualState = 'HIDDEN' | 'ENTERING' | 'ACTIVE' | 'IDLE' | 'EXITING';

export const TextPopup: React.FC<TextPopupProps> = ({ data }) => {
    // We cache the data so we can display it while "EXITING" even after prop is null
    const [cachedData, setCachedData] = useState<PopupData | null>(data);
    const [visualState, setVisualState] = useState<VisualState>('HIDDEN');

    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

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
                    // Wake up to ACTIVE if IDLE
                    // Update content immediately
                    clearTimers();
                    setCachedData(data);
                    setVisualState('ACTIVE');
                    startIdleTimer();
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
    }

    const commonStyle: React.CSSProperties = {
        color: textColor,
        WebkitTextStroke: '6px #1a1a1a',
        textShadow: '3px 3px 0px #1a1a1a',
        paintOrder: 'stroke fill'
    };

    // Dynamic Classes based on State
    const getContainerClasses = () => {
        const base = "w-[95%] max-w-[600px] flex flex-col items-center justify-center text-center transform transition-all duration-300 ";

        switch (visualState) {
            case 'ENTERING':
                return base + "animate-pop-enter opacity-100";
            case 'ACTIVE':
                return base + "animate-bob opacity-85 scale-100";
            case 'IDLE':
                // Keeping animate-bob in IDLE looks nice (gentle breathing), just faded
                return base + "animate-bob opacity-60 scale-95";
            case 'EXITING':
                return base + "opacity-0 scale-75";
            default:
                return base;
        }
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden font-['Fredoka']">
            <div className={getContainerClasses()}>

                {/* Multiplier (Top) */}
                {showMultiplier && cachedData.multiplier > 1 && (
                    <div
                        className="text-2xl md:text-4xl font-black opacity-90 tracking-widest mb-1 transition-all duration-300"
                        style={commonStyle}
                    >
                        x{cachedData.multiplier}
                    </div>
                )}

                {/* Main Text (Middle) */}
                <h1
                    className="text-4xl md:text-6xl font-black tracking-wide mb-2 leading-none transition-all duration-300"
                    style={commonStyle}
                >
                    {mainText}
                </h1>

                {/* Main Score (Bottom) */}
                <div
                    className="text-5xl md:text-7xl font-black leading-none tracking-wide transition-all duration-300"
                    style={commonStyle}
                >
                    {cachedData.runningTotal.toLocaleString()}
                </div>

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
};
