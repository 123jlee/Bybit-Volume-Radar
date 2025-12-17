import React, { useEffect, useState } from 'react';
import { Store } from '../services/store';
import type { VolumeEvent } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface DashboardProps {
    onSelectTicker: (symbol: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectTicker }) => {
    const [events, setEvents] = useState<VolumeEvent[]>(Store.getEvents());
    const [lastUpdated, setLastUpdated] = useState<number>(Store.getLastUpdate());

    useEffect(() => {
        const unsub = Store.subscribe(() => {
            setEvents([...Store.getEvents()]);
            setLastUpdated(Store.getLastUpdate());
        });
        return unsub;
    }, []);

    const getSeverityColor = (severity: VolumeEvent['severity']) => {
        switch (severity) {
            case 'climactic': return 'text-purple-400 font-bold';
            case 'strong': return 'text-danger font-bold';
            case 'mild': return 'text-warning';
            default: return 'text-gray-400';
        }
    };

    const getTypeIcon = (type: VolumeEvent['type']) => {
        switch (type) {
            case 'impulse_up': return <TrendingUp className="w-4 h-4 text-success" />;
            case 'impulse_down': return <TrendingDown className="w-4 h-4 text-danger" />;
            case 'rejection': return <AlertCircle className="w-4 h-4 text-warning" />;
            default: return <Activity className="w-4 h-4 text-gray-500" />;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header / StatusBar */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h1 className="text-2xl font-mono tracking-wider text-gray-100 flex items-center gap-3">
                    <Activity className="text-blue-500" />
                    BYBIT VOLUME RADAR
                </h1>
                <div className="text-xs font-mono text-gray-400">
                    STATUS: <span className="text-success">ONLINE</span> |
                    UPDATED: {new Date(lastUpdated).toLocaleTimeString()}
                </div>
            </div>

            {/* Main Table */}
            <div className="overflow-x-auto bg-surface rounded-lg border border-white/5 shadow-2xl">
                <table className="w-full text-left text-sm font-mono">
                    <thead className="bg-[#121418] text-gray-400 uppercase tracking-wider text-xs">
                        <tr>
                            <th className="p-4">Time</th>
                            <th className="p-4">Symbol</th>
                            <th className="p-4">Signal</th>
                            <th className="p-4">Severity</th>
                            <th className="p-4 text-right">Price</th>
                            <th className="p-4 text-right">Vol Ratio</th>
                            <th className="p-4 text-right">Z-Score</th>
                            <th className="p-4 w-32">Trend (20)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-gray-500 italic">
                                    Scanning for anomalies... (Waiting for next batch)
                                </td>
                            </tr>
                        ) : events.map((ev) => {
                            // Get sparkline data
                            const symbolData = Store.getSymbol(ev.symbol);
                            const limit = 20;
                            const sparkData = symbolData?.candles[ev.timeframe]?.slice(-limit).map(c => ({ c: c.close })) || [];

                            return (
                                <tr
                                    key={ev.id}
                                    onClick={() => onSelectTicker(ev.symbol)}
                                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                                >
                                    <td className="p-4 text-gray-400">{new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="p-4 font-bold text-gray-200 group-hover:text-blue-400">{ev.symbol}</td>
                                    <td className="p-4 flex items-center gap-2">
                                        {getTypeIcon(ev.type)}
                                        <span className="capitalize">{ev.type.replace('_', ' ')}</span>
                                    </td>
                                    <td className={clsx("p-4 uppercase", getSeverityColor(ev.severity))}>
                                        {ev.severity}
                                    </td>
                                    <td className="p-4 text-right text-gray-300">${ev.price.toFixed(ev.price < 1 ? 4 : 2)}</td>
                                    <td className={clsx("p-4 text-right", ev.volumeRatio > 3 ? "text-danger" : "text-success")}>
                                        {ev.volumeRatio}x
                                    </td>
                                    <td className="p-4 text-right text-gray-400">{ev.zScore}</td>
                                    <td className="p-2">
                                        <div className="h-8 w-24">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={sparkData}>
                                                    <Area
                                                        type="monotone"
                                                        dataKey="c"
                                                        stroke="#3b82f6"
                                                        fill="#3b82f6"
                                                        fillOpacity={0.1}
                                                        strokeWidth={1}
                                                        isAnimationActive={false}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
