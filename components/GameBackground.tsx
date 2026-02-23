import React, { useRef, useEffect } from 'react';

interface GameBackgroundProps {
    patternIndex: number;
    bgColor: string;
    fever: boolean;
}

const BACKGROUND_PATTERNS = [
    `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L70 70 L10 70 Z' fill='black' /%3E%3C/svg%3E`
];

export const GameBackground: React.FC<GameBackgroundProps> = React.memo(({ patternIndex, bgColor, fever }) => {
    // Refs for DOM access (for scrolling)
    const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Animation State (Refs)
    const scrollPosRef = useRef(0);
    const lastTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    const currentSpeedRef = useRef(20);

    // Constants
    const BASE_SPEED = 20;
    const FEVER_SPEED = 100;

    // Ensure we have refs for all
    if (layerRefs.current.length !== BACKGROUND_PATTERNS.length) {
        layerRefs.current = Array(BACKGROUND_PATTERNS.length).fill(null);
    }

    // Ref to track fever state without re-triggering the effect
    const feverRef = useRef(fever);

    useEffect(() => {
        feverRef.current = fever;
    }, [fever]);

    // Animation Loop (purely for SCROLLING)
    // Optimization: Throttle to 30fps — background scroll is decorative, not gameplay-critical
    // This halves the CPU cost of this loop on mobile without any visible difference
    useEffect(() => {
        const TARGET_INTERVAL = 1000 / 30; // 30fps = 33.3ms per frame
        let lastFrameTime = 0;

        const loop = (time: number) => {
            animationFrameRef.current = requestAnimationFrame(loop);

            // Initialize lastFrameTime on the very first frame to avoid huge dt
            if (lastFrameTime === 0) {
                lastFrameTime = time;
                return;
            }

            // Throttle: skip frames to maintain ~30fps
            const elapsed = time - lastFrameTime;
            if (elapsed < TARGET_INTERVAL) return;
            // Use actual elapsed so scroll speed is wall-clock accurate even at 30fps
            const dt = elapsed / 1000;
            lastFrameTime = time - (elapsed % TARGET_INTERVAL);

            if (lastTimeRef.current === 0) lastTimeRef.current = time;
            lastTimeRef.current = time;

            // 1. Update Scroll Speed
            const targetSpeed = feverRef.current ? FEVER_SPEED : BASE_SPEED;
            const speedDiff = targetSpeed - currentSpeedRef.current;
            currentSpeedRef.current += speedDiff * 3.0 * dt;

            // 2. Update Scroll Position
            scrollPosRef.current += currentSpeedRef.current * dt;
            const wrappedScroll = scrollPosRef.current % 80;

            // 3. Apply to ALL DOM Elements
            layerRefs.current.forEach(layer => {
                if (layer) {
                    layer.style.backgroundPosition = `-${wrappedScroll}px 0px`;
                }
            });
        };

        animationFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, []); // Run once on mount

    // Current effective pattern index (safe modulo)
    const safePatternIdx = Math.abs(patternIndex) % BACKGROUND_PATTERNS.length;

    return (
        <div
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#FFF8E1]"
            style={{
                backgroundColor: bgColor, // CSS Transition handles this container color
                opacity: 0.35,
                transition: 'background-color 2s ease'
            }}
        >
            {/* GRADIENT MASK for all layers */}
            <div
                className="absolute inset-0 z-10"
                style={{
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.9) 100%)',
                    pointerEvents: 'none'
                }}
            />

            {/* PERSISTENT PATTERN LAYERS */}
            {BACKGROUND_PATTERNS.map((pattern, idx) => {
                const isVisible = idx === safePatternIdx;

                return (
                    <div
                        key={idx}
                        ref={el => layerRefs.current[idx] = el}
                        className="absolute top-0 left-0 w-full h-full z-0"
                        style={{
                            backgroundImage: `url("${pattern}")`,
                            backgroundSize: '80px 80px',
                            backgroundRepeat: 'repeat',
                            // CSS TRANSITION HANDLES OPACITY SMOOTHNESS
                            opacity: isVisible ? 0.2 : 0,
                            transition: 'opacity 1.5s ease-in-out',
                            willChange: 'background-position, opacity' // Hint for compositor
                        }}
                    />
                );
            })}
        </div>
    );
});
