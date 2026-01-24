import React from 'react';

interface DangerOverlayProps {
    dangerTime: number;
}

export const DangerOverlay: React.FC<DangerOverlayProps> = ({ dangerTime }) => {
    if (dangerTime <= 0) return null;

    return (
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none z-30">
            {/* The Line - Positioned exactly where the logic line is (13%) */}
            <div
                className="absolute w-full h-1 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.8)]"
                style={{ top: '13%', transform: 'translateY(-50%)' }}
            ></div>

            {/* The Text - Positioned just below the line */}
            <div
                className="absolute w-full flex flex-col items-center animate-pulse-danger"
                style={{ top: '14%' }}
            >
                <div
                    className="text-5xl md:text-6xl font-bold text-red-600 drop-shadow-lg"
                    style={{ WebkitTextStroke: '2px white' }}
                >
                    {(dangerTime / 1000).toFixed(1)}
                </div>
                <div className="text-red-500 font-bold uppercase tracking-widest text-xl md:text-2xl drop-shadow-md">
                    DANGER!
                </div>
            </div>
        </div>
    );
};
