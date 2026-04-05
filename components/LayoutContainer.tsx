import React, { ReactNode, useEffect, useState, useCallback } from 'react';

/**
 * LayoutContainer constrains content to the game area width with consistent padding.
 * On wide screens, the HUD and controls are centered and no wider than the game area.
 * On narrow screens, everything fills the width.
 * 
 * The game area maintains 4:5 aspect ratio.
 * HUD (~80px) and controls (~60px) are outside the game area.
 * LayoutContainer width = game area width (exactly matching the 4:5 area).
 * Padding (8px) is applied inside the container, not expanding it.
 */
const PADDING = 16;
const HUD_HEIGHT = 80;
const CONTROLS_HEIGHT = 60;

export const LayoutContainer: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [containerWidth, setContainerWidth] = useState(0);

    const updateSize = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const aspectRatio = 4 / 5;

        // Available height for game area (subtract HUD and controls)
        const availableHeight = vh - HUD_HEIGHT - CONTROLS_HEIGHT;
        // Game area width based on 4:5 aspect ratio
        const gameAreaWidth = availableHeight * aspectRatio;

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
        <div className="fixed inset-0 flex flex-col items-center justify-center">
            <div
                className="flex flex-col h-full"
                style={{ width: containerWidth || '100%' }}
            >
                {/* Inner wrapper with consistent padding */}
                <div className="flex flex-col h-full w-full" style={{ padding: `${PADDING}px`, boxSizing: 'border-box' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};
