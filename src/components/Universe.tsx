import React, { useState, useEffect } from 'react';
import { Store } from '../services/store';
import { BybitService } from '../services/bybit';
import type { SymbolData } from '../types';
import { RefreshCw, Search } from 'lucide-react';

export const Universe: React.FC = () => {
    const [symbols, setSymbols] = useState<SymbolData[]>(Store.getSymbols());
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setSymbols(Store.getSymbols());
    }, []);

    const handleRefresh = async () => {
        setLoading(true);
        const settings = Store.getSettings();
        try {
            const newSymbols = await BybitService.fetchMarketUniverse(settings);
            Store.updateSymbols(newSymbols);
            setSymbols(newSymbols);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSymbol = (symbol: string) => {
        // In a real complex app we might have an "ignorere list".
        // For now, if we remove it from Store, it comes back on Refresh.
        // Let's implement a boolean toggle if we had an "isActive" flag.
        // Given the constraints and simplicity:
        // "Toggle specific symbols on/off" -> implies we should filter what we scan.
        // Implementation: We can remove it from the Store list.
        const newDetails = symbols.filter(s => s.symbol !== symbol);
        Store.updateSymbols(newDetails);
        setSymbols(newDetails);
    };

    const filtered = symbols.filter(s => s.symbol.includes(search.toUpperCase()));

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-mono text-white">Market Universe ({symbols.length})</h2>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
                        <input
                            className="bg-[#121418] border border-white/10 rounded pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-12 bg-[#121418] p-3 text-xs text-gray-400 uppercase font-mono">
                    <div className="col-span-3">Symbol</div>
                    <div className="col-span-3 text-right">Price</div>
                    <div className="col-span-3 text-right">24h Vol</div>
                    <div className="col-span-3 text-right">Action</div>
                </div>
                <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                    {filtered.map(s => (
                        <div key={s.symbol} className="grid grid-cols-12 p-3 items-center hover:bg-white/5 text-sm">
                            <div className="col-span-3 font-bold text-gray-200">{s.symbol}</div>
                            <div className="col-span-3 text-right text-gray-400">${s.price}</div>
                            <div className="col-span-3 text-right text-gray-400">
                                ${(s.volume24h / 1000000).toFixed(1)}M
                            </div>
                            <div className="col-span-3 text-right">
                                <button
                                    onClick={() => toggleSymbol(s.symbol)}
                                    className="text-xs bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1 rounded transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
