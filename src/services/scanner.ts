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
        // Poll every 30s
        this.intervalId = setInterval(() => this.runLoop(), 30000);
    }

    public stop() {
        this.isScanning = false;
        if (this.intervalId) clearInterval(this.intervalId);
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

        const BATCH_SIZE = 3;

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (symbolData) => {
                await this.scanSymbol(symbolData.symbol, settings);
            }));

            await new Promise(res => setTimeout(res, 500));
        }
    }

    private async scanSymbol(symbol: string, settings: AppSettings) {
        // 1. Fetch 100 candles (needed for EMA warm-up)
        const LOOKBACK = 100;

        try {
            const [candles30m, candles4h] = await Promise.all([
                BybitService.fetchCandles(symbol, '30m', LOOKBACK, settings.apiEndpoint),
                BybitService.fetchCandles(symbol, '240', LOOKBACK, settings.apiEndpoint)
            ]);

            // Update Store
            const currentData = Store.getSymbol(symbol);
            if (currentData) {
                currentData.candles['30m'] = candles30m;
                currentData.candles['240'] = candles4h;
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
        // wait, BybitService returns oldest -> newest. Correct.
        // So history is candles.slice(0, -1).

        const historyVectors = volumes.slice(0, -1);

        // Calculate EMA on the full history to let it stabilize
        // We take the LAST calculated EMA value as our baseline
        const ema = calculateEMA(historyVectors, period);

        // Calculate StdDev on the recent window (last 21 of history)
        const recentHistory = historyVectors.slice(-period);
        const stdDev = calculateStdDev(recentHistory, ema); // StdDev around the EMA? Or around simple Mean?
        // Standard Bollinger Band / Z-Score uses Simple Moving Average for StdDev usually.
        // But prompt says "EMA(21) / StdDev(21)". 
        // Let's use StdDev relative to the EMA for "deviation from trend".

        return { ema, stdDev };
    }

    private analyze(symbol: string, timeframe: Timeframe, candles: OHLCV[], settings: AppSettings) {
        if (candles.length < 50) return;

        const current = candles[candles.length - 1]; // Developing
        const stats = this.calculateStatistics(candles, 21);

        if (!stats || stats.stdDev === 0) return;

        // Formula: (Current Volume - EMA(21)) / StdDev(21)
        const zScore = (current.volume - stats.ema) / stats.stdDev;

        // Filter Criteria: Keep symbol IF Z-Score > 2.0 (or settings.minZScore)
        // Prompt says "Filter Criteria: Keep symbol IF Z-Score > 2.0"
        // We should respect settings if possible, but the prompt gave specific constraints.
        // "Tagging: Medium > 2.0, High > 3.0"
        // Let's use the explicit prompt rules, but default to settings if higher? 
        // Let's stick to prompt "Z-Score > 2.0".

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
                    this.playPing();
                }
                document.title = `(${Store.getEvents().length}) Vol. Radar`;
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
