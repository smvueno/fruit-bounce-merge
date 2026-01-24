
import React from 'react';
import { PopupData, PopUpType } from '../types';

interface TextPopupProps {
    data: PopupData | null;
}

export const TextPopup: React.FC<TextPopupProps> = ({ data }) => {
    if (!data) return null;

    // Determine colors and labels based on type
    let mainText = '';
    let textColor = '';
    let showMultiplier = false;

    switch (data.type) {
        case PopUpType.WATERMELON_CRUSH:
            mainText = 'WATERMELON CRUSH!';
            textColor = '#4ade80'; // Green-400
            break;

        case PopUpType.FRENZY:
            mainText = 'FRENZY!!';
            showMultiplier = true;
            textColor = '#facc15'; // Yellow-400
            break;

        case PopUpType.CHAIN:
            mainText = 'CHAIN BONUS!';
            showMultiplier = true;
            textColor = '#fb923c'; // Orange-400
            break;
    }

    const commonStyle: React.CSSProperties = {
        color: textColor,
        // Thick outlining for "poppy" rounder feel + nice shift
        WebkitTextStroke: '6px #1a1a1a',
        textShadow: '3px 3px 0px #1a1a1a',
        paintOrder: 'stroke fill'
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden font-['Fredoka']">
            <div className="w-[95%] max-w-[600px] animate-pop-perfect flex flex-col items-center justify-center text-center transform transition-all duration-300">

                {/* Main Text */}
                <h1
                    className="text-4xl md:text-6xl font-black tracking-wide mb-2 leading-none"
                    style={commonStyle}
                >
                    {mainText}
                </h1>

                {/* Sub Text / Score Line */}
                <div className="flex items-baseline justify-center gap-2">
                    {/* Main Score (Big) */}
                    <div
                        className="text-5xl md:text-7xl font-black leading-none tracking-wide"
                        style={commonStyle}
                    >
                        {data.runningTotal.toLocaleString()}
                    </div>

                    {/* Multiplier (Smaller, behind) */}
                    {showMultiplier && data.multiplier > 1 && (
                        <div
                            className="text-3xl md:text-5xl font-black opacity-90 tracking-widest"
                            style={commonStyle}
                        >
                            x{data.multiplier}
                        </div>
                    )}
                </div>

                {/* Optional "Clearing board..." text for Watermelon Crush */}
                {data.type === PopUpType.WATERMELON_CRUSH && (
                    <div className="text-white text-lg mt-3 font-bold uppercase tracking-widest animate-pulse opacity-90"
                        style={{ textShadow: '2px 2px 0px #000' }}>
                        Clearing board...
                    </div>
                )}

            </div>
        </div>
    );
};
