import React from 'react';
import { LeaderboardEntry } from '../types';
import { FRUIT_DEFS } from '../constants';
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
    const sortedLeaderboard = [...entries].sort((a, b) => b.score - a.score).slice(0, 10); // always top 10 max

    return (
        <div className={`w-full bg-slate-50 border border-slate-200 rounded-2xl shadow-inner flex flex-col overflow-hidden min-h-0 ${maxHeight}`}>
            <div className="flex items-center justify-center gap-2 text-slate-400 uppercase tracking-widest text-xs font-bold py-4 shrink-0 bg-slate-50/80 backdrop-blur z-20 sticky top-0 border-b border-slate-100">
                <Trophy size={14} /> {title}
            </div>

            {/* Scrollable Container */}
            <div className="flex-1 overflow-x-auto custom-scrollbar relative w-full">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                            {/* Sticky Header: Rank + Name */}
                            <th className="sticky left-0 z-20 bg-slate-50 p-2 pl-0 border-r border-slate-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                                <div className="flex items-center gap-2 px-2">
                                    <div className="w-8 text-center shrink-0">#</div>
                                    <div className="text-left whitespace-nowrap">Name</div>
                                </div>
                            </th>

                            {/* Scrollable Headers: Score | Lvl | Time */}
                            <th className="px-3 py-2 text-right font-bold">Score</th>
                            <th className="px-3 py-2 text-center font-bold">Lvl</th>
                            <th className="px-3 py-2 text-center font-bold pr-3">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedLeaderboard.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center text-slate-400 italic text-sm py-4">
                                    No scores yet. Be the first!
                                </td>
                            </tr>
                        ) : (
                            sortedLeaderboard.map((entry, idx) => {
                                const isHighlight = highlightEntry && entry.score === highlightEntry.score && entry.name === highlightEntry.name;
                                const rowBg = isHighlight ? 'bg-blue-50/50' : 'bg-transparent';
                                const stickyBg = isHighlight ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-700';

                                return (
                                    <tr key={idx} className={`text-sm font-bold border-b border-slate-100 last:border-0 ${rowBg}`}>

                                        {/* Sticky Cell: Rank + Name */}
                                        <td className={`sticky left-0 z-10 p-0 border-r border-slate-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] ${stickyBg}`}>
                                            <div className="flex items-center gap-2 px-2 py-3">
                                                <div className={`w-8 text-center shrink-0 ${idx < 3 ? 'text-yellow-500' : 'text-slate-400'}`}>
                                                    #{idx + 1}
                                                </div>
                                                <div className="text-left whitespace-nowrap px-1">
                                                    {entry.name}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Dynamic Stat Cells: Score | Lvl | Time */}
                                        <td className="px-3 py-3 text-right font-mono text-slate-800 whitespace-nowrap">
                                            {entry.score.toLocaleString()}
                                        </td>

                                        <td className="px-3 py-3 text-center whitespace-nowrap">
                                            <div className="flex justify-center items-center">
                                                <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: FRUIT_DEFS[entry.maxTier ?? 0]?.color || '#999' }}></div>
                                                <span className="text-slate-500">{(entry.maxTier ?? 0) + 1}</span>
                                            </div>
                                        </td>

                                        <td className="px-3 py-3 text-center text-xs font-normal text-slate-500 font-mono whitespace-nowrap pr-3">
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
