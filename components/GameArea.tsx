import React, { ReactNode } from 'react';

interface GameAreaProps {
    children: ReactNode;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const GameArea: React.FC<GameAreaProps> = ({ children, canvasRef }) => {
    return (
        <div className="relative w-full aspect-[4/5] bg-transparent overflow-visible">
            {/* The Actual Game Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute left-0 right-0 top-0 bottom-0 h-full touch-none cursor-grab active:cursor-grabbing z-10 block"
                style={{ width: '100%' }}
            />

            {/* Overlay Elements */}
            {children}

        </div>
    );
};
