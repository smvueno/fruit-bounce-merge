import React from 'react';

interface DangerOverlayProps {
    dangerTime: number;
}

export const DangerOverlay: React.FC<DangerOverlayProps> = React.memo(({ dangerTime }) => {
    if (dangerTime <= 0) return null;

    return (
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none z-30">
            {/* The Line - Positioned exactly where the logic line is (13%) */}
            <div
                className="absolute w-full h-1 bg-red-600 shadow-[0_0_20px_rgba(255,0,0,0.8)]"
                style={{ top: '13%', transform: 'translateY(-50%)' }}
            ></div>


        </div>
    );
});
