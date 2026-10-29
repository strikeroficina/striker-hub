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
    { id: 'dashboard', icon: Home, label: 'Inicio' },
    { id: 'clients', icon: Users, label: 'Agenda' },
    { id: 'audit', icon: FileSearch, label: 'Auditoría' },
    { id: 'calculator', icon: Calculator, label: 'Cálculos' },
    { id: 'chat', icon: MessageSquare, label: 'Tabelion' },
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
      {/* DESKTOP SIDEBAR (PC) — Gris Plata Metálico */}
      <aside className="hidden md:flex w-20 lg:w-64 h-full bg-[#dde4ee]/90 backdrop-blur-xl border-r border-[#c5d0de] flex-col items-center lg:items-stretch transition-all duration-300 no-print shrink-0 shadow-[4px_0_24px_-12px_rgba(15,23,42,0.08)]">
        <div className="p-6 flex items-center gap-3.5 border-b border-[#c8d3e1]">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] border border-[#3b82f6]/30 rounded-xl flex items-center justify-center font-tabelion font-bold text-base text-[#f8fafc] shrink-0 shadow-md">
            T
          </div>
          <div className="hidden lg:block overflow-hidden">
            <h1 className="text-base font-tabelion font-bold leading-none text-[#0f172a] uppercase tracking-[0.2em] truncate">
              TABELION
            </h1>
            <p className="text-[11px] font-medium text-[#475569] mt-1 truncate">
              {officeLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3.5 py-6 space-y-1.5 flex flex-col items-center lg:items-stretch overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center justify-center lg:justify-start gap-3.5 p-3 lg:px-4 lg:py-3 rounded-xl text-xs font-semibold tracking-wider transition-all group cursor-pointer",
                  isActive
                    ? "bg-[#ffffff] text-[#0f172a] border border-[#b8c4d4] shadow-sm"
                    : "text-[#475569] hover:text-[#0f172a] hover:bg-[#e8eef6]"
                )}
                title={item.label}
              >
                <item.icon
                  size={17}
                  className={cn(
                    isActive ? "text-[#1d4ed8]" : "text-[#64748b] group-hover:text-[#1e293b]"
                  )}
                />
                <span className="hidden lg:block">{item.label}</span>
                {isActive && (
                  <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-[#1d4ed8]" />
                )}
              </button>
            );
          })}

          {onInstallClick && (
            <button
              onClick={onInstallClick}
              className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-2.5 mt-4 rounded-xl text-[11px] font-semibold tracking-wider text-[#1e293b] bg-[#e8eef6] border border-[#c5d0de] hover:bg-[#ffffff] hover:border-[#94a3b8] transition-all cursor-pointer shadow-2xs"
              title="Instalar aplicación en PC o Celular"
            >
              <Download size={15} className="text-[#1d4ed8]" />
              <span className="hidden lg:block">Instalar App</span>
            </button>
          )}
        </nav>

        <div className="p-3.5 border-t border-[#c8d3e1] space-y-2 bg-[#d6dfeb]/50">
          <div
            onClick={() => setActiveTab('settings')}
            className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f4f7fb] hover:bg-[#ffffff] border border-[#c5d0de] cursor-pointer transition-all shadow-2xs"
            title="Configuración del escribano"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0f172a] text-[#ffffff] flex items-center justify-center font-tabelion font-bold text-xs shrink-0">
              {(notaryProfile?.fullName || 'E').trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-[#0f172a] truncate">{displayName}</p>
              <p className="text-[10px] font-medium text-[#475569] truncate">
                {locationLabel}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {notaryProfile?.pinEnabled && notaryProfile?.securityPin && onLockNow && (
              <button
                onClick={onLockNow}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-semibold tracking-wider text-[#1e3a8a] bg-[#e8eef6] hover:bg-[#ffffff] border border-[#c5d0de] transition-all cursor-pointer"
                title="Bloquear pantalla con PIN"
              >
                <Lock size={13} />
                <span className="hidden lg:inline">Bloquear</span>
              </button>
            )}
            <button
              onClick={onSignOut}
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-semibold tracking-wider text-[#475569] hover:text-[#0f172a] hover:bg-[#e8eef6] transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={13} />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR (CELULAR) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#eef2f7]/95 backdrop-blur-xl border-t border-[#c5d0de] px-1 py-1.5 flex items-center justify-around no-print shadow-lg">
        {menuItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all",
                active ? "text-[#1d4ed8] bg-[#ffffff] shadow-xs border border-[#cbd5e1]" : "text-[#475569]"
              )}
            >
              <item.icon size={17} />
              <span className="text-[9px] font-semibold tracking-wide mt-1">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
