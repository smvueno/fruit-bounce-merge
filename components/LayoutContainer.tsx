import React, { ReactNode, useEffect, useState, useCallback } from 'react';

/**
 * LayoutContainer constrains content to the game area width with consistent padding.
 * On wide screens, the HUD and controls are centered and no wider than the game area.
 * On narrow screens, everything fills the width.
 * 
 * The game area maintains 4:5 aspect ratio.
 * HUD and controls have consistent padding (8px) on all sides.
 */
const HUD_PADDING = 8;

export const LayoutContainer: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [containerWidth, setContainerWidth] = useState(0);

    const updateSize = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const aspectRatio = 4 / 5;

        // Game area width based on full viewport height and 4:5 aspect ratio
        const gameAreaWidth = vh * aspectRatio;

        // On narrow screens, fill the width
        // On wide screens, constrain to game area width
        const width = Math.min(vw, gameAreaWidth);

        setContainerWidth(width);
    }, []);

    useEffect(() => {
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [updateSize]);

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center"
        >
            <div
                className="flex flex-col h-full"
                style={{ width: containerWidth || '100%', padding: `${HUD_PADDING}px` }}
            >
                {children}
            </div>
        </div>
    );
};
