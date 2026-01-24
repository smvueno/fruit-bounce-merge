import React, { useEffect, useState, useRef } from 'react';
import { PointEvent } from '../types';

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

export const PointTicker: React.FC<PointTickerProps> = ({ latestEvent, settings }) => {
    const [popups, setPopups] = useState<PopupInstance[]>([]);
    const nextId = useRef(0);

    // Filter out old popups
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setPopups(prev => prev.filter(p => now - p.createdAt < 800)); // 800ms lifetime
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Add new popup on event
    useEffect(() => {
        if (!latestEvent) return;

        // Skip small visual noise if requested, but usually points are important feedback
        // if (settings.reducedParticles && latestEvent.tier < 2) return;

        const newPopup: PopupInstance = {
            id: nextId.current++,
            x: latestEvent.x,
            y: latestEvent.y,
            points: latestEvent.points,
            tier: latestEvent.tier,
            createdAt: Date.now()
        };

        setPopups(prev => [...prev, newPopup]);
    }, [latestEvent, settings]);

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
            {popups.map(p => {
                // Dynamic scaling based on points/tier
                // Tier 0 (Cherry) -> Scale 0.8
                // Tier 10 (Watermelon) -> Scale 2.5
                const baseScale = 0.8 + (p.tier * 0.15);
                const isBigWin = p.points > 500;

                // Calculate position percentage relative to the game container
                // Assuming x/y are in 600x750 virtual space
                // But wait, the PointEvent comes from GameEngine which uses V_WIDTH=600, V_HEIGHT=750
                // We need to map this to percentage to be responsive in the container
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
                            textShadow: '0px 2px 4px rgba(0,0,0,0.5)'
                        }}
                    >
                        <span className={`
                            font-black tracking-tighter
                            ${isBigWin ? 'text-yellow-300' : 'text-white'}
                        `}>
                            +{p.points}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
