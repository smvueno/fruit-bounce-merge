import React from 'react';

interface JuiceOverlayProps {
    fever: boolean;
    juice: number;
    dangerYPercent?: number;
}

export const JuiceOverlay: React.FC<JuiceOverlayProps> = ({ fever, juice, dangerYPercent = 0.13 }) => {
    // Buffer to hide the wave below the game area when empty
    // 12% of height ensures the wave is fully hidden below the game area at 0%
    const BOTTOM_BUFFER = 12;

    // Calculate the maximum height the water should reach (Danger Line)
    // dangerYPercent is distance from top (e.g. 0.13)
    // We want the water top to be at 13%, so height from bottom is 87%
    const VISIBLE_HEIGHT = (1 - dangerYPercent) * 100;

    // Total height needed for the div (Visible + Buffer)
    const TOTAL_MAX_HEIGHT = VISIBLE_HEIGHT + BOTTOM_BUFFER;

    // Current height based on juice percentage
    const currentHeight = (juice / 100) * TOTAL_MAX_HEIGHT;

    return (
        <div
            className={`absolute left-0 w-full opacity-40 pointer-events-none z-[15] transition-all ease-in-out ${fever ? 'bg-purple-500' : 'bg-blue-400'}`}
            style={{
                bottom: `-${BOTTOM_BUFFER}%`,
                height: `${currentHeight}%`,
                transitionDuration: '3000ms'
            }}
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
    );
};
