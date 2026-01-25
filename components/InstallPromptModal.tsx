import React from 'react';
import { Share, SquarePlus, X, Download } from 'lucide-react';

interface InstallPromptModalProps {
    onClose: () => void;
}

export const InstallPromptModal: React.FC<InstallPromptModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md animate-fade-in font-['Fredoka']">
            <div className="bg-white border-4 border-gray-900 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl transform scale-100 flex flex-col items-center text-center relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Download size={32} strokeWidth={3} />
                </div>

                <h2 className="text-2xl font-bold text-gray-900 mb-4 tracking-wide">
                    Install App
                </h2>

                <div className="text-gray-600 font-medium mb-6 text-left w-full space-y-4 px-2">
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                        <div className="bg-white p-2 rounded-lg text-blue-500 shrink-0 shadow-sm border border-gray-100">
                            <Share size={20} />
                        </div>
                        <p className="text-sm">1. Tap the <span className="font-bold text-gray-900">Share</span> button.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                        <div className="bg-white p-2 rounded-lg text-gray-700 shrink-0 shadow-sm border border-gray-100">
                            <SquarePlus size={20} />
                        </div>
                        <p className="text-sm">2. Select <span className="font-bold text-gray-900">Add to Home Screen</span>.</p>
                    </div>
                </div>

                <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-3 rounded-xl text-xs font-bold w-full uppercase tracking-wide">
                    ✨ Works fully offline after install!
                </div>
            </div>
        </div>
    );
};
