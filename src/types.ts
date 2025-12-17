export type Timeframe = '30m' | '240'; // 4h = 240

export interface OHLCV {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface VolumeEvent {
    id: string; // unique ID
    symbol: string;
    timeframe: Timeframe;
    time: number; // candle OPEN time
    type: 'bullish' | 'bearish';
    severity: 'medium' | 'high';
    zScore: number;
    openPrice: number;
    closePrice: number;
}

export interface SymbolData {
    symbol: string;
    price: number;
    volume24h: number; // USD Turnover
    openInterest?: number; // Optional, might not always need it for display
    change24h: number;
    candles: Record<Timeframe, OHLCV[]>;
}

export type SortCriteria = 'volume' | 'openInterest';

export interface AppSettings {
    apiEndpoint: string;
    symbolCount: number; // default 25, max 50
    sortCriteria: SortCriteria;
    minVolumeRatio: number;
    minZScore: number;
    soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
    apiEndpoint: '/bybit_api',
    symbolCount: 25,
    sortCriteria: 'volume',
    minVolumeRatio: 2.0,
    minZScore: 2.0, // Default to a reasonable "Strong" threshold
    soundEnabled: true,
};

export interface ReportConfig {
    symbols: string[];
    timeframe: Timeframe;
    lookback: number;
    minZScore: number;
}

export interface ReportState {
    config: ReportConfig;
    results: VolumeEvent[];
    lastRun: number;
}
