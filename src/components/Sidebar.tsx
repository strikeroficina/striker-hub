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
    { id: 'dashboard', icon: Home, label: 'Tabelion' },
    { id: 'clients', icon: Users, label: 'Agenda' },
    { id: 'audit', icon: FileSearch, label: 'Auditoría DGR' },
    { id: 'calculator', icon: Calculator, label: 'Cálculos' },
    { id: 'chat', icon: MessageSquare, label: 'ELO AI' },
    { id: 'settings', icon: Settings, label: 'Escribano' },
  ];

  const displayName = notaryProfile
    ? formatNotaryDisplayTitle(notaryProfile)
    : (user?.displayName || 'Esc. Titular');

  const officeLabel = notaryProfile?.officeName || 'El espacio inteligente del escribano';
  const locationLabel = notaryProfile?.city
    ? `${notaryProfile.city}, ${notaryProfile.department || 'UY'}`
    : 'Uruguay';

  return (
    <>
      {/* DESKTOP SIDEBAR (PC) */}
      <aside className="hidden md:flex w-20 lg:w-64 h-full bg-[#0a0a0d] border-r border-neutral-800/80 flex-col items-center lg:items-stretch transition-all duration-300 no-print shrink-0 relative">
        <div className="p-5 flex items-center gap-3.5 border-b border-neutral-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
          <div className="w-10 h-10 bg-neutral-950 border border-amber-500/35 rounded-xl flex items-center justify-center font-tabelion font-black text-lg tabelion-gold-text shadow-lg shadow-amber-500/10 shrink-0">
            T
          </div>
          <div className="hidden lg:block overflow-hidden">
            <h1 className="text-base font-tabelion font-black leading-none text-white uppercase tracking-[0.18em] truncate">
              TABELION
            </h1>
            <p className="text-[8px] text-amber-400/90 font-bold uppercase tracking-[0.16em] mt-1.5 truncate">
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
                  ? "bg-neutral-900 text-white border border-amber-500/30 shadow-xl shadow-black/40"
                  : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/50"
              )}
              title={item.label}
            >
              <item.icon
                size={18}
                className={cn(
                  activeTab === item.id ? "text-amber-400" : "group-hover:text-neutral-200"
                )}
              />
              <span className="hidden lg:block">{item.label}</span>
            </button>
          ))}

          {onInstallClick && (
            <button
              onClick={onInstallClick}
              className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-2.5 mt-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 hover:bg-emerald-950/40 transition-all cursor-pointer"
              title="Instalar App Tabelion en PC o Celular"
            >
              <Download size={16} />
              <span className="hidden lg:block">Instalar App</span>
            </button>
          )}
        </nav>

        <div className="p-3 border-t border-neutral-800/80 space-y-2">
          <div
            onClick={() => setActiveTab('settings')}
            className="hidden lg:flex items-center gap-3 px-2.5 py-2.5 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 hover:border-amber-500/30 cursor-pointer transition-all"
            title="Editar datos personales del escribano"
          >
            <img
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(notaryProfile?.fullName || 'Tabelion')}&background=18181b&color=d4af37&bold=true`}
              alt="Profile"
              className="w-8 h-8 rounded-lg border border-amber-500/30 shrink-0"
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0d]/95 backdrop-blur-md border-t border-neutral-800 px-1 py-1.5 flex items-center justify-around no-print">
        {menuItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all",
                active ? "text-amber-400 bg-amber-500/10" : "text-neutral-500"
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
