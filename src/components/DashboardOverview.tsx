import React from 'react';
import { Users, FileSearch, TrendingUp, Clock, AlertTriangle, Bot } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { UruguayIndicesCard } from './UruguayIndicesCard';

interface DashboardOverviewProps {
  indices?: {
    dolarInter: string;
    dolarCompra: string;
    dolarVenta: string;
    ui: string;
    ur: string;
    ura: string;
  } | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ indices, loading, onRefresh }) => {
  const mappedIndices = indices ? {
    dolarInter: indices.dolarInter,
    dolarPizarra: `${indices.dolarCompra} / ${indices.dolarVenta}`,
    ui: indices.ui,
    ur: indices.ur,
    ura: indices.ura,
    lastUpdated: new Date().toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
  } : null;
  return (
    <div className="min-h-full flex-1 flex flex-col justify-start md:justify-center gap-6 py-6 sm:py-8 px-2 sm:px-8 max-w-7xl mx-auto w-full">
      <header className="space-y-1.5 text-center mb-2">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Striker HUB</h1>
        <p className="text-neutral-500 text-xs font-bold uppercase tracking-[0.25em]">
          Escribanía Digital • Control de Indicadores y Cotizaciones Uruguay 2026
        </p>
      </header>

      {/* Main Center Stage Unified Indicators Card */}
      <div className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full py-2">
        <UruguayIndicesCard indices={mappedIndices} loading={loading} onRefresh={onRefresh} />
        
        <div className="mt-8 text-center max-w-xl mx-auto">
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed uppercase tracking-wider">
            Consúltale a ELO AI para validar la vigencia de aranceles, cotización histórica de la Unidad Indexada (UI), informes de auditoría o liquidaciones impositivas en tiempo real.
          </p>
        </div>
      </div>

      <footer className="footer flex items-center justify-between pt-6 border-t border-neutral-900 mt-auto">
        <div className="text-[9px] font-bold text-neutral-600 flex gap-8 uppercase tracking-widest">
          <span className="flex items-center gap-2 italic">
            <div className="w-1 h-1 rounded-full bg-emerald-500"></div> System Status: Green
          </span>
          <span>BCU Feed: Active</span>
          <span>Notarial V2026.1</span>
        </div>
        <div className="text-[9px] text-neutral-700 font-black uppercase tracking-tight">
          Powered by Striker Hub
        </div>
      </footer>
    </div>
  );
};

// Simplified placeholders for other sections to be implemented if needed or just left as headers for now
export const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-full space-y-4">
    <div className="p-8 bg-brand-card border border-brand-border rounded-full animate-bounce">
      <Bot size={64} className="text-brand-primary" />
    </div>
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-slate-400 max-w-sm text-center">Este módulo está siendo optimizado para el MVP. Puedes consultar a ELO en la pestaña de chat para estas funciones.</p>
  </div>
);
