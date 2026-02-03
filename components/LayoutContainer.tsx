import React, { ReactNode } from 'react';

interface LayoutContainerProps {
    children: ReactNode;
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
    // Layout Summary (from GameLayoutRules.jpg):
    // - Outer Container: 10:19 aspect ratio (contains HUD + Game Area + Footer)
    // - Inner Game Area: 4:5 aspect ratio (where fruits play)
    // - Free Area: Outside 10:19, background extends to fill screen

    // 10:19 means width = (10/19) * height
    // For 100svh height: maxWidth = (10/19) * 100svh ≈ 52.6svh
    return (
        <div className="w-full h-[100svh] flex justify-center overflow-hidden pointer-events-none">
            <div className="relative w-full max-w-[52.6svh] h-full flex flex-col pointer-events-none">
                {children}
            </div>
        </div>
    );
};
