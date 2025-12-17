import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings, SymbolData, VolumeEvent, ReportState } from '../types';

type Listener = () => void;

class StoreService {
    private settings: AppSettings;
    private symbols: Map<string, SymbolData>;
    private events: VolumeEvent[];
    private listeners: Set<Listener>;
    private lastUpdate: number;

    constructor() {
        this.settings = this.loadSettings();
        this.symbols = new Map();
        this.events = [];
        this.listeners = new Set();
        this.lastUpdate = Date.now();
    }

    private loadSettings(): AppSettings {
        const saved = localStorage.getItem('bvr_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure new fields are present
                return { ...DEFAULT_SETTINGS, ...parsed };
            } catch (e) {
                console.error('Failed to parse settings', e);
            }
        }
        return DEFAULT_SETTINGS;
    }

    public saveSettings(newSettings: Partial<AppSettings>) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('bvr_settings', JSON.stringify(this.settings));
        this.notify();
    }

    public getSettings(): AppSettings {
        return this.settings;
    }

    // Symbol Management
    public updateSymbol(data: SymbolData) {
        this.symbols.set(data.symbol, data);
        // Debounce notify if needed, but for now simple notify is fine
    }

    public updateSymbols(data: SymbolData[]) {
        data.forEach(s => this.symbols.set(s.symbol, s));
        this.lastUpdate = Date.now();
        this.notify();
    }

    public getSymbols(): SymbolData[] {
        return Array.from(this.symbols.values());
    }

    public getSymbol(symbol: string): SymbolData | undefined {
        return this.symbols.get(symbol);
    }

    // Event Management
    public addEvent(event: VolumeEvent) {
        // Avoid duplicates if needed, or just push
        // We put newest first
        this.events.unshift(event);
        // Keep max events to avoid memory leak
        if (this.events.length > 500) {
            this.events = this.events.slice(0, 500);
        }
        this.notify();
    }

    public getEvents(): VolumeEvent[] {
        return this.events;
    }

    public getLastUpdate(): number {
        return this.lastUpdate;
    }

    // Observer Pattern
    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    // Report Persistence
    public getReportState(): ReportState | null {
        try {
            const saved = localStorage.getItem('bvr_report_state');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }

    public saveReportState(state: ReportState) {
        localStorage.setItem('bvr_report_state', JSON.stringify(state));
    }
}

export const Store = new StoreService();
