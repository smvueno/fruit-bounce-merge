import React, { ReactNode } from 'react';

interface GameAreaProps {
    children: ReactNode;
}

export const GameArea: React.FC<GameAreaProps> = React.memo(({ children }) => {
    return (
        <div className="relative w-full aspect-[4/5] bg-transparent overflow-visible pointer-events-none">
            {/* The Actual Game Canvas */}
            {/* Canvas moved to global scope */}


            {/* Overlay Elements */}
            {children}

        </div>
    );
});
