import React, { useState, useEffect, useMemo } from 'react';
import { Store } from '../services/store';
import { HistoricalReporter } from '../services/reporter';
import type { VolumeEvent, ReportConfig, ReportState } from '../types';
import { Download, PlayCircle, Loader2, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { MultiSelect } from './ui/MultiSelect';
import clsx from 'clsx';

export const Reports: React.FC = () => {
    // --- Persistent State ---
    const [symbols, setSymbols] = useState<string[]>([]);
    const [config, setConfig] = useState<ReportConfig>({
        symbols: [],
        timeframes: ['240'],
        lookback: 500,
        minZScore: 2.0
    });
    const [results, setResults] = useState<VolumeEvent[]>([]);

    // --- Local UI State ---
    const [isScanning, setIsScanning] = useState(false);
    const [progress, setProgress] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Sorting
    const [sortCol, setSortCol] = useState<keyof VolumeEvent | 'time'>('time');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Filtering
    const [filterSymbol, setFilterSymbol] = useState('');
    const [filterMinZ, setFilterMinZ] = useState<string>(''); // string input
    const [filterSignal, setFilterSignal] = useState<'all' | 'bullish' | 'bearish'>('all');

    // Load Persistence & Universe on Mount
    useEffect(() => {
        const universe = Store.getSymbols().map(d => d.symbol);
        setSymbols(universe);

        const savedState = Store.getReportState() as any; // Cast to any to handle migration
        if (savedState) {
            // Migration: timeframe -> timeframes
            if (savedState.config.timeframe && !savedState.config.timeframes) {
                savedState.config.timeframes = [savedState.config.timeframe];
            }

            setConfig(savedState.config);
            setResults(savedState.results);
        } else {
            // Initialize default config with all symbols if nothing saved
            setConfig(prev => ({ ...prev, symbols: universe }));
        }
    }, []);

    // Save State on Change
    useEffect(() => {
        // Only save if we have results or user deliberately changed config
        // Debounce slightly in real app, but direct save is fine here
        const state: ReportState = {
            config,
            results,
            lastRun: Date.now()
        };
        Store.saveReportState(state);
    }, [config, results]);

    const handleRun = async () => {
        setIsScanning(true);
        setResults([]); // Clear previous results immediately for feedback
        try {
            const data = await HistoricalReporter.generateReport(config, (msg) => setProgress(msg));
            setResults(data);
            setPage(1); // Reset to page 1
        } catch (e) {
            console.error(e);
        } finally {
            setIsScanning(false);
            setProgress('');
        }
    };

    const updateConfig = (key: keyof ReportConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    // --- Data Processing (Memoized) ---
    const processedData = useMemo(() => {
        let data = [...results];

        // 1. Filter
        if (filterSymbol) {
            data = data.filter(d => d.symbol.toUpperCase().includes(filterSymbol.toUpperCase()));
        }
        if (filterMinZ) {
            const z = parseFloat(filterMinZ);
            if (!isNaN(z)) {
                data = data.filter(d => d.zScore >= z);
            }
        }
        if (filterSignal !== 'all') {
            data = data.filter(d => d.type === filterSignal);
        }

        // 2. Sort
        data.sort((a, b) => {
            let valA = a[sortCol as keyof VolumeEvent];
            let valB = b[sortCol as keyof VolumeEvent];

            // Handle string comparison
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            // Handle number comparison
            return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });

        return data;
    }, [results, filterSymbol, filterMinZ, filterSignal, sortCol, sortDir]);

    // Pagination Logic
    const totalPages = Math.ceil(processedData.length / rowsPerPage);
    const paginatedData = processedData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    const handleSort = (col: keyof VolumeEvent | 'time') => {
        if (sortCol === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortCol(col);
            setSortDir('desc'); // Default to desc for new col
        }
    };

    const handleExport = () => {
        if (processedData.length === 0) return;
        const headers = ['Date', 'Time', 'Symbol', 'Timeframe', 'Type', 'Z-Score', 'Open', 'Close'].join(',');
        const rows = processedData.map(ev => {
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

    // Helper for Header Sort Icon
    const SortIcon = ({ col }: { col: string }) => {
        if (sortCol !== col) return <div className="w-3 h-3" />; // Placeholder
        return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h1 className="text-2xl font-mono tracking-wider text-gray-100">HISTORICAL BACKTESTING</h1>
            </div>

            {/* Persistence / Config Bar */}
            <div className="bg-surface p-4 rounded-lg border border-white/5 grid grid-cols-1 md:grid-cols-5 gap-4 items-end z-10 relative">
                {/* Custom Multi Select */}
                <div className="col-span-2">
                    <MultiSelect
                        options={symbols}
                        selected={config.symbols}
                        onChange={(s) => updateConfig('symbols', s)}
                        label="Universe"
                    />
                </div>

                {/* Timeframe */}
                <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Timeframe</label>
                    <div className="flex bg-[#121418] rounded p-1 border border-white/10 gap-1">
                        {(['5m', '30m', '240'] as const).map(tf => {
                            const isActive = config.timeframes.includes(tf);
                            return (
                                <button
                                    key={tf}
                                    onClick={() => {
                                        const current = config.timeframes;
                                        let next;
                                        if (current.includes(tf)) {
                                            if (current.length === 1) return; // Prevent empty
                                            next = current.filter(t => t !== tf);
                                        } else {
                                            next = [...current, tf];
                                        }
                                        updateConfig('timeframes', next);
                                    }}
                                    className={clsx(
                                        "flex-1 px-2 py-1 text-xs font-mono font-bold uppercase rounded transition-colors",
                                        isActive ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {tf === '240' ? '4H' : tf}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Lookback & Threshold */}
                <div>
                    <label className="block text-xs uppercase text-gray-400 mb-1">Lookback & Min Z</label>
                    <div className="flex gap-2">
                        <div className="w-1/2 flex flex-col justify-center h-[34px] bg-[#121418] border border-white/10 rounded px-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Limit</span>
                                <span className="text-xs font-mono font-bold text-blue-400">{config.lookback}</span>
                            </div>
                            <input
                                type="range"
                                min={100}
                                max={1000}
                                step={50}
                                value={config.lookback}
                                onChange={(e) => updateConfig('lookback', Number(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <select
                            value={config.minZScore}
                            onChange={(e) => updateConfig('minZScore', Number(e.target.value))}
                            className="bg-[#121418] border border-white/10 rounded px-2 py-2 text-xs text-white outline-none w-1/2"
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

            {/* Results Section */}
            {results.length > 0 && (
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-gray-400 bg-[#121418] border border-white/10 p-2 rounded">
                        <div className="flex gap-4">
                            <span>Found: <strong className="text-white">{results.length}</strong></span>
                            <span>Showing: <strong className="text-white">{processedData.length}</strong> (filtered)</span>
                        </div>
                        <button onClick={handleExport} className="flex items-center gap-2 hover:text-white transition-colors">
                            <Download size={14} /> Export CSV
                        </button>
                    </div>

                    {/* Excel Table */}
                    <div className="overflow-x-auto bg-surface rounded-lg border border-white/5 shadow-2xl">
                        <table className="w-full text-left text-sm font-mono">
                            <thead className="bg-[#121418] text-gray-400 uppercase tracking-wider text-xs border-b border-white/5">
                                {/* Header Row */}
                                <tr>
                                    <th className="p-4 cursor-pointer hover:bg-white/5 w-[180px]" onClick={() => handleSort('time')}>
                                        <div className="flex items-center gap-1">Time <SortIcon col="time" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-white/5 w-[100px]" onClick={() => handleSort('timeframe')}>
                                        <div className="flex items-center gap-1">TF <SortIcon col="timeframe" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-white/5 w-[120px]" onClick={() => handleSort('symbol')}>
                                        <div className="flex items-center gap-1">Symbol <SortIcon col="symbol" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-white/5 w-[120px]" onClick={() => handleSort('type')}>
                                        <div className="flex items-center gap-1">Signal <SortIcon col="type" /></div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-white/5 w-[100px]" onClick={() => handleSort('zScore')}>
                                        <div className="flex items-center gap-1">Z-Score <SortIcon col="zScore" /></div>
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-white/5" onClick={() => handleSort('openPrice')}>
                                        <div className="flex items-center justify-end gap-1">Open <SortIcon col="openPrice" /></div>
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-white/5" onClick={() => handleSort('closePrice')}>
                                        <div className="flex items-center justify-end gap-1">Close <SortIcon col="closePrice" /></div>
                                    </th>
                                </tr>

                                {/* Filter Row */}
                                <tr className="bg-[#121418] border-b border-white/5">
                                    <td className="p-2 border-r border-white/5"></td> {/* Time */}
                                    <td className="p-2 border-r border-white/5"></td> {/* TF */}
                                    <td className="p-2 border-r border-white/5">
                                        <div className="relative">
                                            <Filter size={10} className="absolute left-2 top-2.5 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Filter..."
                                                value={filterSymbol}
                                                onChange={(e) => setFilterSymbol(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded py-1 pl-6 pr-2 text-xs text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-2 border-r border-white/5">
                                        <select
                                            value={filterSignal}
                                            onChange={(e) => setFilterSignal(e.target.value as any)}
                                            className="w-full bg-black/20 border border-white/10 rounded py-1 px-2 text-xs text-white outline-none"
                                        >
                                            <option value="all">All</option>
                                            <option value="bullish">Bullish</option>
                                            <option value="bearish">Bearish</option>
                                        </select>
                                    </td>
                                    <td className="p-2 border-r border-white/5">
                                        <div className="flex items-center gap-1">
                                            <span className="text-gray-500 text-xs">&gt;</span>
                                            <input
                                                type="number"
                                                placeholder="2.0"
                                                step="0.1"
                                                value={filterMinZ}
                                                onChange={(e) => setFilterMinZ(e.target.value)}
                                                className="w-full bg-black/20 border border-white/10 rounded py-1 px-2 text-xs text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </td>
                                    <td className="p-2 border-r border-white/5"></td> {/* Open */}
                                    <td className="p-2"></td> {/* Close */}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/5">
                                {paginatedData.map((ev, i) => (
                                    <tr key={ev.id + i} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-gray-400">
                                            {new Date(ev.time).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-[#121418] border border-white/10 px-2 py-1 rounded text-xs text-blue-400 font-bold">
                                                {ev.timeframe === '240' ? '4H' : ev.timeframe.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-4 font-bold text-gray-200">
                                            {ev.symbol}
                                        </td>
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
                                        <td className={clsx(
                                            "p-4 font-bold text-lg",
                                            ev.zScore > 3.0 ? "text-danger" : "text-warning"
                                        )}>
                                            {ev.zScore.toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right text-gray-400">
                                            ${ev.openPrice}
                                        </td>
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

                    {/* Pagination Footer */}
                    <div className="flex justify-between items-center bg-[#121418] rounded-lg p-2 border border-white/5">
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>Rows per page:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="bg-black/20 border border-white/10 rounded px-2 py-1 outline-none text-white"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                                Page {page} of {totalPages || 1}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => {
                                        setPage(p => Math.max(1, p - 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' }); // As requested
                                    }}
                                    disabled={page === 1}
                                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setPage(p => Math.min(totalPages, p + 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={page >= totalPages}
                                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
