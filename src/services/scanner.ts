import type { OHLCV, Timeframe, VolumeEvent, AppSettings } from '../types';
import { BybitService } from './bybit';
import { Store } from './store';

export class ScannerEngine {
    private isScanning = false;
    private intervalId: any = null;
    private initialBackfillDone = false;

    public start() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.initialBackfillDone = false; // Reset on start
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
        let symbols = Store.getSymbols();

        // 1. Ensure Universe
        if (symbols.length === 0) {
            console.log('Universe empty, fetching top symbols...');
            const newSymbols = await BybitService.fetchMarketUniverse(settings);
            Store.updateSymbols(newSymbols);
            symbols = newSymbols;
        }

        const BATCH_SIZE = 5;
        // Temporary bucket for backfill events if this is the first run
        let backfillEvents: VolumeEvent[] = [];

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            if (!this.isScanning) break;
            const batch = symbols.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (symbolData) => {
                const events = await this.scanSymbol(symbolData.symbol, settings, !this.initialBackfillDone);
                if (events) {
                    backfillEvents.push(...events);
                }
            }));

            // Rate limit
            await new Promise(res => setTimeout(res, 200));
        }

        if (!this.initialBackfillDone) {
            // First run: Sort all gathered events and SET store
            backfillEvents.sort((a, b) => b.time - a.time);
            console.log(`Backfill complete. Found ${backfillEvents.length} events.`);
            Store.setEvents(backfillEvents);
            this.initialBackfillDone = true;
        }
    }

    private async scanSymbol(symbol: string, settings: AppSettings, isBackfill: boolean): Promise<VolumeEvent[] | null> {
        // Fetch 100 5m candles
        // Hard constraint: 5m Only
        const LOOKBACK = 100;

        try {
            const candles = await BybitService.fetchCandles(symbol, '5m', LOOKBACK, settings.apiEndpoint);

            // Update Store Data
            const currentData = Store.getSymbol(symbol);
            if (currentData) {
                currentData.candles['5m'] = candles;
                if (candles.length > 0) {
                    currentData.price = candles[candles.length - 1].close;
                }
                Store.updateSymbol(currentData);
            }

            if (candles.length < 50) return null;

            if (isBackfill) {
                // HISTORICAL REPLAY: Check ALL candles from index 50 to end
                return this.analyzeHistory(symbol, '5m', candles);
            } else {
                // LIVE MODE: Check only the LATEST candle
                this.analyzeLatest(symbol, '5m', candles, settings);
                return null;
            }

        } catch (e) {
            console.error(`Failed to scan ${symbol}`, e);
            return null;
        }
    }

    // Helper to get stats for a specific window ending at index 'endIndex' (exclusive, i.e. stats of 0..endIndex-1)
    private getStatsForWindow(candles: OHLCV[], endIndex: number, period: number = 21) {
        // We need `period` candles before `endIndex`
        if (endIndex < period) return null;

        // Window of interest for stats: [0 ... endIndex-1]
        // Actually, let's just take the last N candles up to endIndex-1
        // Optimization: Use `candles.slice(Math.max(0, endIndex - period - 50), endIndex)` to avoid processing huge arrays, 
        // but since max is 100, we can just slice 0..endIndex.

        const relevantHistory = candles.slice(0, endIndex);
        const volumes = relevantHistory.map(c => c.volume);
        const k = 2 / (period + 1);

        // Calculate EMA over the whole history up to that point
        let ema = volumes[0];
        for (let j = 1; j < volumes.length; j++) {
            ema = volumes[j] * k + ema * (1 - k);
        }

        // Calculate StdDev for the last 'period' candles
        const recent = volumes.slice(-period);
        const squareDiffs = recent.map(v => Math.pow(v - ema, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / recent.length;
        const stdDev = Math.sqrt(avgSquareDiff);

        return { ema, stdDev };
    }

    private analyzeHistory(symbol: string, timeframe: Timeframe, candles: OHLCV[]): VolumeEvent[] {
        const events: VolumeEvent[] = [];

        // Start from 50 to give nice warm data
        for (let i = 50; i < candles.length; i++) {
            const stats = this.getStatsForWindow(candles, i, 21);
            if (!stats || stats.stdDev === 0) continue;

            const current = candles[i];
            const zScore = (current.volume - stats.ema) / stats.stdDev;

            if (zScore > 2.0) {
                events.push(this.createEvent(symbol, timeframe, current, zScore));
            }
        }
        return events;
    }

    private analyzeLatest(symbol: string, timeframe: Timeframe, candles: OHLCV[], settings: AppSettings) {
        const i = candles.length - 1;
        const stats = this.getStatsForWindow(candles, i, 21);
        if (!stats || stats.stdDev === 0) return;

        const current = candles[i];
        const zScore = (current.volume - stats.ema) / stats.stdDev;

        if (zScore > 2.0) {
            const event = this.createEvent(symbol, timeframe, current, zScore);
            const existing = Store.getEvents().find(e => e.id === event.id);

            if (!existing) {
                Store.addEvent(event);
                // Sound logic
                const severity = event.severity;
                if (settings.soundEnabled && severity === 'high') {
                    this.playPing();
                }
                document.title = `(${Store.getEvents().length}) Vol. Radar`;
            }
        }
    }

    private createEvent(symbol: string, timeframe: Timeframe, candle: OHLCV, zScore: number): VolumeEvent {
        const severity: VolumeEvent['severity'] = zScore > 3.0 ? 'high' : 'medium';
        const isGreen = candle.close >= candle.open;
        const type: VolumeEvent['type'] = isGreen ? 'bullish' : 'bearish';

        return {
            id: `${symbol}-${timeframe}-${candle.time}`,
            symbol,
            timeframe,
            time: candle.time, // Open time
            type,
            severity,
            zScore: parseFloat(zScore.toFixed(2)),
            openPrice: candle.open,
            closePrice: candle.close
        };
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
