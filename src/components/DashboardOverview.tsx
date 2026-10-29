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
      {/* Minimalist Academic Header */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-2 pt-4"
      >
        <h1 className="text-4xl sm:text-5xl font-tabelion font-semibold tracking-[0.24em] text-[#f2efe9] uppercase">
          TABELION
        </h1>
        <p className="text-base sm:text-lg font-academic italic text-[#c5a880] tracking-wide">
          El espacio inteligente del escribano Uruguayo
        </p>
      </motion.header>

      {/* Center Stage: Serene Indicators Panel */}
      <div className="my-auto py-8 w-full">
        <UruguayIndicesCard indices={mappedIndices} loading={loading} onRefresh={onRefresh} />
      </div>

      {/* Whisper-quiet Footer */}
      <footer className="flex items-center justify-between pt-6 border-t border-[#22201c] text-[10px] text-[#6e695f] tracking-widest uppercase">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7a917c]"></span>
          BCU • INE • DGR
        </span>
        <span className="font-tabelion tracking-[0.2em] text-[#857f74]">
          TABELION
        </span>
      </footer>
    </div>
  );
};
