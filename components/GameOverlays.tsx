import React from 'react';

interface GameOverlaysProps {
    dangerTime: number;
    showCelebration: boolean;
    fever: boolean;
    combo: number;
    currentFeverMult: number;
}

export const GameOverlays: React.FC<GameOverlaysProps> = ({ dangerTime, showCelebration, fever, combo, currentFeverMult }) => {
    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-xl font-['Fredoka']">

            {/* Celebration Overlay */}
            {showCelebration && (
                <div className="absolute inset-0 flex items-center justify-center animate-pop-in z-40">
                    <div className="flex flex-col items-center transform -rotate-3">
                        <h1 className="text-6xl font-bold text-[#1a1a1a] tracking-tighter text-center leading-none"
                            style={{ textShadow: '4px 4px 0px #4CAF50', WebkitTextStroke: '0px transparent' }}>
                            WATERMELON<br />CRUSH!
                        </h1>
                        <div className="text-4xl font-bold text-[#1a1a1a] mt-4"
                            style={{ textShadow: '4px 4px 0px #F97316', WebkitTextStroke: '0px transparent' }}>
                            LEVEL 11 REACHED!
                        </div>
                    </div>
                </div>
            )}

            {/* Danger Overlay */}
            {dangerTime > 0 && (
                <div className="absolute inset-0 flex flex-col items-center pt-32 animate-pulse-danger z-30">
                    <div className="w-full h-1 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.8)]"></div>
                    <div className="mt-4 text-6xl font-bold text-red-600 drop-shadow-lg" style={{ WebkitTextStroke: '2px white' }}>
                        {(dangerTime / 1000).toFixed(1)}
                    </div>
                    <div className="text-red-500 font-bold uppercase tracking-widest text-2xl drop-shadow-md">DANGER!</div>
                </div>
            )}

            {/* Graffiti Combo / Fever Text */}
            <div className="absolute top-[35%] left-[15%] right-[15%] w-[70%] flex justify-center items-center pointer-events-none z-30 opacity-60">
                {(fever || combo > 1) && (
                    <div className="transform -rotate-6 transition-all duration-200 select-none flex flex-col items-center animate-pop">
                        {fever ? (
                            <span className="text-8xl font-bold text-[#1a1a1a] leading-tight" style={{ textShadow: '4px 4px 0px #FFD700', WebkitTextStroke: '0px transparent' }}>FRENZY!! x{currentFeverMult}</span>
                        ) : (
                            <span className="text-7xl font-bold text-[#1a1a1a] leading-tight" style={{ textShadow: '4px 4px 0px #F97316', WebkitTextStroke: '0px transparent' }}>{combo} CHAIN!</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
