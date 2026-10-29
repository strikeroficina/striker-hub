import React from 'react';
import { motion } from 'motion/react';
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
  onNavigate?: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  indices,
  loading,
  onRefresh
}) => {
  const mappedIndices = indices ? {
    dolarInter: indices.dolarInter,
    dolarPizarra: `${indices.dolarCompra} / ${indices.dolarVenta}`,
    ui: indices.ui,
    ur: indices.ur,
    ura: indices.ura,
    lastUpdated: new Date().toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
  } : null;

  return (
    <div className="min-h-full flex-1 flex flex-col justify-between py-8 sm:py-12 px-4 sm:px-8 max-w-6xl mx-auto w-full">
      {/* Classical Monumental Brand Header in High-Tech Silver */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-2.5 pt-4"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#f8fafc] border border-[#cbd5e1] text-[10px] font-mono font-semibold text-[#1e3a8a] uppercase tracking-[0.22em] shadow-2xs mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1d4ed8] animate-pulse" />
          SISTEMA NOTARIAL DE PRECISIÓN • DGR 2025
        </div>
        <h1 className="text-4xl sm:text-5xl font-tabelion font-bold tracking-[0.26em] text-[#0f172a] uppercase drop-shadow-2xs">
          TABELION
        </h1>
        <p className="text-base sm:text-lg font-academic italic font-medium text-[#334155] tracking-wide">
          El espacio inteligente del escribano Uruguayo
        </p>
      </motion.header>

      {/* Center Stage: Luminous Silver-Platinum Indicators Panel */}
      <div className="my-auto py-8 w-full">
        <UruguayIndicesCard indices={mappedIndices} loading={loading} onRefresh={onRefresh} />
      </div>

      {/* High-Precision Footer */}
      <footer className="flex items-center justify-between pt-6 border-t border-[#cbd5e1] text-[10px] font-semibold text-[#475569] tracking-widest uppercase">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
          BCU • INE • MANUAL DGR 2025 ACTIVO
        </span>
        <span className="font-tabelion font-bold tracking-[0.2em] text-[#0f172a]">
          TABELION
        </span>
      </footer>
    </div>
  );
};
