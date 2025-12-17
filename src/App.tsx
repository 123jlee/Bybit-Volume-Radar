import React, { useState } from 'react';
import { Activity, Settings as SettingsIcon, Globe, BarChart2 } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { TickerDetail } from './components/TickerDetail';
import { Settings } from './components/Settings';
import { Universe } from './components/Universe';
import { Reports } from './components/Reports';

type View = 'dashboard' | 'ticker' | 'settings' | 'universe' | 'reports';

import { ScannerProvider } from './contexts/ScannerContext';

const AppContent: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const handleSelectTicker = (symbol: string) => {
    setSelectedTicker(symbol);
    setView('ticker');
  };

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard onSelectTicker={handleSelectTicker} />;
      case 'ticker': return selectedTicker ? <TickerDetail symbol={selectedTicker} onBack={() => setView('dashboard')} /> : <Dashboard onSelectTicker={handleSelectTicker} />;
      case 'settings': return <Settings />;
      case 'universe': return <Universe />;
      case 'reports': return <Reports />;
      default: return <Dashboard onSelectTicker={handleSelectTicker} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-text-primary font-sans antialiased selection:bg-blue-500/30">
      {/* Sidebar */}
      <div className="w-16 md:w-20 bg-surface border-r border-white/5 flex flex-col items-center py-6 gap-6 z-50">
        <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-white font-bold mb-4 shadow-lg shadow-blue-500/20">
          VR
        </div>

        <button
          onClick={() => setView('dashboard')}
          className={`p-3 rounded-lg transition-all ${view === 'dashboard' || view === 'ticker' ? 'bg-white/10 text-blue-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          title="Dashboard"
        >
          <Activity size={24} />
        </button>

        <button
          onClick={() => setView('universe')}
          className={`p-3 rounded-lg transition-all ${view === 'universe' ? 'bg-white/10 text-blue-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          title="Universe"
        >
          <Globe size={24} />
        </button>

        <button
          onClick={() => setView('reports')}
          className={`p-3 rounded-lg transition-all ${view === 'reports' ? 'bg-white/10 text-blue-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          title="Backtesting Reports"
        >
          <BarChart2 size={24} />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setView('settings')}
          className={`p-3 rounded-lg transition-all ${view === 'settings' ? 'bg-white/10 text-blue-400' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
          title="Settings"
        >
          <SettingsIcon size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto h-screen relative scrollbar-hide">
        {renderView()}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ScannerProvider>
      <AppContent />
    </ScannerProvider>
  );
};

export default App;
