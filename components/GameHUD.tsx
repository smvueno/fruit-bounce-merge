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
        <div className="w-full h-full flex flex-col justify-center px-8 md:px-10 z-30 pointer-events-none font-['Fredoka'] pb-2">
            <div className="flex justify-between items-end w-full">
                <div className="flex flex-col gap-1 items-start relative">
                    <div className="text-gray-800 text-xs md:text-sm font-bold tracking-widest uppercase mb-0 opacity-90">SCORE</div>
                    <div
                        id="hud-score-display"
                        className="text-4xl md:text-6xl font-bold text-[#1a1a1a] leading-none drop-shadow-sm transition-transform duration-300 placeholder-opacity-100 origin-left scale-100"
                        style={{ WebkitTextStroke: '0px transparent' }}
                    >
                        {animatedScore.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 text-xl md:text-2xl font-bold text-gray-800 mt-1 md:mt-2">
                        <Clock size={20} className="text-gray-900" strokeWidth={3} />
                        <span>{formatTime(playTime)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xl md:text-2xl font-bold text-gray-800 mt-0 md:mt-1">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-900" style={{ backgroundColor: (FRUIT_DEFS[maxTier] || FRUIT_DEFS[FruitTier.WATERMELON])?.color }}></div>
                        <span>LVL {maxTier >= 10 ? 11 : maxTier + 1}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2 pointer-events-auto items-end pb-1">
                    <div className="flex flex-col items-center w-[50px]">
                        <div className="text-gray-800 text-[10px] md:text-sm font-bold tracking-widest uppercase mb-1">NEXT</div>
                        <div className="w-[42px] h-[42px] flex items-center justify-center relative">
                            <FruitSVG tier={nextFruit} size={35} />
                        </div>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform group w-[50px]"
                        title="Tap to Save/Swap Fruit"
                        onClick={onSwap}>
                        <div className="text-gray-800 text-[10px] md:text-sm font-bold tracking-widest uppercase mb-1">SAVE</div>
                        <div className="w-[42px] h-[42px] md:w-[50px] md:h-[50px] bg-white/20 backdrop-blur-md rounded-xl border-2 border-[#1a1a1a] flex items-center justify-center relative overflow-hidden shadow-sm hover:bg-white/30 transition-colors">
                            {savedFruit !== null ? (
                                <div className="animate-pop">
                                    <FruitSVG tier={savedFruit} size={28} />
                                </div>
                            ) : (
                                <span className="text-[8px] font-bold text-black/50">EMPTY</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

