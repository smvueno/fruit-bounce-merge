import React from 'react';

import { DANGER_Y_PERCENT } from '../constants';

interface JuiceOverlayProps {
    fever: boolean;
    juice: number;
    gameAreaDimensions: {
        width: number;
        height: number;
        top: number;
        left: number;
    };
}

export const JuiceOverlay: React.FC<JuiceOverlayProps> = ({ fever, juice, gameAreaDimensions }) => {
    if (gameAreaDimensions.width === 0) return null;

    // We need 100% juice to equal the Danger Line position.
    // Danger Line is at DANGER_Y_PERCENT (13%) from TOP.
    // So the height of water at 100% should be (1 - DANGER_Y_PERCENT) * Height.
    // BUT user said "water should rise from just under the game board so that it doesnt look like it cuts in".
    // This implies it should extend downwards if the container has transparency or padding?
    // However, sticking to the GameArea context:
    // GameArea height is fixed.

    // Calculate max height (from bottom up to danger line)
    const maxWaterHeight = gameAreaDimensions.height * (1 - DANGER_Y_PERCENT);

    // Current target height
    const currentHeight = (juice / 100) * maxWaterHeight;

    return (
        <div
            className="fixed pointer-events-none z-0 overflow-visible opacity-40"
            style={{
                top: gameAreaDimensions.top,
                left: gameAreaDimensions.left,
                width: gameAreaDimensions.width,
                height: gameAreaDimensions.height,
            }}
        >
            <div className="absolute bottom-0 w-full flex items-end">
                <div
                    className={`w-full relative transition-all ease-in-out ${fever ? 'bg-purple-500' : 'bg-blue-400'}`}
                    style={{ height: `${currentHeight}px`, transitionDuration: '3000ms' }}
                >
                    <div
                        className="absolute top-0 left-0 right-0 -mt-6 h-6 w-full animate-wave"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z' fill='${fever ? '%23A855F7' : '%2360A5FA'}' /%3E%3C/svg%3E")`,
                            backgroundSize: '100px 100%',
                            backgroundRepeat: 'repeat-x'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
