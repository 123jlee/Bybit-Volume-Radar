import { BybitService } from './bybit';
import { Store } from './store';
import type { OHLCV, Timeframe, VolumeEvent, ReportConfig } from '../types';

export class HistoricalReporter {

    public static async generateReport(config: ReportConfig, onProgress: (progress: string) => void): Promise<VolumeEvent[]> {
        const settings = Store.getSettings();
        const results: VolumeEvent[] = [];

        // Flatten tasks: each symbol + timeframe combo is a task
        const tasks: { symbol: string, timeframe: Timeframe }[] = [];
        for (const symbol of config.symbols) {
            for (const tf of config.timeframes) {
                tasks.push({ symbol, timeframe: tf });
            }
        }

        const totalTasks = tasks.length;
        // Batch size for concurrent requests
        const BATCH_SIZE = 10;

        for (let i = 0; i < totalTasks; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            // Progress: "Processing... (10/150)"
            const doneCount = Math.min(i + BATCH_SIZE, totalTasks);
            onProgress(`Processing... (${doneCount}/${totalTasks})`);

            await Promise.all(batch.map(async (task) => {
                try {
                    const candles = await BybitService.fetchCandles(task.symbol, task.timeframe, config.lookback, settings.apiEndpoint);
                    const anomalies = this.scanHistory(task.symbol, task.timeframe, candles, config.minZScore);
                    results.push(...anomalies);
                } catch (e) {
                    console.error(`Failed to report on ${task.symbol} ${task.timeframe}`, e);
                }
            }));

            // Rate limit safety
            await new Promise(r => setTimeout(r, 200));
        }

        // Sort by Time Descending (Newest First)
        return results.sort((a, b) => b.time - a.time);
    }

    private static scanHistory(symbol: string, timeframe: Timeframe, candles: OHLCV[], minZScore: number): VolumeEvent[] {
        const events: VolumeEvent[] = [];
        const PERIOD = 21;

        // Need enough data
        if (candles.length < PERIOD + 10) return [];

        // Rolling Window
        // Start from index 21 so we have a full history window for the first calc
        for (let i = PERIOD; i < candles.length; i++) {
            const current = candles[i];

            // Window is [i-PERIOD ... i-1] (Previous 21 candles)
            const window = candles.slice(i - PERIOD, i);

            const stats = this.calculateStats(window);
            if (!stats || stats.stdDev === 0) continue;

            const zScore = (current.volume - stats.ema) / stats.stdDev;

            if (zScore >= minZScore) {
                const severity: VolumeEvent['severity'] = zScore > 3.0 ? 'high' : 'medium';
                const isGreen = current.close >= current.open;
                const type: VolumeEvent['type'] = isGreen ? 'bullish' : 'bearish';

                events.push({
                    id: `${symbol}-${timeframe}-${current.time}`,
                    symbol,
                    timeframe,
                    time: current.time,
                    type,
                    severity,
                    zScore: parseFloat(zScore.toFixed(2)),
                    openPrice: current.open,
                    closePrice: current.close
                });
            }
        }

        return events;
    }

    private static calculateStats(window: OHLCV[]): { ema: number, stdDev: number } | null {
        const volumes = window.map(c => c.volume);
        if (volumes.length === 0) return null;

        // EMA Logic (Same as Scanner)
        const calculateEMA = (values: number[]) => {
            const k = 2 / (values.length + 1);
            let ema = values[0];
            for (let i = 1; i < values.length; i++) {
                ema = values[i] * k + ema * (1 - k);
            }
            return ema;
        };

        const calculateStdDev = (values: number[], mean: number) => {
            const squareDiffs = values.map(v => Math.pow(v - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
            return Math.sqrt(avgSquareDiff);
        };

        const ema = calculateEMA(volumes);
        const stdDev = calculateStdDev(volumes, ema);

        return { ema, stdDev };
    }
}
