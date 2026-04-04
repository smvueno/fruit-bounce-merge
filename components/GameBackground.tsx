import React from 'react';

interface GameBackgroundProps {
    fever: boolean;
}

/**
 * Simple soft animated gradient background.
 * Replaces the old pattern-based background with animated blobs.
 */
export const GameBackground: React.FC<GameBackgroundProps> = React.memo(({ fever }) => {
    return (
        <div
            className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
            style={{
                background: fever
                    ? 'linear-gradient(135deg, #f5e6ff 0%, #e8d5f5 25%, #fce4ff 50%, #f0d0ff 75%, #e0c0f0 100%)'
                    : 'linear-gradient(135deg, #FFF8E1 0%, #FFF3CC 25%, #FFFDE7 50%, #FFF9E6 75%, #FFF0CC 100%)',
                transition: 'background 2s ease',
            }}
        />
    );
});
