import React, { ReactNode } from 'react';

interface LayoutContainerProps {
    children: ReactNode;
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
    return (
        <div className="w-full h-full min-h-[100svh] flex items-center justify-center">
            {/* 
                This container ensures the 9:20 ratio roughly, or fits the screen.
                On Desktop: It will be a centered column.
                On Mobile: It will fill the screen but respect safe areas.
            */}
            <div className="relative w-full max-w-[50svh] aspect-[9/20] max-h-[100svh] flex flex-col items-center gap-0">
                {children}
            </div>
        </div>
    );
};
