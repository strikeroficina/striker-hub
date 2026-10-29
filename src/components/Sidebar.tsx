import React from 'react';
import { Home, Users, FileSearch, Calculator, MessageSquare, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
  user: any;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onSignOut, user }) => {
  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Hub' },
    { id: 'clients', icon: Users, label: 'Agenda' },
    { id: 'audit', icon: FileSearch, label: 'Auditoría' },
    { id: 'calculator', icon: Calculator, label: 'Cálculos' },
    { id: 'chat', icon: MessageSquare, label: 'ELO AI' },
  ];

  return (
    <aside className="w-20 lg:w-64 h-full bg-[#0c0c0e] border-r border-neutral-800 flex flex-col items-center lg:items-stretch transition-all duration-300 no-print">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20">
          S
        </div>
        <div className="hidden lg:block">
          <h1 className="text-sm font-bold leading-none text-white uppercase tracking-tighter">Striker Hub</h1>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">V1.0 MVP</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-6 lg:space-y-2 flex flex-col items-center lg:items-stretch">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3 rounded-xl text-sm font-bold transition-all group",
              activeTab === item.id
                ? "bg-neutral-800 text-white border border-neutral-700 shadow-xl"
                : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/50"
            )}
            title={item.label}
          >
            <item.icon size={20} className={cn(activeTab === item.id ? "text-blue-500" : "group-hover:text-neutral-200")} />
            <span className="hidden lg:block">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <div className="flex items-center gap-3 px-2 py-3 mb-4 hidden lg:flex">
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'User'}&background=2563eb&color=fff`}
            alt="Profile"
            className="w-8 h-8 rounded-lg border border-neutral-700"
          />
          <div className="flex-1 overflow-hidden">
            <p className="text-[11px] font-bold text-white truncate">{user?.displayName}</p>
            <p className="text-[9px] text-neutral-600 truncate uppercase font-bold tracking-tight">Escritano Activo</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3 rounded-xl text-xs font-bold text-neutral-600 hover:text-red-400 hover:bg-red-950/10 transition-all"
        >
          <LogOut size={16} />
          <span className="hidden lg:block">SALIR</span>
        </button>
      </div>
    </aside>
  );
};
