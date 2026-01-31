import React, { useEffect, useState, useRef } from 'react';
import { PointEvent } from '../types';
import { FRUIT_DEFS } from '../services/fruitConfig';

interface PointTickerProps {
    latestEvent: PointEvent | null;
    settings: { reducedParticles: boolean };
}

interface PopupInstance {
    id: number;
    x: number;
    y: number;
    points: number;
    tier: number;
    createdAt: number;
}

export const PointTicker: React.FC<PointTickerProps> = React.memo(({ latestEvent, settings }) => {
    const [popups, setPopups] = useState<PopupInstance[]>([]);
    const nextId = useRef(0);

    // Add new popup on event
    useEffect(() => {
        if (!latestEvent) return;

        // Skip small visual noise if requested, but usually points are important feedback
        // if (settings.reducedParticles && latestEvent.tier < 2) return;

        const newId = nextId.current++;
        const newPopup: PopupInstance = {
            id: newId,
            x: latestEvent.x,
            y: latestEvent.y,
            points: latestEvent.points,
            tier: latestEvent.tier,
            createdAt: Date.now()
        };

        setPopups(prev => [...prev, newPopup]);

        // Self-cleanup after lifetime (800ms)
        const timer = setTimeout(() => {
            setPopups(prev => prev.filter(p => p.id !== newId));
        }, 800);

        return () => clearTimeout(timer);
    }, [latestEvent, settings]);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden font-['Fredoka']">
            {popups.map(p => {
                // Dynamic scaling based on points/tier
                // Tier 0 (Cherry) -> Scale 0.8
                // Tier 10 (Watermelon) -> Scale 2.5
                const baseScale = 0.8 + (p.tier * 0.15);

                // Get fruit color or default to white
                const fruitDef = FRUIT_DEFS[p.tier];
                const textColor = fruitDef ? fruitDef.patternColor : '#ffffff';

                // Calculate position percentage relative to the game container
                // Assuming x/y are in 600x750 virtual space
                const leftPct = (p.x / 600) * 100;
                const topPct = (p.y / 750) * 100;

                return (
                    <div
                        key={p.id}
                        className={`absolute flex flex-col items-center justify-center animate-float-fade`}
                        style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            transform: `translate(-50%, -50%) scale(${baseScale})`,
                        }}
                    >
                        <span
                            className="font-black tracking-widest"
                            style={{
                                color: textColor,
                                WebkitTextStroke: '6px #000000', // Thick black outline
                                paintOrder: 'stroke fill',
                                textShadow: '2px 2px 0px rgba(0,0,0,0.5)'
                            }}
                        >
                            +{p.points}
                        </span>
                    </div>
                );
            })}
        </div>
    );
});
