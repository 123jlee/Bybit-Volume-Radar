import React, { useEffect, useState } from 'react';
import { Store } from '../services/store';
import type { VolumeEvent } from '../types';
import { Activity, Search, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface DashboardProps {
    onSelectTicker: (symbol: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectTicker }) => {
    const [events, setEvents] = useState<VolumeEvent[]>(Store.getEvents());
    const [lastUpdated, setLastUpdated] = useState<number>(Store.getLastUpdate());
    const [searchQuery, setSearchQuery] = useState('');
    const [timeframeFilter, setTimeframeFilter] = useState<'all' | '30m' | '240'>('all');

    useEffect(() => {
        const unsub = Store.subscribe(() => {
            setEvents([...Store.getEvents()]);
            setLastUpdated(Store.getLastUpdate());
        });
        return unsub;
    }, []);

    // Filter Logic
    const filteredEvents = events.filter(ev => {
        const matchesSearch = ev.symbol.toUpperCase().includes(searchQuery.toUpperCase());
        const matchesTimeframe = timeframeFilter === 'all' || ev.timeframe === timeframeFilter;
        return matchesSearch && matchesTimeframe;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header / StatusBar */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h1 className="text-2xl font-mono tracking-wider text-gray-100 flex items-center gap-3">
                    <Activity className="text-blue-500" />
                    BYBIT VOLUME RADAR
                </h1>
                <div className="text-xs font-mono text-gray-400">
                    LAST UPDATED: <span className="text-white">{new Date(lastUpdated).toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Control Bar */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-surface p-4 rounded-lg border border-white/5">
                {/* Left: Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search symbol..."
                        className="w-full bg-[#121418] border border-white/10 rounded pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Right: Timeframe Toggles */}
                <div className="flex bg-[#121418] rounded p-1 border border-white/10">
                    {(['30m', '240', 'all'] as const).map(tf => (
                        <button
                            key={tf}
                            onClick={() => setTimeframeFilter(tf)}
                            className={clsx(
                                "px-4 py-1.5 text-xs font-mono font-bold uppercase rounded transition-colors",
                                timeframeFilter === tf ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                            )}
                        >
                            {tf === '240' ? '4H' : tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto bg-surface rounded-lg border border-white/5 shadow-2xl">
                <table className="w-full text-left text-sm font-mono">
                    <thead className="bg-[#121418] text-gray-400 uppercase tracking-wider text-xs border-b border-white/5">
                        <tr>
                            <th className="p-4">Time</th>
                            <th className="p-4">Timeframe</th>
                            <th className="p-4">Symbol</th>
                            <th className="p-4">Signal</th>
                            <th className="p-4">Z-Score</th>
                            <th className="p-4 text-right">Open</th>
                            <th className="p-4 text-right">Close</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredEvents.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                                    {events.length === 0 ? 'Scanning for high-volume anomalies...' : 'No matches found.'}
                                </td>
                            </tr>
                        ) : filteredEvents.map((ev) => (
                            <tr
                                key={ev.id}
                                onClick={() => onSelectTicker(ev.symbol)}
                                className="hover:bg-white/5 cursor-pointer transition-colors group"
                            >
                                {/* Col 1: Time */}
                                <td className="p-4 text-gray-400">
                                    {new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>

                                {/* Col 2: Timeframe Badge */}
                                <td className="p-4">
                                    <span className="bg-[#121418] border border-white/10 px-2 py-1 rounded text-xs text-blue-400 font-bold">
                                        {ev.timeframe === '240' ? '4H' : '30M'}
                                    </span>
                                </td>

                                {/* Col 3: Symbol (Text only) */}
                                <td className="p-4 font-bold text-gray-200">
                                    {ev.symbol}
                                </td>

                                {/* Col 4: Signal Badge */}
                                <td className="p-4">
                                    {ev.type === 'bullish' ? (
                                        <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded w-fit">
                                            <TrendingUp size={12} /> BULL VOL
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-danger bg-danger/10 px-2 py-0.5 rounded w-fit">
                                            <TrendingDown size={12} /> BEAR VOL
                                        </span>
                                    )}
                                </td>

                                {/* Col 5: Z-Score (Hero) */}
                                <td className={clsx(
                                    "p-4 font-bold text-lg",
                                    ev.zScore > 3.0 ? "text-danger" : "text-warning"
                                )}>
                                    {ev.zScore.toFixed(2)}
                                </td>

                                {/* Col 6: Open */}
                                <td className="p-4 text-right text-gray-400">
                                    ${ev.openPrice}
                                </td>

                                {/* Col 7: Close */}
                                <td className={clsx(
                                    "p-4 text-right font-bold",
                                    ev.closePrice > ev.openPrice ? "text-success" : "text-danger"
                                )}>
                                    ${ev.closePrice}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
