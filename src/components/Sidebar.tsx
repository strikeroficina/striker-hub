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
      {/* DESKTOP SIDEBAR (PC) */}
      <aside className="hidden md:flex w-20 lg:w-60 h-full bg-[#151412] border-r border-[#24221e] flex-col items-center lg:items-stretch transition-all duration-300 no-print shrink-0">
        <div className="p-6 flex items-center gap-3.5 border-b border-[#22201c]">
          <div className="w-9 h-9 bg-[#1c1b18] border border-[#36332e] rounded-lg flex items-center justify-center font-tabelion font-semibold text-base text-[#d4bc98] shrink-0">
            T
          </div>
          <div className="hidden lg:block overflow-hidden">
            <h1 className="text-sm font-tabelion font-semibold leading-none text-[#f2efe9] uppercase tracking-[0.2em] truncate">
              TABELION
            </h1>
            <p className="text-[11px] font-academic italic text-[#857f74] mt-1 truncate">
              {officeLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1.5 flex flex-col items-center lg:items-stretch overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center justify-center lg:justify-start gap-3.5 p-3 lg:px-4 lg:py-2.5 rounded-xl text-xs font-medium tracking-wider transition-all group cursor-pointer",
                activeTab === item.id
                  ? "bg-[#201f1c] text-[#f2efe9] border border-[#33302a]"
                  : "text-[#857f74] hover:text-[#e4dfd5] hover:bg-[#1a1916]"
              )}
              title={item.label}
            >
              <item.icon
                size={17}
                className={cn(
                  activeTab === item.id ? "text-[#c5a880]" : "text-[#7d786f] group-hover:text-[#cfc9be]"
                )}
              />
              <span className="hidden lg:block">{item.label}</span>
            </button>
          ))}

          {onInstallClick && (
            <button
              onClick={onInstallClick}
              className="w-full flex items-center justify-center lg:justify-start gap-3 p-3 lg:px-4 lg:py-2.5 mt-4 rounded-xl text-[11px] font-medium tracking-wider text-[#cfc9be] bg-[#1a1916] border border-[#292723] hover:border-[#3d3932] transition-all cursor-pointer"
              title="Instalar aplicación en PC o Celular"
            >
              <Download size={15} className="text-[#c5a880]" />
              <span className="hidden lg:block">Instalar App</span>
            </button>
          )}
        </nav>

        <div className="p-3 border-t border-[#22201c] space-y-2">
          <div
            onClick={() => setActiveTab('settings')}
            className="hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#1a1916] hover:bg-[#201f1c] border border-[#262420] cursor-pointer transition-all"
            title="Configuración del escribano"
          >
            <div className="w-8 h-8 rounded-lg bg-[#24221e] border border-[#36332e] flex items-center justify-center font-tabelion text-xs text-[#d4bc98] shrink-0">
              {(notaryProfile?.fullName || 'E').trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium text-[#ece8df] truncate">{displayName}</p>
              <p className="text-[10px] text-[#7d786f] truncate">
                {locationLabel}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {notaryProfile?.pinEnabled && notaryProfile?.securityPin && onLockNow && (
              <button
                onClick={onLockNow}
                className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-medium tracking-wider text-[#c5a880] bg-[#1c1b18] hover:bg-[#24221e] border border-[#2c2a25] transition-all cursor-pointer"
                title="Bloquear pantalla con PIN"
              >
                <Lock size={13} />
                <span className="hidden lg:inline">Bloquear</span>
              </button>
            )}
            <button
              onClick={onSignOut}
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-[10px] font-medium tracking-wider text-[#7d786f] hover:text-[#e4dfd5] hover:bg-[#1c1b18] transition-all cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={13} />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR (CELULAR) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#151412]/95 backdrop-blur-md border-t border-[#24221e] px-1 py-1.5 flex items-center justify-around no-print">
        {menuItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all",
                active ? "text-[#d4bc98] bg-[#201f1c]" : "text-[#7d786f]"
              )}
            >
              <item.icon size={17} />
              <span className="text-[9px] font-medium tracking-wide mt-1">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
