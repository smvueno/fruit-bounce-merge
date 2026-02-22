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

    // Use top of game area as reference. But user said "HUD area", which is ABOVE the game canvas usually?
    // Wait, let's look at layout.
    // LayoutContainer -> HUD -> GameArea.
    // The HUD is "above" the GameArea in DOM order, but physically at the top of the container.
    // The GameArea is below it.
    // The prompt says "restricted ro above where the hud area is..".
    // Wait, "above where the hud area is"? Or "restricted to the area OF the hud"?
    // "restricted ro above where the hud area is" -> could mean global background sky?
    // BUT context: "There seems to be some kind of round edge of brightness I dont know where it comes from but it doesnt go outside this frame... The edge up there is rounded as well. And it looks like it is brighter inside here than up above. Fix this. ... Also add cute animated white clouds... restricted ro above where the hud area is.."
    //
    // Let's interpret "restricted to the HUD area" or "top part of the screen".
    // Given the container is now transparent, the clouds should probably be in the top ~20% of the CONTAINER, which overlaps the HUD.
    //
    // Let's position them relative to the GameArea TOP, but slightly higher up to cover the HUD.
    // HUD is roughly 100-120px tall above the Game Area.
    // So let's align them to `gameAreaDimensions.top - 120` to `gameAreaDimensions.top`.

    // Actually, `gameAreaDimensions.top` is the top of the CANVAS. The HUD is above that.
    // Let's put the cloud container starting from the top of the "Layout Container" which is the whole game card.
    // Since we don't have the Layout Container dim, we can approximate using GameArea top.
    // The HUD is roughly 15% of height or fixed px.
    // Let's use `top: gameAreaDimensions.top - 150` down to `gameAreaDimensions.top + 50`.

    const cloudZoneHeight = 180; // Height of the cloud area
    const cloudZoneTop = Math.max(0, gameAreaDimensions.top - 140); // Estimate HUD top

    // Generate random cloud configs
    // But we need consistent randoms to avoid re-render flicker.
    // We'll hardcode a few nice paths.

    // We want:
    // - Big clouds: Faster
    // - Small clouds: Slower
    // - Good transparency

    return (
        <div
            className="fixed pointer-events-none z-0 overflow-hidden"
            style={{
                top: cloudZoneTop,
                left: gameAreaDimensions.left,
                width: gameAreaDimensions.width,
                height: cloudZoneHeight,
                // backgroundColor: 'rgba(0,0,255,0.1)', // DEBUG ZONE
            }}
        >
            {/* Cloud 1: Big, Fast, Top */}
            <div className="absolute animate-float-right-fast" style={{ top: '10%', left: '-20%', animationDuration: '15s' }}>
                <CloudShape scale={1.2} opacity={0.6} />
            </div>

            {/* Cloud 2: Small, Slow, Lower */}
            <div className="absolute animate-float-right-slow" style={{ top: '60%', left: '-20%', animationDuration: '25s', animationDelay: '5s' }}>
                <CloudShape scale={0.7} opacity={0.4} />
            </div>

            {/* Cloud 3: Medium, Medium, Middle */}
            <div className="absolute animate-float-right-medium" style={{ top: '35%', left: '-20%', animationDuration: '20s', animationDelay: '2s' }}>
                <CloudShape scale={0.9} opacity={0.5} />
            </div>

             {/* Cloud 4: Big, Very Fast, Top-Offset */}
             <div className="absolute animate-float-right-fast" style={{ top: '5%', left: '-20%', animationDuration: '12s', animationDelay: '8s' }}>
                <CloudShape scale={1.3} opacity={0.55} />
            </div>

             {/* Cloud 5: Tiny, Very Slow, Bottom */}
             <div className="absolute animate-float-right-slow" style={{ top: '75%', left: '-20%', animationDuration: '30s', animationDelay: '0s' }}>
                <CloudShape scale={0.5} opacity={0.3} />
            </div>
        </div>
    );
};
