import React, { ReactNode } from 'react';

interface GameAreaProps {
    children: ReactNode;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const GameArea: React.FC<GameAreaProps> = React.memo(({ children, canvasRef }) => {
    return (
        <div className="fixed inset-0 w-full h-full bg-transparent overflow-hidden touch-none">
            {/* The Actual Game Canvas */}
            <canvas
                ref={canvasRef}
                className="block w-full h-full touch-none cursor-grab active:cursor-grabbing z-10"
            />

            {/* Overlay Elements */}
            {children}

        </div>
    );
});
