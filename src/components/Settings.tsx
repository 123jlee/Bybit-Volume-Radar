import React, { useState } from 'react';
import { Store } from '../services/store';
import { DEFAULT_SETTINGS } from '../types';
import type { AppSettings } from '../types';
import { Save, RotateCcw } from 'lucide-react';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings>(Store.getSettings());
    const [flashed, setFlashed] = useState(false);

    const handleChange = (field: keyof AppSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        Store.saveSettings(settings);
        setFlashed(true);
        setTimeout(() => setFlashed(false), 2000);
        // Reload page to apply new Universe settings if needed? 
        // Usually fetching Universe happens on load or we can trigger it. 
        // Simply saving is enough, Scanner will pick up changes on next loop or user reload.
        // For "Refresh" effect on Universe, a manual reload is best.
    };

    const handleReset = () => {
        setSettings(DEFAULT_SETTINGS);
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-mono text-white mb-6 border-b border-white/10 pb-4">Configuration</h2>

            <div className="bg-surface p-6 rounded-lg border border-white/5 space-y-6">

                {/* API Endpoint */}
                <div>
                    <label className="block text-xs font-mono text-gray-400 uppercase mb-2">API Endpoint</label>
                    <input
                        type="text"
                        className="w-full bg-[#121418] border border-white/10 rounded px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                        value={settings.apiEndpoint}
                        onChange={(e) => handleChange('apiEndpoint', e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: /bybit_api (mapped via Nginx)</p>
                </div>

                {/* Universe Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-mono text-gray-400 uppercase mb-2">Max Symbols</label>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            className="w-full bg-[#121418] border border-white/10 rounded px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                            value={settings.symbolCount}
                            onChange={(e) => handleChange('symbolCount', parseInt(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-gray-400 uppercase mb-2">Sort By</label>
                        <select
                            className="w-full bg-[#121418] border border-white/10 rounded px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                            value={settings.sortCriteria}
                            onChange={(e) => handleChange('sortCriteria', e.target.value)}
                        >
                            <option value="volume">24h Volume</option>
                            <option value="openInterest">Open Interest</option>
                        </select>
                    </div>
                </div>

                {/* Thresholds */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-mono text-gray-400 uppercase mb-2">Min Vol Ratio</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full bg-[#121418] border border-white/10 rounded px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                            value={settings.minVolumeRatio}
                            onChange={(e) => handleChange('minVolumeRatio', parseFloat(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-mono text-gray-400 uppercase mb-2">Min Z-Score</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full bg-[#121418] border border-white/10 rounded px-3 py-2 text-white font-mono focus:border-blue-500 outline-none"
                            value={settings.minZScore}
                            onChange={(e) => handleChange('minZScore', parseFloat(e.target.value))}
                        />
                    </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="sound"
                        className="w-4 h-4 bg-[#121418] border-white/10 rounded"
                        checked={settings.soundEnabled}
                        onChange={(e) => handleChange('soundEnabled', e.target.checked)}
                    />
                    <label htmlFor="sound" className="text-sm text-gray-300">Enable Sound Alerts</label>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                    <button
                        onClick={handleSave}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded font-medium flex justify-center items-center gap-2 transition-colors"
                    >
                        <Save size={18} /> {flashed ? 'Saved!' : 'Save Settings'}
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex-none bg-[#121418] hover:bg-gray-800 text-gray-400 py-2 px-4 rounded transition-colors"
                    >
                        <RotateCcw size={18} />
                    </button>
                </div>
            </div>

            {/* Helper Text for VPS */}
            <div className="mt-8 p-4 bg-gray-900 rounded border border-white/5 text-xs text-mono text-gray-500">
                <h3 className="text-gray-400 font-bold mb-2">VPS Nginx Setup</h3>
                <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed select-all">
                    {`location /bybit_api/ {
    proxy_pass https://api.bybit.com/;
    proxy_ssl_server_name on;
    add_header 'Access-Control-Allow-Origin' '*';
}`}
                </pre>
            </div>
        </div>
    );
};
