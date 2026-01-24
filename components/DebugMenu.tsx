
import React from 'react';
import { GameEngine } from '../services/GameEngine';
import { FruitTier, PopUpType } from '../types';
import { FruitSVG } from './FruitSVG';
import { X } from 'lucide-react';

interface DebugMenuProps {
    engine: GameEngine | null;
    onClose: () => void;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ engine, onClose }) => {
    return (
        <div className="absolute left-6 top-56 z-30 animate-fade-in pointer-events-auto flex flex-col gap-2 mt-4">
            {/* Bomb Button - 50% transparent */}
            <button
                onClick={() => {
                    if (engine) {
                        engine.forceCurrentFruit(FruitTier.BOMB);
                    }
                }}
                className="w-14 h-14 bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800/50 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-600 active:scale-95 transition-all group"
                title="Spawn Bomb"
            >
                <FruitSVG tier={FruitTier.BOMB} size={40} />
            </button>
            {/* Rainbow Button - 50% transparent */}
            <button
                onClick={() => {
                    if (engine) {
                        engine.forceCurrentFruit(FruitTier.RAINBOW);
                    }
                }}
                className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-pink-300 active:scale-95 transition-all group"
                title="Spawn Rainbow"
            >
                <FruitSVG tier={FruitTier.RAINBOW} size={40} />
            </button>
            {/* Tomato Button - 50% transparent */}
            <button
                onClick={() => {
                    if (engine) {
                        engine.forceCurrentFruit(FruitTier.TOMATO);
                    }
                }}
                className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-red-400 active:scale-95 transition-all"
                title="Spawn Tomato"
            >
                <FruitSVG tier={FruitTier.TOMATO} size={40} />
            </button>
            {/* Close Cheat Menu Button - 50% transparent */}
            <button
                onClick={onClose}
                className="w-14 h-14 bg-red-500/50 backdrop-blur-sm hover:bg-red-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-red-700 active:scale-95 transition-all"
                title="Close Cheat Menu"
            >
                <X size={24} className="text-white" strokeWidth={3} />
            </button>

            <div className="w-14 h-0.5 bg-gray-500/30 my-1"></div>

            {/* Test Triggers */}
            <button
                onClick={() => {
                    if (engine) {
                        engine.onPopupUpdate({
                            type: PopUpType.WATERMELON_CRUSH,
                            runningTotal: 5000,
                            multiplier: 1
                        });
                    }
                }}
                className="w-14 h-14 bg-green-500/50 backdrop-blur-sm hover:bg-green-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-green-700 active:scale-95 transition-all text-white font-black text-xs"
                title="Test Watermelon Crush"
            >
                WC
            </button>
            <button
                onClick={() => {
                    if (engine) {
                        engine.onPopupUpdate({
                            type: PopUpType.FRENZY,
                            runningTotal: 12500,
                            multiplier: 3
                        });
                    }
                }}
                className="w-14 h-14 bg-yellow-400/50 backdrop-blur-sm hover:bg-yellow-500/50 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-600 active:scale-95 transition-all text-black font-black text-xs"
                title="Test Frenzy"
            >
                XZY
            </button>
            <button
                onClick={() => {
                    if (engine) {
                        engine.onPopupUpdate({
                            type: PopUpType.CHAIN,
                            runningTotal: 2400,
                            multiplier: 12
                        });
                    }
                }}
                className="w-14 h-14 bg-orange-500/50 backdrop-blur-sm hover:bg-orange-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-orange-700 active:scale-95 transition-all text-white font-black text-xs"
                title="Test Chain"
            >
                CHN
            </button>
        </div>
    );
};
