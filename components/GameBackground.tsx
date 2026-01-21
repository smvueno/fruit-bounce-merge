import React from 'react';
import { FRUIT_DEFS, FruitTier } from '../services/fruitConfig';

interface GameBackgroundProps {
    patternIndex: number;
    bgColor: string;
    fever: boolean;
    juice: number;
}

const BACKGROUND_PATTERNS = [
    `data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='black'%3E%3Ccircle cx='50' cy='50' r='40' /%3E%3C/g%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' fill='black' /%3E%3C/svg%3E`,
    `data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 10 L70 70 L10 70 Z' fill='black' /%3E%3C/svg%3E`
];

export const GameBackground: React.FC<GameBackgroundProps> = ({ patternIndex, bgColor, fever, juice }) => {
    // Current Pattern URL
    const patternUrl = BACKGROUND_PATTERNS[patternIndex % BACKGROUND_PATTERNS.length];

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#FFF8E1]">

            {/* SCROLLING PATTERN LAYER */}
            {/* We use a simple repeating background image on a div that is 200% size and animates move */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundColor: bgColor,
                    maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
                }}
            >
                {/* The Moving Pattern */}
                <div
                    className="absolute top-0 left-0 w-[200%] h-[200%] animate-bg-scroll"
                    style={{
                        backgroundImage: `url("${patternUrl}")`,
                        backgroundSize: '80px 80px', // Consistent size
                        backgroundRepeat: 'repeat',
                        animationDuration: fever ? '30s' : '60s', // Faster in fever
                    }}
                />
            </div>

            {/* JUICE / WATER LEVEL */}
            <div className="absolute inset-0 flex items-end opacity-40">
                <div
                    className={`w-full relative transition-all ease-in-out ${fever ? 'bg-purple-500' : 'bg-blue-400'}`}
                    style={{ height: `${juice}%`, transitionDuration: '3000ms' }}
                >
                    <div
                        className="absolute top-0 left-0 right-0 -mt-6 h-6 w-full animate-wave"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q25 0 50 10 T100 10 L100 20 Z' fill='${fever ? '%23A855F7' : '%2360A5FA'}' /%3E%3C/svg%3E")`,
                            backgroundSize: '100px 100%',
                            backgroundRepeat: 'repeat-x'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};
