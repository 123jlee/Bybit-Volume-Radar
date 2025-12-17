import React, { useState, useEffect } from 'react';
import { Store } from '../services/store';
import { BybitService } from '../services/bybit';
import type { SymbolData, VolumeEvent, Timeframe, OHLCV } from '../types';
import { ArrowLeft, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface TickerDetailProps {
    symbol: string;
    onBack: () => void;
}

export const TickerDetail: React.FC<TickerDetailProps> = ({ symbol, onBack }) => {
    const [data, setData] = useState<SymbolData | undefined>(Store.getSymbol(symbol));
    const [timeframe, setTimeframe] = useState<Timeframe>('30m');
    const [historyEvents, setHistoryEvents] = useState<VolumeEvent[]>([]);
    const [chartData, setChartData] = useState<OHLCV[]>([]);

    useEffect(() => {
        // Initial Load from Store
        const symbolData = Store.getSymbol(symbol);
        if (symbolData) {
            setData(symbolData);
            setChartData(symbolData.candles[timeframe] || []);
        }

        // Filter events for this symbol
        const events = Store.getEvents().filter(e => e.symbol === symbol);
        setHistoryEvents(events);

        // Fetch fresher/more detailed candles if needed?
        // For now rely on Store/Scanner to keep it populated or fetch on mount
        fetchMoreData();

    }, [symbol, timeframe]);

    const fetchMoreData = async () => {
        // If not enough data in store, fetch 100
        const settings = Store.getSettings();
        try {
            const candles = await BybitService.fetchCandles(symbol, timeframe, 100, settings.apiEndpoint);
            setChartData(candles);
        } catch (e) {
            console.error("Failed to load chart", e);
        }
    };

    if (!data) return <div className="p-10 text-center">Loading {symbol}...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
            >
                <ArrowLeft size={18} /> Back to Scanner
            </button>

            {/* Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="col-span-3 bg-surface p-6 rounded-lg border border-white/5">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-1">{symbol}</h1>
                            <div className="flex gap-4 text-sm text-gray-400">
                                <span>Vol 24h: <span className="text-white">${(data.volume24h / 1000000).toFixed(1)}M</span></span>
                                <span>OI: <span className="text-white">${data.openInterest ? (data.openInterest / 1000000).toFixed(1) : 0}M</span></span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-mono text-white">${data.price}</div>
                            <div className={data.change24h >= 0 ? 'text-success' : 'text-danger'}>
                                {data.change24h > 0 ? '+' : ''}{(data.change24h * 100).toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* Chart Controls */}
                    <div className="flex gap-2 mb-4">
                        {(['30m', '240'] as Timeframe[]).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wide ${timeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                            >
                                {tf === '240' ? '4H' : '30M'}
                            </button>
                        ))}
                    </div>

                    {/* Main Chart */}
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    stroke="#ffffff30"
                                    minTickGap={30}
                                />
                                <YAxis domain={['auto', 'auto']} stroke="#ffffff30" width={60} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#181b21', border: '1px solid #333' }}
                                    labelFormatter={(t) => new Date(t).toLocaleString()}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="close"
                                    stroke="#3b82f6"
                                    fillOpacity={1}
                                    fill="url(#colorPrice)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Sidebar - Session Anomalies */}
                <div className="bg-surface p-4 rounded-lg border border-white/5 h-[500px] overflow-y-auto">
                    <h3 className="text-gray-400 font-mono text-xs uppercase tracking-wider mb-4 border-b border-white/10 pb-2 flex items-center gap-2">
                        <Clock size={12} /> Session Anomalies
                    </h3>
                    <div className="space-y-3">
                        {historyEvents.length === 0 ? (
                            <div className="text-gray-500 text-sm text-center mt-10">No anomalies this session.</div>
                        ) : (
                            historyEvents.map(ev => (
                                <div key={ev.id} className="p-3 bg-white/5 rounded border-l-2 border-blue-500">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>{new Date(ev.time).toLocaleTimeString()}</span>
                                        <span className="uppercase">{ev.timeframe === '240' ? '4H' : '30M'}</span>
                                    </div>
                                    <div className="font-bold text-gray-200">{ev.type.replace('_', ' ')}</div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        Vol Ratio: <span className="text-gray-200">{ev.volumeRatio}x</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
