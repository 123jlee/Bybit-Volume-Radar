import React, { useState, useEffect } from 'react';
import { Store } from '../services/store';
import { Scanner } from '../services/scanner';
import type { VolumeEvent } from '../types';
import { PlayCircle, StopCircle, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import clsx from 'clsx';
import { formatTime } from '../utils/date';

interface DashboardProps {
    onSelectTicker: (symbol: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectTicker }) => {
    const [events, setEvents] = useState<VolumeEvent[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [useUTC, setUseUTC] = useState(true);
    const [nextUpdate, setNextUpdate] = useState(60);

    useEffect(() => {
        // 1. Subscribe to Store updates
        const unsubscribe = Store.subscribe(() => {
            setEvents([...Store.getEvents()]); // Create copy to force re-render
        });

        // 2. Initial State
        setEvents(Store.getEvents());
        setIsScanning(Scanner.getStatus());

        // 3. Status Poll (for countdown / status) (Optional visual flair)
        const statusInterval = setInterval(() => {
            const active = Scanner.getStatus();
            setIsScanning(active);
            if (active) {
                setNextUpdate(prev => (prev > 0 ? prev - 1 : 60));
            } else {
                setNextUpdate(60);
            }
        }, 1000);

        return () => {
            unsubscribe();
            clearInterval(statusInterval);
        };
    }, []);

    const toggleScanner = () => {
        if (isScanning) {
            Scanner.stop();
            setIsScanning(false);
        } else {
            Scanner.start();
            setIsScanning(true);
            setNextUpdate(60);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h1 className="text-2xl font-mono tracking-wider text-gray-100 flex items-center gap-3">
                    <Activity className="text-blue-500" />
                    TACTICAL STREAM
                </h1>
            </div>

            {/* Control Bar (Header) */}
            <div className="bg-[#121418] p-4 rounded-lg border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">

                {/* Left: Start/Stop & Status */}
                <div className="flex items-center gap-6 w-full md:w-auto">
                    <button
                        onClick={toggleScanner}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-2 rounded font-bold text-sm transition-all shadow-lg",
                            isScanning
                                ? "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50"
                                : "bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/50 animate-pulse"
                        )}
                    >
                        {isScanning ? <StopCircle size={18} /> : <PlayCircle size={18} />}
                        {isScanning ? 'STOP RADAR' : 'START RADAR'}
                    </button>

                    <div className="flex flex-col">
                        <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">Status</span>
                        <span className={clsx("font-mono text-sm", isScanning ? "text-blue-400" : "text-gray-500")}>
                            {isScanning ? `SCANNING... UPDATE IN ${nextUpdate}s` : 'RADAR OFFLINE'}
                        </span>
                    </div>
                </div>

                {/* Right: Timezone Toggle */}
                <div className="flex items-center gap-3 bg-black/20 p-1.5 rounded-lg border border-white/5">
                    <Clock size={14} className="text-gray-500 ml-2" />
                    <div className="flex">
                        <button
                            onClick={() => setUseUTC(true)}
                            className={clsx(
                                "px-3 py-1 text-xs font-bold rounded transition-colors",
                                useUTC ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            UTC
                        </button>
                        <button
                            onClick={() => setUseUTC(false)}
                            className={clsx(
                                "px-3 py-1 text-xs font-bold rounded transition-colors",
                                !useUTC ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            LOCAL
                        </button>
                    </div>
                </div>
            </div>

            {/* Stream Table */}
            <div className="bg-surface rounded-lg border border-white/5 shadow-2xl overflow-hidden min-h-[400px]">
                <table className="w-full text-left text-sm font-mono">
                    <thead className="bg-[#0a0c10] text-gray-500 uppercase tracking-wider text-xs border-b border-white/5 sticky top-0">
                        <tr>
                            <th className="p-4 w-[140px]">Time</th>
                            <th className="p-4 w-[100px]">Symbol</th>
                            <th className="p-4 w-[80px]">TF</th>
                            <th className="p-4 w-[120px]">Signal</th>
                            <th className="p-4 w-[100px]">Z-Score</th>
                            <th className="p-4 text-right">Open</th>
                            <th className="p-4 text-right">Close</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-gray-600 italic flex flex-col items-center justify-center gap-4">
                                    <Activity size={48} className="opacity-20" />
                                    {isScanning ? 'Scanning for high-volume anomalies...' : 'Radar Offline. Click START to begin.'}
                                </td>
                            </tr>
                        ) : events.map((ev) => (
                            <tr
                                key={ev.id}
                                onClick={() => onSelectTicker(ev.symbol)}
                                className="hover:bg-white/5 cursor-pointer transition-colors group animate-in slide-in-from-top-2 duration-300"
                            >
                                {/* Col 1: Time (Formatted) */}
                                <td className="p-4 text-gray-400 border-l-2 border-transparent group-hover:border-blue-500">
                                    {formatTime(ev.time, useUTC)}
                                </td>

                                {/* Col 2: Symbol */}
                                <td className="p-4 font-bold text-gray-200 group-hover:text-white">
                                    {ev.symbol}
                                </td>

                                {/* Col 3: Timeframe */}
                                <td className="p-4">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                                        ev.timeframe === '5m'
                                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    )}>
                                        {ev.timeframe === '240' ? '4H' : ev.timeframe}
                                    </span>
                                </td>

                                {/* Col 4: Signal */}
                                <td className="p-4">
                                    {ev.type === 'bullish' ? (
                                        <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded w-fit text-xs border border-success/20">
                                            <TrendingUp size={12} /> BULL
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-danger bg-danger/10 px-2 py-0.5 rounded w-fit text-xs border border-danger/20">
                                            <TrendingDown size={12} /> BEAR
                                        </span>
                                    )}
                                </td>

                                {/* Col 5: Z-Score */}
                                <td className={clsx(
                                    "p-4 font-bold text-base",
                                    ev.zScore > 3.0 ? "text-danger drop-shadow-md" : "text-warning"
                                )}>
                                    {ev.zScore.toFixed(2)}
                                </td>

                                {/* Col 6: Open */}
                                <td className="p-4 text-right text-gray-500 text-xs">
                                    ${ev.openPrice}
                                </td>

                                {/* Col 7: Close */}
                                <td className={clsx(
                                    "p-4 text-right font-bold text-sm",
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
