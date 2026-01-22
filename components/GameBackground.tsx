import React, { useRef, useEffect } from 'react';
import { FRUIT_DEFS, FruitTier } from '../services/fruitConfig';

interface GameBackgroundProps {
    patternIndex: number;
    bgColor: string;
    fever: boolean;
    juice: number;
}

const BACKGROUND_PATTERNS = [
    `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L70 70 L10 70 Z' fill='black' /%3E%3C/svg%3E`
];

export const GameBackground: React.FC<GameBackgroundProps> = ({ patternIndex, bgColor, fever, juice }) => {
    // We use refs for animation state to avoid re-renders on every frame
    const scrollPosRef = useRef(0);
    const lastTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);

    // Transitions state
    const [activePatternIdx, setActivePatternIdx] = React.useState(patternIndex);
    const [incomingPatternIdx, setIncomingPatternIdx] = React.useState<number | null>(null);
    const [crossFadeAlpha, setCrossFadeAlpha] = React.useState(0);

    // Speed constants (pixels per second)
    const BASE_SPEED = 20; // Slower base speed
    const FEVER_SPEED = 100; // 5x speed
    const currentSpeedRef = useRef(BASE_SPEED);

    // Handle pattern changes
    useEffect(() => {
        if (patternIndex !== activePatternIdx && incomingPatternIdx === null) {
            // Start transition
            setIncomingPatternIdx(patternIndex);
            setCrossFadeAlpha(0);
        }
    }, [patternIndex, activePatternIdx, incomingPatternIdx]);

    // Animation Loop
    useEffect(() => {
        const animate = (time: number) => {
            if (lastTimeRef.current === 0) {
                lastTimeRef.current = time;
            }
            const deltaTime = (time - lastTimeRef.current) / 1000; // in seconds
            lastTimeRef.current = time;

            // 1. Update Scroll Position
            // Helper: Lerp speed
            const targetSpeed = fever ? FEVER_SPEED : BASE_SPEED;
            // Smooth speed transition: move 5% towards target per frame (approx)
            // Adjust factor for desired responsiveness
            currentSpeedRef.current += (targetSpeed - currentSpeedRef.current) * 5 * deltaTime;

            // Move background left (scrollPos increases)
            scrollPosRef.current += currentSpeedRef.current * deltaTime;

            // 2. Handle Crossfade Logic
            // We can do this in the loop or separate, but loop is fine for simple alpha lerp
            // However, React state updates in RAF can be heavy if too frequent.
            // Let's use a ref for alpha if we want purely smooth JS animation without re-renders,
            // BUT for opacity we need to update DOM.
            // A better approach for React is to update CSS variables OR use a ref to the DOM element.
            // For simplicity in this codebase, let's keep React state for "pattern index" logic 
            // but maybe we should try to animate the crossfade in valid React ways.
            // Actually, for a simple crossfade that takes e.g. 1 second, standard React state update is "okay" 
            // but might be jittery. Let's try requestAnimationFrame updates to ref-bound styles if possible.
            // 
            // Given the component structure, let's stick to updating the SCROLL via Ref directly to DOM if possible?
            // "data-scroll-x" or direct style manipulation.
        };

        // We will implement the loop properly below with direct DOM manipulation for performance
        // and standard state for logic where acceptable.
    }, [fever]);


    // Refined Implementation:
    // We need refs to the DOM elements to update backgroundPosition without triggering React Renders
    const activeLayerRef = useRef<HTMLDivElement>(null);
    const incomingLayerRef = useRef<HTMLDivElement>(null);

    // Crossfade Logic state
    const fadeStartTimeRef = useRef<number | null>(null);
    const FADE_DURATION = 1500; // ms

    useEffect(() => {
        const loop = (time: number) => {
            if (lastTimeRef.current === 0) lastTimeRef.current = time;
            const dt = (time - lastTimeRef.current) / 1000;
            lastTimeRef.current = time;

            // --- SPEED & SCROLL ---
            const targetSpeed = fever ? FEVER_SPEED : BASE_SPEED;
            // Smooth lerp for speed (frame-rate independent-ish)
            const speedDiff = targetSpeed - currentSpeedRef.current;
            currentSpeedRef.current += speedDiff * 3.0 * dt; // 3.0 is interpolation speed

            scrollPosRef.current += currentSpeedRef.current * dt;

            // Constrain scrollPos to avoid huge numbers (wrap around based on pattern size)
            // Pattern size is 80px, but since we just translating visual pattern, 
            // we can reset modulus 80.
            // Actually, background-position repeats, so we can just let it grow or mod it.
            // Modulo 80 is safer to prevent float precision issues over long runs.
            const wrappedScroll = scrollPosRef.current % 80;

            // Apply scroll to DOM
            if (activeLayerRef.current) {
                activeLayerRef.current.style.backgroundPosition = `-${wrappedScroll}px 0px`;
            }
            if (incomingLayerRef.current) {
                incomingLayerRef.current.style.backgroundPosition = `-${wrappedScroll}px 0px`;
                // Incoming layer is visible during fade
            }

            // --- CROSSFADE LOGIC ---
            if (incomingPatternIdx !== null) {
                if (fadeStartTimeRef.current === null) {
                    fadeStartTimeRef.current = time;
                }
                const progress = (time - fadeStartTimeRef.current) / FADE_DURATION;

                if (progress >= 1) {
                    // Transition Complete
                    setActivePatternIdx(incomingPatternIdx);
                    setIncomingPatternIdx(null);
                    setCrossFadeAlpha(0); // Reset
                    fadeStartTimeRef.current = null;
                } else {
                    setCrossFadeAlpha(progress);
                }
            }

            animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [fever, incomingPatternIdx]); // Re-bind when state critical to logic changes (like incoming ptr)

    // Trigger Pattern Switch
    useEffect(() => {
        if (patternIndex !== activePatternIdx && incomingPatternIdx === null) {
            setIncomingPatternIdx(patternIndex);
            fadeStartTimeRef.current = null; // Reset fade timer start
        }
    }, [patternIndex, activePatternIdx, incomingPatternIdx]);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#FFF8E1]">

            {/* SCROLLING PATTERN LAYERS */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundColor: bgColor,
                    maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                    transition: 'background-color 2s ease'
                }}
            >
                {/* Layer 1: Active Pattern */}
                <div
                    ref={activeLayerRef}
                    className="absolute top-0 left-0 w-full h-full"
                    style={{
                        backgroundImage: `url("${BACKGROUND_PATTERNS[activePatternIdx % BACKGROUND_PATTERNS.length]}")`,
                        backgroundSize: '80px 80px',
                        backgroundRepeat: 'repeat',
                        opacity: 1 // Always fully opaque base, overlay handles transition
                    }}
                />

                {/* Layer 2: Incoming Pattern (Cross-fading in) */}
                {incomingPatternIdx !== null && (
                    <div
                        ref={incomingLayerRef}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{
                            backgroundImage: `url("${BACKGROUND_PATTERNS[incomingPatternIdx % BACKGROUND_PATTERNS.length]}")`,
                            backgroundSize: '80px 80px',
                            backgroundRepeat: 'repeat',
                            opacity: crossFadeAlpha
                        }}
                    />
                )}
            </div>

            {/* JUICE / WATER LEVEL */}
            <div className="absolute inset-0 flex items-end opacity-40">
                <div
                    className={`w-full relative transition-all ease-in-out ${fever ? 'bg-purple-500' : 'bg-blue-400'}`}
                    style={{ height: `${juice}%`, transitionDuration: '3000ms' }}
                >
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
        </div>
    );
};
