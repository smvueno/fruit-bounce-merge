import React from 'react';
import { LeaderboardEntry } from '../types';
import { FRUIT_DEFS } from '../services/fruitConfig';
import { Trophy } from 'lucide-react';

interface RankingTableProps {
    entries: LeaderboardEntry[];
    highlightEntry?: { score: number; name: string };
    title?: string;
    maxHeight?: string; // e.g. "max-h-40" or "max-h-[300px]"
}

export const RankingTable: React.FC<RankingTableProps> = ({
    entries,
    highlightEntry,
    title = "Global Leaderboard",
    maxHeight = "flex-1" // Default to filling available space if flex parent, otherwise specify
}) => {

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Ensure entries are sorted
    const sortedLeaderboard = [...entries].sort((a, b) => b.score - a.score).slice(0, 100); // always top 100 max

    return (
        <div className={`w-full bg-slate-50 border border-slate-200 rounded-2xl shadow-inner flex flex-col overflow-hidden min-h-0 ${maxHeight}`}>
            <div className="flex items-center justify-center gap-2 text-slate-400 uppercase tracking-widest text-xs font-bold py-2 md:py-3 shrink-0 bg-slate-50/80 backdrop-blur z-20 sticky top-0 border-b border-slate-100">
                <Trophy size={14} /> {title}
            </div>

            {/* Scrollable Container - removed custom-scrollbar to rely on native overflow behavior if needed,
                but trying to fit content first. Kept overflow-x-auto just in case. */}
            <div className="flex-1 overflow-x-auto custom-scrollbar relative w-full">
                <table className="w-full text-left border-collapse table-fixed md:table-auto">
                    <thead>
                        <tr className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                            {/* Rank */}
                            <th className="w-8 md:w-12 bg-slate-50 p-1 md:p-2 text-center border-r border-slate-100">#</th>

                            {/* Name */}
                            <th className="bg-slate-50 p-1 md:p-2 text-left">Name</th>

                            {/* Score */}
                            <th className="w-16 md:w-24 p-1 md:p-2 text-right font-bold">Score</th>

                            {/* Lvl - Hidden on very small screens if needed, but trying to keep it */}
                            <th className="w-10 md:w-16 p-1 md:p-2 text-center font-bold">Lvl</th>

                            {/* Time - Hidden on extremely small screens? */}
                            <th className="w-12 md:w-20 p-1 md:p-2 text-center font-bold pr-2 md:pr-3">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedLeaderboard.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center text-slate-400 italic text-sm py-4">
                                    No scores yet. Be the first!
                                </td>
                            </tr>
                        ) : (
                            sortedLeaderboard.map((entry, idx) => {
                                const isHighlight = highlightEntry && entry.score === highlightEntry.score && entry.name === highlightEntry.name;
                                const rowBg = isHighlight ? 'bg-blue-50/50' : 'bg-transparent';
                                // Removed sticky logic for simpler responsive layout since we are trying to fit everything in view

                                return (
                                    <tr key={idx} className={`text-[11px] md:text-sm font-bold border-b border-slate-100 last:border-0 ${rowBg}`}>

                                        {/* Rank */}
                                        <td className="p-1 md:p-2 text-center border-r border-slate-100 text-slate-400 font-normal">
                                            <span className={idx < 3 ? 'text-yellow-500 font-bold' : ''}>
                                                {idx + 1}
                                            </span>
                                        </td>

                                        {/* Name - Truncated */}
                                        <td className="p-1 md:p-2 text-slate-700">
                                            <div className="truncate max-w-[80px] min-[350px]:max-w-[100px] md:max-w-none">
                                                {entry.name}
                                            </div>
                                        </td>

                                        {/* Score */}
                                        <td className="p-1 md:p-2 text-right font-mono text-slate-800 tracking-tight">
                                            {entry.score.toLocaleString()}
                                        </td>

                                        {/* Lvl */}
                                        <td className="p-1 md:p-2 text-center">
                                            <div className="flex justify-center items-center">
                                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full mr-1" style={{ backgroundColor: FRUIT_DEFS[entry.maxTier ?? 0]?.color || '#999' }}></div>
                                                <span className="text-slate-500 font-mono">{(entry.maxTier ?? 0) + 1}</span>
                                            </div>
                                        </td>

                                        {/* Time */}
                                        <td className="p-1 md:p-2 text-center font-normal text-slate-500 font-mono pr-2 md:pr-3">
                                            {formatTime(entry.timePlayed || 0)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
