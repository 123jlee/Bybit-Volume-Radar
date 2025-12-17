import type { AppSettings, OHLCV, SymbolData, Timeframe } from '../types';

interface BybitTicker {
    symbol: string;
    lastPrice: string;
    turnover24h: string; // Volume
    openInterest: string;
    price24hPcnt: string;
}

interface BybitResponse<T> {
    retCode: number;
    retMsg: string;
    result: T;
}

export class BybitService {
    private static async request<T>(endpoint: string, apiBase: string): Promise<T> {
        try {
            const response = await fetch(`${apiBase}${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data: BybitResponse<T> = await response.json();
            if (data.retCode !== 0) {
                throw new Error(`Bybit API Error: ${data.retMsg}`);
            }
            return data.result;
        } catch (error) {
            console.error(`Fetch error for ${endpoint}:`, error);
            throw error;
        }
    }

    public static async fetchMarketUniverse(settings: AppSettings): Promise<SymbolData[]> {
        // 1. Get Tickers (v5/market/tickers?category=linear)
        const MAX_RETRIES = 3;
        let attempt = 0;

        while (attempt < MAX_RETRIES) {
            try {
                const response = await this.request<{ list: BybitTicker[] }>(
                    '/v5/market/tickers?category=linear',
                    settings.apiEndpoint
                );

                let allTickers = response.list.filter(t => t.symbol.endsWith('USDT'));

                // Sort
                if (settings.sortCriteria === 'openInterest') {
                    allTickers.sort((a, b) => parseFloat(b.openInterest) - parseFloat(a.openInterest));
                } else {
                    // Default Volume
                    allTickers.sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h));
                }

                // Slice logic: Limit to settings.symbolCount, max 50
                const limit = Math.min(Math.max(settings.symbolCount, 1), 50);
                const topTickers = allTickers.slice(0, limit);

                return topTickers.map(t => ({
                    symbol: t.symbol,
                    price: parseFloat(t.lastPrice),
                    volume24h: parseFloat(t.turnover24h),
                    openInterest: parseFloat(t.openInterest),
                    change24h: parseFloat(t.price24hPcnt),
                    candles: {
                        '5m': [],
                        '30m': [],
                        '240': []
                    }
                }));

            } catch (e) {
                attempt++;
                if (attempt >= MAX_RETRIES) throw e;
                await new Promise(res => setTimeout(res, 2000)); // Wait 2s
            }
        }
        return [];
    }

    public static async fetchCandles(
        symbol: string,
        timeframe: Timeframe,
        limit: number = 50,
        apiBase: string,
    ): Promise<OHLCV[]> {
        // Bybit Interval map: '5' -> 5m, '30' -> 30m, '240' -> 4h
        let apiInterval = '240';
        if (timeframe === '5m') apiInterval = '5';
        if (timeframe === '30m') apiInterval = '30';

        const response = await this.request<{ list: string[][] }>(
            `/v5/market/kline?category=linear&symbol=${symbol}&interval=${apiInterval}&limit=${limit}`,
            apiBase
        );

        // Bybit returns: [startTime, open, high, low, close, volume, turnover]
        // They are string, need parsing.
        // List is sorted LAST to FIRST (newest index 0)
        // We usually want oldest to newest for charts, or consistent. 
        // Let's return oldest -> newest for Sparklines/Calcs usually easier.

        const candles = response.list.map(c => ({
            time: parseInt(c[0]),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5])
        })).reverse();

        return candles;
    }
}
