import React, { useEffect, useState, useRef } from 'react';
import { FruitTier, FRUIT_DEFS } from '../services/fruitConfig';
import { FruitSVG } from './FruitSVG';
import { Clock } from 'lucide-react';

interface GameHUDProps {
    score: number;
    playTime: number;
    maxTier: FruitTier;
    nextFruit: FruitTier;
    savedFruit: FruitTier | null;
    onSwap: () => void;
}

const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Number Ticker Hook
const useNumberTicker = (targetValue: number, duration: number = 500) => {
    const [displayValue, setDisplayValue] = useState(targetValue);

    useEffect(() => {
        let startTime: number | null = null;
        const startValue = displayValue;
        const change = targetValue - startValue;

        if (change === 0) return;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);

            // EaseOutExpo
            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            const nextVal = Math.floor(startValue + (change * ease));
            setDisplayValue(nextVal);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [targetValue]);

    return displayValue;
};

export const GameHUD: React.FC<GameHUDProps> = React.memo(({ score, playTime, maxTier, nextFruit, savedFruit, onSwap }) => {

    // We use the ticker hook for smooth score updates
    const animatedScore = useNumberTicker(score, 1000);

    return (
        <div className="w-full flex items-start justify-between z-30 pointer-events-none font-['Fredoka']">
            {/* Left: Score, Timer, Level */}
            <div className="flex flex-col items-start gap-1">
                <div className="text-gray-800 text-xs font-bold tracking-widest uppercase opacity-90">SCORE</div>
                <div
                    id="hud-score-display"
                    className="text-3xl font-bold text-[#1a1a1a] leading-none drop-shadow-sm transition-transform duration-300 origin-left"
                    style={{ WebkitTextStroke: '0px transparent' }}
                >
                    {animatedScore.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
                    <Clock size={16} className="text-gray-900" strokeWidth={3} />
                    <span>{formatTime(playTime)}</span>
                </div>
                <div className="flex items-center gap-3 text-lg font-bold text-gray-800">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-900" style={{ backgroundColor: (FRUIT_DEFS[maxTier] || FRUIT_DEFS[FruitTier.WATERMELON])?.color }}></div>
                    <span>LVL {maxTier >= 10 ? 11 : maxTier + 1}</span>
                </div>
            </div>

            {/* Right: Next, Save */}
            <div className="flex flex-col items-end gap-2 pointer-events-auto">
                <div className="flex flex-col items-center w-[44px]">
                    <div className="text-gray-800 text-[10px] font-bold tracking-widest uppercase mb-1">NEXT</div>
                    <div className="w-[36px] h-[36px] flex items-center justify-center relative">
                        <FruitSVG tier={nextFruit} size={30} />
                    </div>
                </div>
                <div className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform group w-[44px]"
                    title="Tap to Save/Swap Fruit"
                    onClick={onSwap}>
                    <div className="text-gray-800 text-[10px] font-bold tracking-widest uppercase mb-1">SAVE</div>
                    <div className="w-[44px] h-[44px] bg-white/20 backdrop-blur-md rounded-xl border-2 border-[#1a1a1a] flex items-center justify-center relative overflow-hidden shadow-sm hover:bg-white/30 transition-colors">
                        {savedFruit !== null ? (
                            <div className="animate-pop">
                                <FruitSVG tier={savedFruit} size={24} />
                            </div>
                        ) : (
                            <span className="text-[8px] font-bold text-black/50">EMPTY</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
