import React, { ReactNode, useEffect, useState, useCallback } from 'react';

interface LayoutContainerProps {
    children: ReactNode;
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({ children }) => {
    return (
        <div className="fixed inset-0 flex flex-col">
            {children}
        </div>
    );
};
