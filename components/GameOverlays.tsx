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

            {/* Celebration Overlay - REMOVED (Replaced by TextPopup) */}
            {/* {showCelebration && (
                ...
            )} */}

            {/* Graffiti Combo / Fever Text - REMOVED (Replaced by TextPopup) */}
            {/* <div className="absolute top-[45vh] left-0 right-0 flex justify-center items-center pointer-events-none z-30">
                {(fever || combo > 1) && (
                    <div className="animate-pop-settle">
                        ...
                    </div>
                )}
            </div> */}
        </div>
    );
};
