
import React, { useEffect, useState } from 'react';
import { GameEngine } from '../services/GameEngine';
import { FruitTier, PopUpType } from '../types';
import { FruitSVG } from './FruitSVG';
import { X } from 'lucide-react';

interface DebugMenuProps {
    engine: GameEngine | null;
    onClose: () => void;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ engine, onClose }) => {
    const [perfStats, setPerfStats] = useState<{
        fps: number;
        frameTimeMs: number;
        fruitCount: number;
        particleCount: number;
        audioQueueLength: number;
        heapUsedMB: number;
        heapTotalMB: number;
        substeps: number;
    } | null>(null);

    // Poll engine perfStats every 500ms while the debug menu is open
    useEffect(() => {
        const tick = () => {
            if (engine) {
                setPerfStats({ ...engine.perfStats });
            }
        };
        tick(); // immediate first read
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [engine]);

    const fpsColor = !perfStats ? '#9ca3af'
        : perfStats.fps >= 55 ? '#4ade80'
        : perfStats.fps >= 40 ? '#facc15'
        : '#f87171';

    // Rough game state size: fruits × ~100B + particles × ~60B
    const estimatedKB = perfStats
        ? Math.round((perfStats.fruitCount * 100 + perfStats.particleCount * 60) / 1024 * 10) / 10
        : 0;

    return (
        <div className="absolute left-2 top-52 z-30 animate-fade-in pointer-events-auto flex flex-col gap-2 mt-4">

            {/* ── Perf Panel ─────────────────────────────── */}
            <div className="bg-black/85 text-white font-mono rounded-xl p-2 text-[10px] leading-[1.5] w-[130px] shadow-xl border border-white/10 mb-1">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Performance</div>
                <div style={{ color: fpsColor }}>
                    FPS: {perfStats?.fps ?? '…'} ({perfStats?.frameTimeMs ?? '…'}ms)
                </div>
                <div className="text-gray-300">Fruits: {perfStats?.fruitCount ?? '…'}</div>
                <div className="text-gray-300">Particles: {perfStats?.particleCount ?? '…'}</div>
                <div className="text-gray-300">Substeps: {perfStats?.substeps ?? '…'}</div>
                <div className="text-gray-300">Audio Q: {perfStats?.audioQueueLength ?? '…'}</div>
                <div className="w-full h-px bg-white/10 my-1" />
                {perfStats && perfStats.heapUsedMB > 0 ? (
                    <>
                        <div className="text-gray-300">Heap: {perfStats.heapUsedMB} / {perfStats.heapTotalMB} MB</div>
                    </>
                ) : (
                    <div className="text-gray-500 text-[9px]">Heap: N/A (Safari)</div>
                )}
                <div className="text-gray-300">State: ~{estimatedKB} KB</div>
            </div>

            {/* ── Cheat Buttons ──────────────────────────── */}
            <button
                onClick={() => { if (engine) engine.forceCurrentFruit(FruitTier.BOMB); }}
                className="w-14 h-14 bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800/50 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-600 active:scale-95 transition-all group"
                title="Spawn Bomb"
            >
                <FruitSVG tier={FruitTier.BOMB} size={40} />
            </button>
            <button
                onClick={() => { if (engine) engine.forceCurrentFruit(FruitTier.RAINBOW); }}
                className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-pink-300 active:scale-95 transition-all group"
                title="Spawn Rainbow"
            >
                <FruitSVG tier={FruitTier.RAINBOW} size={40} />
            </button>
            <button
                onClick={() => { if (engine) engine.forceCurrentFruit(FruitTier.TOMATO); }}
                className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-red-400 active:scale-95 transition-all"
                title="Spawn Tomato"
            >
                <FruitSVG tier={FruitTier.TOMATO} size={40} />
            </button>
            {/* Close */}
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
                    if (engine) engine.onPopupUpdate({ type: PopUpType.WATERMELON_CRUSH, runningTotal: 5000, multiplier: 1 });
                }}
                className="w-14 h-14 bg-green-500/50 backdrop-blur-sm hover:bg-green-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-green-700 active:scale-95 transition-all text-white font-black text-xs"
                title="Test Watermelon Crush"
            >
                WC
            </button>
            <button
                onClick={() => {
                    if (engine) engine.onPopupUpdate({ type: PopUpType.FRENZY, runningTotal: 12500, multiplier: 3 });
                }}
                className="w-14 h-14 bg-yellow-400/50 backdrop-blur-sm hover:bg-yellow-500/50 rounded-full flex items-center justify-center shadow-lg border-2 border-yellow-600 active:scale-95 transition-all text-black font-black text-xs"
                title="Test Frenzy"
            >
                XZY
            </button>
            <button
                onClick={() => {
                    if (engine) engine.onPopupUpdate({ type: PopUpType.CHAIN, runningTotal: 2400, multiplier: 12 });
                }}
                className="w-14 h-14 bg-orange-500/50 backdrop-blur-sm hover:bg-orange-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-orange-700 active:scale-95 transition-all text-white font-black text-xs"
                title="Test Chain"
            >
                CHN
            </button>
        </div>
    );
};
