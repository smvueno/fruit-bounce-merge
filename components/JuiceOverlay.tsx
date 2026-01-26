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
            className="absolute left-0 w-full opacity-40 pointer-events-none z-[15] transition-all ease-in-out"
            style={{
                bottom: `-${BOTTOM_BUFFER}%`,
                height: `${currentHeight}%`,
                transitionDuration: '3000ms',
                backgroundColor: fever ? '#A855F7' : '#60A5FA'
            }}
        >
            <div
                className="absolute top-0 left-0 right-0 -mt-6 h-6 w-full animate-wave translate-y-px transition-colors ease-in-out"
                style={{
                    // Use Mask to cut out the wave shape
                    maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z' fill='black' /%3E%3C/svg%3E")`,
                    WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z' fill='black' /%3E%3C/svg%3E")`,
                    maskSize: '100px 100%',
                    WebkitMaskSize: '100px 100%',
                    maskRepeat: 'repeat-x',
                    WebkitMaskRepeat: 'repeat-x',
                    // Apply the SAME background color and transition as the parent
                    backgroundColor: fever ? '#A855F7' : '#60A5FA',
                    transitionDuration: '3000ms'
                }}
            />
        </div>
    );
};
