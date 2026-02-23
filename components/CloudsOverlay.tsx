import React from 'react';

interface CloudsOverlayProps {
    gameAreaDimensions: {
        width: number;
        height: number;
        top: number;
        left: number;
    };
}

const CloudShape: React.FC<{ className?: string, scale?: number, opacity?: number }> = ({ className = '', scale = 1, opacity = 0.8 }) => {
    return (
        <div className={`flex items-end ${className}`} style={{ transform: `scale(${scale})`, opacity }}>
            <div className="w-10 h-10 bg-white rounded-full"></div>
            <div className="w-14 h-14 bg-white rounded-full -ml-4 -mb-1"></div>
            <div className="w-10 h-10 bg-white rounded-full -ml-4"></div>
        </div>
    );
};

export const CloudsOverlay: React.FC<CloudsOverlayProps> = ({ gameAreaDimensions }) => {
    // We only want clouds if the game area is measured
    if (gameAreaDimensions.width === 0) return null;

    const cloudZoneHeight = 180; // Height of the cloud area
    const cloudZoneTop = Math.max(0, gameAreaDimensions.top - 140); // Estimate HUD top

    return (
        <div
            className="fixed pointer-events-none z-0 overflow-hidden"
            style={{
                top: cloudZoneTop,
                left: 0,
                width: '100%',
                height: cloudZoneHeight,
            }}
        >
             {/* Cloud 5: Tiny, Very Slow, Bottom (Background) */}
             <div className="absolute animate-float-right-slow" style={{ top: '75%', left: '-50vw', animationDuration: '30s', animationDelay: '0s' }}>
                <CloudShape scale={0.5} opacity={0.3} />
            </div>

            {/* Cloud 2: Small, Slow, Lower (Background) */}
            <div className="absolute animate-float-right-slow" style={{ top: '60%', left: '-50vw', animationDuration: '25s', animationDelay: '5s' }}>
                <CloudShape scale={0.7} opacity={0.4} />
            </div>

            {/* Cloud 3: Medium, Medium, Middle */}
            <div className="absolute animate-float-right-medium" style={{ top: '35%', left: '-50vw', animationDuration: '20s', animationDelay: '2s' }}>
                <CloudShape scale={0.9} opacity={0.5} />
            </div>

            {/* Cloud 1: Big, Fast, Top (Foreground) */}
            <div className="absolute animate-float-right-fast" style={{ top: '10%', left: '-50vw', animationDuration: '15s' }}>
                <CloudShape scale={1.2} opacity={0.6} />
            </div>

             {/* Cloud 4: Big, Very Fast, Top-Offset (Foreground) */}
             <div className="absolute animate-float-right-fast" style={{ top: '5%', left: '-50vw', animationDuration: '12s', animationDelay: '8s' }}>
                <CloudShape scale={1.3} opacity={0.55} />
            </div>
        </div>
    );
};
