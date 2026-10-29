import React from 'react';
import { Home, Users, FileSearch, Calculator, MessageSquare, Settings, LogOut, Lock, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotaryProfile, formatNotaryDisplayTitle } from '../lib/notaryProfile';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSignOut: () => void;
  user: any;
  notaryProfile?: NotaryProfile;
  onLockNow?: () => void;
  onInstallClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onSignOut,
  user,
  notaryProfile,
  onLockNow,
  onInstallClick
}) => {
  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Hub' },
    { id: 'clients', icon: Users, label: 'Agenda' },
    { id: 'audit', icon: FileSearch, label: 'Auditoría' },
    { id: 'calculator', icon: Calculator, label: 'Cálculos' },
    { id: 'chat', icon: MessageSquare, label: 'ELO AI' },
    { id: 'settings', icon: Settings, label: 'Escribano' },
  ];

  const displayName = notaryProfile
    ? formatNotaryDisplayTitle(notaryProfile)
    : (user?.displayName || 'Esc. Titular');

  const officeLabel = notaryProfile?.officeName || 'Estudio Notarial';
  const locationLabel = notaryProfile?.city
    ? `${notaryProfile.city}, ${notaryProfile.department || 'UY'}`
    : 'Uruguay';

  return (
    <>
      {/* DESKTOP SIDEBAR (PC) */}
      <aside className="hidden md:flex w-20 lg:w-64 h-full bg-[#0c0c0e] border-r border-neutral-800 flex-col items-center lg:items-stretch transition-all duration-300 no-print shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-neutral-900">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-blue-600/20 shrink-0">
            S
          </div>
          <div className="hidden lg:block overflow-hidden">
            <h1 className="text-sm font-black leading-none text-white uppercase tracking-tighter truncate">
              Striker Hub
            </h1>
            <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest mt-1 truncate">
              {officeLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2 flex flex-col items-center lg:items-stretch overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all group cursor-pointer",
                activeTab === item.id
                  ? "bg-neutral-800 text-white border border-neutral-700 shadow-xl"
                  : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/50"
              )}
              title={item.label}
            >
              <item.icon size={18} className={cn(activeTab === item.id ? "text-blue-500" : "group-hover:text-neutral-200")} />
              <span className="hidden lg:block">{item.label}</span>
            </button>
          ))}

          {onInstallClick && (
            <button
              onClick={onInstallClick}
              className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-2.5 mt-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 hover:bg-emerald-950/40 transition-all cursor-pointer"
              title="Instalar App en PC o Celular"
            >
              <Download size={16} />
              <span className="hidden lg:block">Instalar App</span>
            </button>
          )}
        </nav>

        <div className="p-3 border-t border-neutral-800 space-y-2">
          <div
            onClick={() => setActiveTab('settings')}
            className="hidden lg:flex items-center gap-3 px-2.5 py-2.5 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 cursor-pointer transition-all"
            title="Editar datos personales del escribano"
          >
            <img
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(notaryProfile?.fullName || 'Escribano')}&background=2563eb&color=fff&bold=true`}
              alt="Profile"
              className="w-8 h-8 rounded-lg border border-neutral-700 shrink-0"
            />
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-black text-white truncate">{displayName}</p>
              <p className="text-[9px] text-neutral-500 truncate uppercase font-bold tracking-tight">
                {locationLabel}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {notaryProfile?.pinEnabled && notaryProfile?.securityPin && onLockNow && (
              <button
                onClick={onLockNow}
                className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/15 hover:bg-amber-950/30 border border-amber-900/30 transition-all cursor-pointer"
                title="Bloquear pantalla con PIN"
              >
                <Lock size={14} />
                <span className="hidden lg:inline">Bloquear</span>
              </button>
            )}
            <button
              onClick={onSignOut}
              className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-red-400 hover:bg-red-950/15 transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR (CELULAR) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e]/95 backdrop-blur-md border-t border-neutral-800 px-1 py-1.5 flex items-center justify-around no-print">
        {menuItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all",
                active ? "text-blue-400 bg-blue-600/10" : "text-neutral-500"
              )}
            >
              <item.icon size={18} />
              <span className="text-[8px] font-black uppercase tracking-wider mt-1">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
