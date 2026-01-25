import React from 'react';

interface JuiceOverlayProps {
    fever: boolean;
    juice: number;
}

export const JuiceOverlay: React.FC<JuiceOverlayProps> = ({ fever, juice }) => {
    return (
        <div className="absolute inset-0 flex items-end opacity-40 pointer-events-none z-0">
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
    );
};
