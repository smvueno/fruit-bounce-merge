
import React, { useEffect, useState } from 'react';
import { GameEngine } from '../services/GameEngine';
import { FruitTier } from '../types';
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

    const [frozen, setFrozen] = useState(false);

    // Poll engine perfStats every 500ms while the debug menu is open
    useEffect(() => {
        const tick = () => {
            if (engine) {
                setPerfStats({ ...engine.perfStats });
                setFrozen(engine.paused);
            }
        };
        tick(); // immediate first read
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [engine]);

    const fpsColor = !perfStats || frozen ? '#9ca3af'
        : perfStats.fps >= 55 ? '#4ade80'
        : perfStats.fps >= 40 ? '#facc15'
        : '#f87171';

    const estimatedKB = perfStats
        ? Math.round((perfStats.fruitCount * 100 + perfStats.particleCount * 60) / 1024 * 10) / 10
        : 0;

    return (
        // z-[60] renders above PauseMenu (z-50) so the panel is always visible
        <div className="absolute left-2 top-52 z-[60] animate-fade-in pointer-events-auto flex flex-col gap-2 mt-4">

            {/* ── Perf Panel ─────────────────────────────── */}
            <div className="bg-black/90 text-white font-mono rounded-xl p-2 text-[10px] leading-[1.5] w-[132px] shadow-xl border border-white/20 mb-1">
                <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    Performance
                    {frozen && <span className="text-yellow-400 text-[8px]">(paused)</span>}
                </div>
                <div style={{ color: fpsColor }}>
                    FPS: {perfStats?.fps ?? '…'} / {perfStats?.frameTimeMs ?? '…'}ms
                </div>
                <div className="text-gray-300">Fruits: {perfStats?.fruitCount ?? '…'}</div>
                <div className="text-gray-300">Particles: {perfStats?.particleCount ?? '…'}</div>
                <div className="text-gray-300">Substeps: {perfStats?.substeps ?? '…'}</div>
                <div className="text-gray-300">Audio Q: {perfStats?.audioQueueLength ?? '…'}</div>
                <div className="w-full h-px bg-white/10 my-1" />
                {perfStats && perfStats.heapUsedMB > 0 ? (
                    <div className="text-gray-300">Heap: {perfStats.heapUsedMB}/{perfStats.heapTotalMB}MB</div>
                ) : (
                    <div className="text-gray-500 text-[9px]">Heap: N/A (Safari)</div>
                )}
                <div className="text-gray-300">State: ~{estimatedKB}KB</div>
            </div>

            {/* ── Cheat Buttons ──────────────────────────── */}
            <button
                onClick={() => { if (engine) engine.forceCurrentFruit(FruitTier.BOMB); }}
                className="w-14 h-14 bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800/50 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-600 active:scale-95 transition-all"
                title="Spawn Bomb"
            >
                <FruitSVG tier={FruitTier.BOMB} size={40} />
            </button>
            <button
                onClick={() => { if (engine) engine.forceCurrentFruit(FruitTier.RAINBOW); }}
                className="w-14 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/60 rounded-full flex items-center justify-center shadow-lg border-2 border-pink-300 active:scale-95 transition-all"
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
            <button
                onClick={onClose}
                className="w-14 h-14 bg-red-500/50 backdrop-blur-sm hover:bg-red-600/50 rounded-full flex items-center justify-center shadow-lg border-2 border-red-700 active:scale-95 transition-all"
                title="Close Cheat Menu"
            >
                <X size={24} className="text-white" strokeWidth={3} />
            </button>
        </div>
    );
};
