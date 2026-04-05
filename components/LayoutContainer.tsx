import React, { ReactNode } from 'react';

/**
 * LayoutContainer fills the entire viewport as a flex column.
 * Children are laid out: HUD (top) → Game Area (center, 4:5) → Controls (bottom).
 * No fixed sizing — the game area maintains its 4:5 aspect ratio and fills available space.
 */
export const LayoutContainer: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <div className="fixed inset-0 flex flex-col">
            {children}
        </div>
    );
};
