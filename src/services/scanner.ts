import type { OHLCV, Timeframe, VolumeEvent, AppSettings } from '../types';
import { BybitService } from './bybit';
import { Store } from './store';

export class ScannerEngine {
    private isScanning = false;
    private intervalId: any = null;

    public start() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.runLoop();
        // Poll every 60s
        this.intervalId = setInterval(() => this.runLoop(), 60000);
    }

    public stop() {
        this.isScanning = false;
        if (this.intervalId) clearInterval(this.intervalId);
    }

    public getStatus() {
        return this.isScanning;
    }

    private async runLoop() {
        const settings = Store.getSettings();
        const symbols = Store.getSymbols();

        if (symbols.length === 0) {
            console.log('Universe empty, fetching top symbols...');
            const newSymbols = await BybitService.fetchMarketUniverse(settings);
            Store.updateSymbols(newSymbols);
            return;
        }

        const BATCH_SIZE = 5;

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (symbolData) => {
                await this.scanSymbol(symbolData.symbol, settings);
            }));

            // Rate limit safety
            await new Promise(res => setTimeout(res, 500));
        }
    }

    private async scanSymbol(symbol: string, settings: AppSettings) {
        // 1. Fetch 100 candles (needed for EMA warm-up)
        const LOOKBACK = 100;

        try {
            const [candles5m, candles30m] = await Promise.all([
                BybitService.fetchCandles(symbol, '5m', LOOKBACK, settings.apiEndpoint),
                BybitService.fetchCandles(symbol, '30m', LOOKBACK, settings.apiEndpoint)
            ]);

            // Update Store
            const currentData = Store.getSymbol(symbol);
            if (currentData) {
                currentData.candles['5m'] = candles5m;
                currentData.candles['30m'] = candles30m;
                if (candles5m.length > 0) {
                    currentData.price = candles5m[candles5m.length - 1].close;
                }
                Store.updateSymbol(currentData);
            }

            // Analyze
            this.analyze(symbol, '5m', candles5m, settings);
            this.analyze(symbol, '30m', candles30m, settings);

        } catch (e) {
            console.error(`Failed to scan ${symbol}`, e);
        }
    }

    private calculateStatistics(candles: OHLCV[], period: number = 21) {
        // Need at least period + a few candles
        if (candles.length < period + 10) return null;

        // Extract volumes
        const volumes = candles.map(c => c.volume);

        // Function to calculate EMA
        const calculateEMA = (values: number[], days: number) => {
            const k = 2 / (days + 1);
            let ema = values[0];
            for (let i = 1; i < values.length; i++) {
                ema = values[i] * k + ema * (1 - k);
            }
            return ema;
        };

        // Function to calculate StdDev (Simple) of the last N items
        const calculateStdDev = (values: number[], mean: number) => {
            const squareDiffs = values.map(value => Math.pow(value - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
            return Math.sqrt(avgSquareDiff);
        };

        // We want the EMA/StdDev of the HISTORY (excluding current developing candle)
        // candles[0] is oldest, candles[last] is current (developing)
        // BybitService returns oldest -> newest.
        const historyVectors = volumes.slice(0, -1);

        // Calculate EMA on the full history to let it stabilize
        const ema = calculateEMA(historyVectors, period);

        // Calculate StdDev on the recent window (last 21 of history)
        const recentHistory = historyVectors.slice(-period);
        const stdDev = calculateStdDev(recentHistory, ema);

        return { ema, stdDev };
    }

    private analyze(symbol: string, timeframe: Timeframe, candles: OHLCV[], settings: AppSettings) {
        if (candles.length < 50) return;

        // "Backfill" - Check the last 3 candles to ensure we catch recent anomalies immediately
        // Iterating from len-3 to len-1
        const startIndex = Math.max(50, candles.length - 3);

        for (let i = startIndex; i < candles.length; i++) {
            const current = candles[i];

            // To calculate stats correctly for index 'i', we should use history 0 to i-1. 
            // Optimally we'd re-calc every time. Given checking only 3, it's fine.
            const stats = this.calculateStatistics(candles.slice(0, i + 1), 21); // i+1 to include current potential candle? No, calcStats expects full array and slices off last one. 
            // Wait, calculateStatistics(candles) slices off the last one. 
            // If we pass candles.slice(0, i+1), the last item is 'current'. calculateStatistics will slice it off and use remainder as history. Correct.

            if (!stats || stats.stdDev === 0) continue;

            // Formula: (Current Volume - EMA(21)) / StdDev(21)
            const zScore = (current.volume - stats.ema) / stats.stdDev;

            if (zScore > 2.0) {
                // Classification
                const severity: VolumeEvent['severity'] = zScore > 3.0 ? 'high' : 'medium';

                const isGreen = current.close >= current.open;
                const type: VolumeEvent['type'] = isGreen ? 'bullish' : 'bearish';

                const event: VolumeEvent = {
                    id: `${symbol}-${timeframe}-${current.time}`,
                    symbol,
                    timeframe,
                    time: current.time, // Open time
                    type,
                    severity,
                    zScore: parseFloat(zScore.toFixed(2)),
                    openPrice: current.open,
                    closePrice: current.close
                };

                const existing = Store.getEvents().find(e => e.id === event.id);
                if (!existing) {
                    Store.addEvent(event);
                    if (settings.soundEnabled && severity === 'high') {
                        // Only play sound for the LATEST candle to avoid spamming on backfill
                        if (i === candles.length - 1) {
                            this.playPing();
                        }
                    }
                    if (i === candles.length - 1) {
                        document.title = `(${Store.getEvents().length}) Vol. Radar`;
                    }
                }
            }
        }
    }

    private playPing() {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.1;
            osc.start();
            setTimeout(() => osc.stop(), 200);
        } catch (e) { }
    }
}

export const Scanner = new ScannerEngine();
