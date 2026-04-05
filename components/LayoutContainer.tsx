import React, { ReactNode, useEffect, useState, useCallback } from 'react';

/**
 * LayoutContainer constrains content to the game area width with consistent padding.
 * On wide screens, the HUD and controls are centered and no wider than the game area.
 * On narrow screens, everything fills the width.
 * 
 * The game area maintains 4:5 aspect ratio.
 * HUD (~80px) and controls (~60px) are outside the game area.
 * LayoutContainer width = gameAreaWidth + padding*2 (so inner content matches game area).
 */
const PADDING = 8;
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
        // Container width = game area width + padding on both sides
        const containerWidth = gameAreaWidth + PADDING * 2;

        // On narrow screens, fill the width
        // On wide screens, constrain to container width
        const width = Math.min(vw, containerWidth);

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
                style={{ width: containerWidth || '100%', padding: `${PADDING}px 0`, boxSizing: 'border-box' }}
            >
                {children}
            </div>
        </div>
    );
};
