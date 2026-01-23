import React from 'react';
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

export const GameHUD: React.FC<GameHUDProps> = ({ score, playTime, maxTier, nextFruit, savedFruit, onSwap }) => {
    return (
        <div className="w-full h-full flex flex-col justify-end px-6 z-30 pointer-events-none font-['Fredoka']">
            <div className="flex justify-between items-start w-full">
                <div className="flex flex-col gap-1 items-start">
                    <div className="text-gray-800 text-sm font-bold tracking-widest uppercase mb-[-5px] opacity-90">SCORE</div>
                    <div className="text-6xl font-bold text-[#1a1a1a] leading-none" style={{ textShadow: 'rgb(249, 115, 22) 4px 4px 0px', WebkitTextStroke: '0px transparent' }}>
                        {score.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 text-2xl font-bold text-gray-800 mt-2">
                        <Clock size={22} className="text-gray-900" strokeWidth={3} />
                        <span>{formatTime(playTime)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-2xl font-bold text-gray-800 mt-1">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-900" style={{ backgroundColor: (FRUIT_DEFS[maxTier] || FRUIT_DEFS[FruitTier.WATERMELON])?.color }}></div>
                        <span>LVL {maxTier >= 10 ? 11 : maxTier + 1}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1 pointer-events-auto items-center">
                    <div className="flex flex-col items-center">
                        <div className="text-gray-800 text-sm font-bold tracking-widest uppercase mb-2">NEXT</div>
                        <div className="relative">
                            <FruitSVG tier={nextFruit} size={50} />
                        </div>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform group"
                        title="Tap to Save/Swap Fruit"
                        onClick={onSwap}>
                        <div className="text-gray-800 text-sm font-bold tracking-widest uppercase mb-2">SAVE</div>
                        <div className="w-[55px] h-[55px] bg-[#FFFBE6] rounded-2xl border-4 border-[#1a1a1a] flex items-center justify-center relative overflow-hidden shadow-sm">
                            {savedFruit !== null ? (
                                <div className="animate-pop">
                                    <FruitSVG tier={savedFruit} size={40} />
                                </div>
                            ) : (
                                <div className="text-gray-300 text-xs font-bold uppercase">EMPTY</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
