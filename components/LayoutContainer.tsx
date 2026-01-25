import React, { ReactNode } from 'react';

interface LayoutContainerProps {
    children: ReactNode;
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
    return (
        <div className="w-full h-[100svh] flex justify-center overflow-hidden">
            {/* 
                Container roughly limits to mobile aspect ratio (~9:20) on desktop via max-w.
                On mobile, it fills the width (because screen < max-w usually).
            */}
            <div className="relative w-full max-w-[50svh] h-full flex flex-col">
                {children}
            </div>
        </div>
    );
};
