import React, { ReactNode, useEffect, useState, useCallback } from 'react';

interface LayoutContainerProps {
    children: ReactNode;
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
    const [containerRect, setContainerRect] = useState({ width: 0, height: 0, top: 0, left: 0 });

    const updateSize = useCallback(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const aspectRatio = 4 / 5;

        let containerWidth: number;
        let containerHeight: number;

        if (vw / vh < aspectRatio) {
            // Narrow screen: width-constrained
            containerWidth = vw;
            containerHeight = vw / aspectRatio;
        } else {
            // Wide screen: height-constrained
            containerHeight = vh;
            containerWidth = vh * aspectRatio;
        }

        const left = (vw - containerWidth) / 2;
        const top = (vh - containerHeight) / 2;

        setContainerRect({ width: containerWidth, height: containerHeight, top, left });
    }, []);

    useEffect(() => {
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [updateSize]);

    return (
        <div
            className="fixed flex flex-col"
            style={{
                width: containerRect.width,
                height: containerRect.height,
                top: containerRect.top,
                left: containerRect.left,
            }}
        >
            {children}
        </div>
    );
};
