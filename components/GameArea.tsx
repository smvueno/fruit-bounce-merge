import React, { ReactNode } from 'react';

interface GameAreaProps {
    children: ReactNode;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const GameArea: React.FC<GameAreaProps> = React.memo(({ children, canvasRef }) => {
    return (
        <div className="relative w-full aspect-[4/5] bg-transparent overflow-visible">
            {/* Full-viewport canvas for Pixi rendering */}
            <canvas
                ref={canvasRef}
                className="fixed inset-0 touch-none cursor-grab active:cursor-grabbing z-0 block"
                style={{ width: '100vw', height: '100vh' }}
            />

            {/* Overlay Elements */}
            {children}

        </div>
    );
});
