
import React from 'react';
import { GameEngine } from '../services/GameEngine';
import { FruitTier } from '../types';
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

            {/* Watermelon Button */}
            <button
                onClick={() => {
                    if (engine) {
                        engine.forceCurrentFruit(FruitTier.WATERMELON);
                    }
                }}
                className="w-14 h-14 bg-green-500/50 backdrop-blur-sm hover:bg-green-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-green-700 active:scale-95 transition-all"
                title="Spawn Watermelon"
            >
                <FruitSVG tier={FruitTier.WATERMELON} size={40} />
            </button>
        </div>
    );
};
