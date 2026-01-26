import React from 'react';
import { RefreshCw } from 'lucide-react';

interface UpdateModalProps {
    onConfirm: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ onConfirm }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-md animate-fade-in font-['Fredoka']">
            <div className="bg-white/95 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] px-8 py-6 max-w-sm w-full mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] transform scale-100 flex flex-col items-center text-center">

                <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-4 animate-spin-slow">
                    <RefreshCw size={32} strokeWidth={3} />
                </div>

                <h2 className="text-3xl font-bold text-gray-900 mb-2 tracking-wide">
                    GAME UPDATED!
                </h2>

                <p className="text-gray-600 font-bold mb-8 text-lg leading-relaxed">
                    A new version is available.<br />
                    Update now to play!
                </p>

                <button
                    onClick={onConfirm}
                    className="w-full bg-green-500 hover:bg-green-400 text-white text-xl md:text-2xl font-bold py-3 md:py-6 rounded-2xl md:rounded-3xl shadow-[0_4px_0_#15803d] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                    OK, UPDATE
                </button>
            </div>
        </div>
    );
};
