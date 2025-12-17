import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { Universe } from './components/Universe';
import { TickerDetail } from './components/TickerDetail';
import { Scanner } from './services/scanner';
import { LayoutDashboard, Globe, Settings as SettingsIcon, Radio } from 'lucide-react';

type View = 'dashboard' | 'universe' | 'settings' | 'ticker';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTicker, setSelectedTicker] = useState<string>('');

  useEffect(() => {
    // Start Scanner on Mount
    Scanner.start();
    return () => {
      Scanner.stop();
    };
  }, []);

  const navigateToTicker = (symbol: string) => {
    setSelectedTicker(symbol);
    setCurrentView('ticker');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard onSelectTicker={navigateToTicker} />;
      case 'universe': return <Universe />;
      case 'settings': return <Settings />;
      case 'ticker': return <TickerDetail symbol={selectedTicker} onBack={() => setCurrentView('dashboard')} />;
      default: return <Dashboard onSelectTicker={navigateToTicker} />;
    }
  };

  return (
    <div className="flex h-screen bg-background text-gray-200 font-sans selection:bg-blue-500/30">
      {/* Sidebar Navigation */}
      <nav className="w-16 md:w-20 bg-[#0a0c10] border-r border-white/5 flex flex-col items-center py-6 gap-8 z-50">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
          <Radio className="text-white w-6 h-6" />
        </div>

        <div className="flex flex-col gap-6 w-full px-2">
          <NavIcon
            active={currentView === 'dashboard'}
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Dash"
          />
          <NavIcon
            active={currentView === 'universe'}
            onClick={() => setCurrentView('universe')}
            icon={<Globe size={20} />}
            label="Univ"
          />
          <NavIcon
            active={currentView === 'settings'}
            onClick={() => setCurrentView('settings')}
            icon={<SettingsIcon size={20} />}
            label="Conf"
          />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        {renderView()}
      </main>
    </div>
  );
}

const NavIcon = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`group flex flex-col items-center gap-1 w-full p-2 rounded-lg transition-all duration-200 ${active ? 'bg-white/10 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
  >
    {icon}
    <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
  </button>
);

export default App;
