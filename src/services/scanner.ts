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
        // Re-run every 60 seconds? Or continuous loop with delays?
        // User asked for specific batching. 
        // Let's make it a continuous loop that sleeps between cycles.
        this.intervalId = setInterval(() => this.runLoop(), 30000); // Poll every 30s roughly
    }

    public stop() {
        this.isScanning = false;
        if (this.intervalId) clearInterval(this.intervalId);
    }

    private async runLoop() {
        const settings = Store.getSettings();
        const symbols = Store.getSymbols();

        if (symbols.length === 0) {
            // Try to discover
            console.log('Universe empty, fetching top symbols...');
            const newSymbols = await BybitService.fetchMarketUniverse(settings);
            Store.updateSymbols(newSymbols);
            return;
        }

        // Refresh Universe periodically? Or just assumes Universe is static per session unless manually refreshed.
        // User requirement: "On startup, fetch... Universe page toggles". 
        // We'll stick to scanning the active list.

        // Batching
        const BATCH_SIZE = 3;

        // We will loop through ALL symbols in the store.
        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (symbolData) => {
                await this.scanSymbol(symbolData.symbol, settings);
            }));

            // Small delay between batches to be nice to API/Browser
            await new Promise(res => setTimeout(res, 500));
        }

        // Update store last updated
        Store.updateSymbols(Store.getSymbols()); // Just to trigger "Last Updated" if we wanted to be granular, but Store has lastUpdate
    }

    private async scanSymbol(symbol: string, settings: AppSettings) {
        // We need 30m and 4h (240)
        // We fetch enough for Z-Score (20 period default)
        const LOOKBACK = 25;

        try {
            const [candles30m, candles4h] = await Promise.all([
                BybitService.fetchCandles(symbol, '30m', LOOKBACK, settings.apiEndpoint),
                BybitService.fetchCandles(symbol, '240', LOOKBACK, settings.apiEndpoint)
            ]);

            // Update Store with new candles so UI can show sparklines immediately
            const currentData = Store.getSymbol(symbol);
            if (currentData) {
                currentData.candles['30m'] = candles30m;
                currentData.candles['240'] = candles4h;
                // Update price from latest candle?
                if (candles30m.length > 0) {
                    currentData.price = candles30m[candles30m.length - 1].close;
                }
                Store.updateSymbol(currentData);
            }

            // Analyze
            this.analyze(symbol, '30m', candles30m, settings);
            this.analyze(symbol, '240', candles4h, settings);

        } catch (e) {
            console.error(`Failed to scan ${symbol}`, e);
        }
    }

    private analyze(symbol: string, timeframe: Timeframe, candles: OHLCV[], settings: AppSettings) {
        if (candles.length < 20) return; // Not enough data

        const current = candles[candles.length - 1]; // Developing candle

        // We compare current volume to Average of last N (excluding current)
        const history = candles.slice(0, candles.length - 1).slice(-20); // Last 20 closed
        if (history.length === 0) return;

        // 1. Volume Ratio
        const avgVol = history.reduce((sum, c) => sum + c.volume, 0) / history.length;
        if (avgVol === 0) return;
        const volRatio = current.volume / avgVol;

        // 2. Z-Score (Volume)
        // Mean is avgVol
        const variance = history.reduce((sum, c) => sum + Math.pow(c.volume - avgVol, 2), 0) / history.length;
        const stdDev = Math.sqrt(variance);
        const zScore = stdDev === 0 ? 0 : (current.volume - avgVol) / stdDev;

        // Check Thresholds
        const isVolSpike = volRatio >= settings.minVolumeRatio;
        const isZScoreSpike = zScore >= settings.minZScore;

        if (isVolSpike || isZScoreSpike) {
            // DETECTED!

            // Classify Type
            let type: VolumeEvent['type'] = 'doji';
            const bodySize = Math.abs(current.close - current.open);
            const candleRange = current.high - current.low;
            const upperWick = current.high - Math.max(current.open, current.close);
            const lowerWick = Math.min(current.open, current.close) - current.low;

            if (bodySize < candleRange * 0.1) {
                type = 'doji';
            } else if (current.close > current.open) {
                type = 'impulse_up';
                // Check for rejection? (Long upper wick on a green candle is rare but possible, usually 'rejection' implies fail to go up)
                if (upperWick > bodySize * 2) type = 'rejection';
            } else {
                type = 'impulse_down';
                if (lowerWick > bodySize * 2) type = 'rejection'; // Rejection from lows
            }

            // Classify Severity
            let severity: VolumeEvent['severity'] = 'mild';
            if (zScore > 4.0 || volRatio > 5.0) severity = 'climactic';
            else if (zScore > 3.0 || volRatio > 3.0) severity = 'strong';

            // Create Event
            const event: VolumeEvent = {
                id: `${symbol}-${timeframe}-${current.time}`,
                symbol,
                timeframe,
                time: current.time,
                type,
                severity,
                price: current.close,
                volumeRatio: parseFloat(volRatio.toFixed(2)),
                zScore: parseFloat(zScore.toFixed(2))
            };

            // Add to store (Store handles de-duplication if needed, but here ID helps)
            // We only invite NEW events. Be careful not to spam events for the same candle every polling cycle.
            // Store logic: Check if ID exists?
            // For now, let's just let the Store add it.
            // Optimization: Only add if this detected event is "better" or update existing?
            // A simple check:
            const existing = Store.getEvents().find(e => e.id === event.id);
            if (!existing) {
                Store.addEvent(event);
                if (settings.soundEnabled && (severity === 'strong' || severity === 'climactic')) {
                    this.playPing();
                }
                // Update Title
                document.title = `(${Store.getEvents().length}) Vol. Radar`;
            }
        }
    }

    private playPing() {
        // Simple beep
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
        } catch (e) {
            // Ignore audio errors
        }
    }
}

export const Scanner = new ScannerEngine();
