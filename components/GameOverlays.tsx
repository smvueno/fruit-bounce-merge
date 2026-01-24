import React from 'react';

interface GameOverlaysProps {
    showCelebration: boolean;
    fever: boolean;
    combo: number;
    currentFeverMult: number;
}

export const GameOverlays: React.FC<GameOverlaysProps> = ({ showCelebration, fever, combo, currentFeverMult }) => {
    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden font-['Fredoka']">

            {/* Celebration Overlay */}
            {showCelebration && (
                <div className="absolute inset-0 flex items-center justify-center animate-pop-in z-40">
                    <div className="flex flex-col items-center transform -rotate-3">
                        <h1 className="text-4xl md:text-6xl font-bold text-[#1a1a1a] tracking-tighter text-center leading-none"
                            style={{ textShadow: '4px 4px 0px #4CAF50', WebkitTextStroke: '0px transparent' }}>
                            WATERMELON<br />CRUSH!
                        </h1>
                        <div className="text-2xl md:text-4xl font-bold text-[#1a1a1a] mt-4"
                            style={{ textShadow: '4px 4px 0px #F97316', WebkitTextStroke: '0px transparent' }}>
                            LEVEL 11 REACHED!
                        </div>
                    </div>
                </div>
            )}

            {/* Graffiti Combo / Fever Text */}
            <div className="absolute top-[45vh] left-0 right-0 flex justify-center items-center pointer-events-none z-30">
                {(fever || combo > 1) && (
                    <div className="animate-pop-settle">
                        <div className="transform -rotate-6 transition-all duration-200 select-none flex flex-col items-center animate-bob">
                            {fever ? (
                                <span className="font-bold text-[#1a1a1a] leading-tight text-center whitespace-nowrap"
                                    style={{
                                        fontSize: 'clamp(3rem, 15vw, 6rem)',
                                        textShadow: '4px 4px 0px #FFD700',
                                        WebkitTextStroke: '0px transparent'
                                    }}>
                                    FRENZY!! x{currentFeverMult}
                                </span>
                            ) : (
                                <span className="font-bold text-[#1a1a1a] leading-tight text-center whitespace-nowrap"
                                    style={{
                                        fontSize: 'clamp(2.5rem, 12vw, 5rem)',
                                        textShadow: '4px 4px 0px #F97316',
                                        WebkitTextStroke: '0px transparent'
                                    }}>
                                    {combo} CHAIN!
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
