import React, { ReactNode } from 'react';

interface GameAreaProps {
    children: ReactNode;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const GameArea: React.FC<GameAreaProps> = React.memo(({ children, canvasRef }) => {
    return (
        <div className="relative w-full aspect-[4/5] bg-transparent overflow-visible">
            {/* The Actual Game Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute touch-none cursor-grab active:cursor-grabbing z-10 block"
                style={{
                    width: '140%',
                    height: '140%',
                    top: '-20%',
                    left: '-20%'
                }}
            />

            {/* Overlay Elements */}
            {children}

        </div>
    );
});
