import React, { ReactNode } from 'react';

interface GameAreaProps {
    children: ReactNode;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const GameArea: React.FC<GameAreaProps> = React.memo(({ children, canvasRef }) => {
    return (
        <div className="relative w-full h-full bg-transparent overflow-visible pointer-events-none">
            {/* The Actual Game Canvas (Spans 100vw / 100vh) */}
            {/* We place it in a fixed positioning layer so it breaks out of the flex container */}
            <canvas
                ref={canvasRef}
                className="fixed inset-0 touch-none cursor-grab active:cursor-grabbing block pointer-events-auto"
                style={{
                    width: '100vw',
                    height: '100vh',
                    zIndex: 1 // Base game rendering layer
                }}
            />

            {/* Overlay Elements (These still flow within the constrained GameArea flex box) */}
            <div className="absolute inset-0 pointer-events-none z-20">
                {children}
            </div>

        </div>
    );
});
