import React, { useState, useEffect } from 'react';
import { Store } from '../services/store';
import { HistoricalReporter } from '../services/reporter';
import type { VolumeEvent, Timeframe } from '../types';
import { Download, PlayCircle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

export const Reports: React.FC = () => {
    const [symbols, setSymbols] = useState<string[]>([]);
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
    const [timeframe, setTimeframe] = useState<Timeframe>('240');
    const [lookback, setLookback] = useState<number>(500);
    const [minZScore, setMinZScore] = useState<number>(2.0);

    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState('');
    const [results, setResults] = useState<VolumeEvent[]>([]);

    useEffect(() => {
        // Load universe on mount
        const s = Store.getSymbols().map(d => d.symbol);
        setSymbols(s);
        setSelectedSymbols(s); // Default Select All
    }, []);

    const handleRun = async () => {
        setIsScanning(true);
        setResults([]);
        try {
            const data = await HistoricalReporter.generateReport({
                symbols: selectedSymbols,
                timeframe,
                lookback,
                minZScore
            }, (msg) => setProgress(msg));
            setResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsScanning(false);
            setProgress('');
        }
    };

    const handleExport = () => {
        if (results.length === 0) return;

        // CSV Header
        const headers = ['Date', 'Time', 'Symbol', 'Timeframe', 'Type', 'Z-Score', 'Open', 'Close'].join(',');
        const rows = results.map(ev => {
            const date = new Date(ev.time);
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                ev.symbol,
                ev.timeframe,
                ev.type,
                ev.zScore,
                ev.openPrice,
                ev.closePrice
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `bybit_radar_report_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h1 className="text-2xl font-mono tracking-wider text-gray-100">HISTORICAL BACKTESTING</h1>
            </div>

            {/* Control Bar */}
            <div className="bg-surface p-4 rounded-lg border border-white/5 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">

                {/* Symbol Selector */}
                <div className="col-span-2">
                    <label className="block text-xs uppercase text-gray-400 mb-1">Universe ({selectedSymbols.length}/{symbols.length})</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedSymbols(symbols)}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-xs rounded border border-white/10"
                        >
                            ALL
                        </button>
                        <div className="text-xs text-gray-500 py-1.5 px-2 bg-black/20 rounded flex-1 truncate">
                            {selectedSymbols.length === symbols.length ? 'All Active Symbols' : `${selectedSymbols.length} Selected`}
                        </div>
                    </div>
                </div>

                {/* Timeframe */}
                <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Timeframe</label>
                    <div className="flex bg-[#121418] rounded p-1 border border-white/10">
                        {(['30m', '240'] as const).map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={clsx(
                                    "flex-1 px-2 py-1 text-xs font-mono font-bold uppercase rounded transition-colors",
                                    timeframe === tf ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                                )}
                            >
                                {tf === '240' ? '4H' : tf}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lookback & Threshold */}
                <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Lookback & Min Z</label>
                    <div className="flex gap-2">
                        <select
                            value={lookback}
                            onChange={(e) => setLookback(Number(e.target.value))}
                            className="bg-[#121418] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none w-1/2"
                        >
                            <option value={200}>Last 200</option>
                            <option value={500}>Last 500</option>
                            <option value={1000}>Max (1000)</option>
                        </select>
                        <select
                            value={minZScore}
                            onChange={(e) => setMinZScore(Number(e.target.value))}
                            className="bg-[#121418] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none w-1/2"
                        >
                            <option value={1.5}>Z &gt; 1.5</option>
                            <option value={2.0}>Z &gt; 2.0</option>
                            <option value={2.5}>Z &gt; 2.5</option>
                            <option value={3.0}>Z &gt; 3.0</option>
                        </select>
                    </div>
                </div>

                {/* Action */}
                <div>
                    <button
                        onClick={handleRun}
                        disabled={isScanning}
                        className="w-full h-[34px] flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded text-sm transition-colors"
                    >
                        {isScanning ? <Loader2 className="animate-spin" size={16} /> : <PlayCircle size={16} />}
                        {isScanning ? 'SCANNING' : 'GENERATE'}
                    </button>
                </div>
            </div>

            {/* Progress */}
            {isScanning && (
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-full w-full animate-pulse"></div>
                </div>
            )}
            {progress && <div className="text-xs font-mono text-gray-400 text-center">{progress}</div>}

            {/* Export & Results Header */}
            {results.length > 0 && (
                <div className="flex justify-between items-center">
                    <h3 className="text-gray-400">Found {results.length} anomalies</h3>
                    <button onClick={handleExport} className="flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded border border-white/10 transition-colors">
                        <Download size={14} /> Download CSV
                    </button>
                </div>
            )}

            {/* Results Table (Strict Layout) */}
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
                        {results.map((ev, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                {/* Time (Full) */}
                                <td className="p-4 text-gray-400">
                                    {new Date(ev.time).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                </td>

                                {/* Timeframe */}
                                <td className="p-4">
                                    <span className="bg-[#121418] border border-white/10 px-2 py-1 rounded text-xs text-blue-400 font-bold">
                                        {ev.timeframe === '240' ? '4H' : '30M'}
                                    </span>
                                </td>

                                {/* Symbol */}
                                <td className="p-4 font-bold text-gray-200">
                                    {ev.symbol}
                                </td>

                                {/* Signal */}
                                <td className="p-4">
                                    {ev.type === 'bullish' ? (
                                        <span className="flex items-center gap-1 text-success bg-success/10 px-2 py-0.5 rounded w-fit">
                                            <TrendingUp size={12} /> BULL
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-danger bg-danger/10 px-2 py-0.5 rounded w-fit">
                                            <TrendingDown size={12} /> BEAR
                                        </span>
                                    )}
                                </td>

                                {/* Z-Score */}
                                <td className={clsx(
                                    "p-4 font-bold text-lg",
                                    ev.zScore > 3.0 ? "text-danger" : "text-warning"
                                )}>
                                    {ev.zScore.toFixed(2)}
                                </td>

                                {/* Open */}
                                <td className="p-4 text-right text-gray-400">
                                    ${ev.openPrice}
                                </td>

                                {/* Close */}
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
                {results.length === 0 && !isScanning && (
                    <div className="p-10 text-center text-gray-500 italic">No reports generated. Select parameters and click Generate.</div>
                )}
            </div>
        </div>
    );
};
