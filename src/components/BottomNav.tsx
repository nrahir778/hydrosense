import React from 'react';
import { Gauge, Sliders, Cpu, ShieldAlert, Wrench, Sparkles } from 'lucide-react';
import { ActiveTab } from './Header';
import { triggerHaptic } from '../utils/androidOptimizations';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  emergencyStop: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  emergencyStop,
}) => {
  const tabs = [
    { id: 'dashboard' as ActiveTab, label: 'ડેશબોર્ડ', icon: Gauge },
    { id: 'ai' as ActiveTab, label: 'AI વોઇસ', icon: Sparkles },
    { id: 'manual' as ActiveTab, label: 'મેન્યુઅલ', icon: Sliders },
    { id: 'automation' as ActiveTab, label: 'ઓટો', icon: Cpu },
    { id: 'safety' as ActiveTab, label: 'સુરક્ષા', icon: ShieldAlert, badge: emergencyStop },
    { id: 'hardware' as ActiveTab, label: 'વાયરિંગ', icon: Wrench },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 px-1 select-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.35rem)' }}
    >
      <div className="grid grid-cols-6 h-14 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic('tap');
                onSelectTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[36px] relative py-1 transition-colors cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-sky-600 dark:text-sky-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap font-medium">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
