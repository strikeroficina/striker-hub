import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export interface UruguayIndices {
  dolarInter: string;
  dolarPizarra: string;
  ui: string;
  ur: string;
  ura: string;
  lastUpdated: string;
}

interface UruguayIndicesCardProps {
  indices?: UruguayIndices | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const UruguayIndicesCard: React.FC<UruguayIndicesCardProps> = ({
  indices: propIndices,
  loading: propLoading,
  onRefresh
}) => {
  const [indices, setIndices] = useState<UruguayIndices | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propLoading !== undefined) {
      setLoading(propLoading);
    }
  }, [propLoading]);

  useEffect(() => {
    if (propIndices) {
      setIndices(propIndices);
      if (propLoading === undefined) {
        setLoading(false);
      }
    }
  }, [propIndices, propLoading]);

  const handleManualRefresh = () => {
    if (onRefresh) {
      onRefresh();
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setIndices({
        dolarInter: '$40,14',
        dolarPizarra: '$38,90 / $41,40',
        ui: '$6,6803',
        ur: '$1.946,95',
        ura: '$1.939,40',
        lastUpdated: new Date().toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })
      });
      setLoading(false);
    }, 600);
  };

  return (
    <div className="w-full bg-[#f5f7fb]/95 backdrop-blur-md rounded-2xl border border-[#cbd5e1] p-6 sm:p-8 transition-all duration-300 shadow-[0_12px_36px_-12px_rgba(15,23,42,0.08)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-[#d5deeb]">
        <div>
          <h2 className="text-xs font-bold text-[#0f172a] uppercase tracking-[0.18em]">
            Indicadores y Cotizaciones Oficiales
          </h2>
          <p className="text-xs font-medium text-[#475569] mt-0.5">
            Banco Central del Uruguay & Instituto Nacional de Estadística
          </p>
        </div>

        <div className="flex items-center gap-4">
          {!loading && indices && (
            <span className="text-[11px] font-medium text-[#475569]">
              {indices.lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#ffffff] hover:bg-[#eef2f8] border border-[#cbd5e1] rounded-xl text-[10px] font-bold text-[#0f172a] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin text-[#1d4ed8]' : 'text-[#1d4ed8]'} />
            {loading ? 'Sincronizando' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="bg-[#eaeff7] border border-[#cbd5e1] rounded-xl p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {/* Dólar Interbancario */}
          <div className="bg-[#ffffff] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-all shadow-2xs">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Dólar Interbancario
            </span>
            <div className="text-2xl font-mono font-bold text-[#0f172a] my-2">
              {indices?.dolarInter}
            </div>
            <span className="text-[10px] font-medium text-[#64748b]">
              Promedio BCU
            </span>
          </div>

          {/* Dólar Pizarra */}
          <div className="bg-[#ffffff] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-all shadow-2xs">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Dólar Pizarra
            </span>
            {(() => {
              const parts = indices?.dolarPizarra ? indices.dolarPizarra.split('/') : [];
              const comp = parts[0]?.trim() || '$38,90';
              const vent = parts[1]?.trim() || '$41,40';
              return (
                <div className="space-y-1 my-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-[10px] font-medium text-[#64748b]">Compra</span>
                    <span className="font-mono font-semibold text-[#0f172a]">{comp}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-[10px] font-medium text-[#64748b]">Venta</span>
                    <span className="font-mono font-semibold text-[#0f172a]">{vent}</span>
                  </div>
                </div>
              );
            })()}
            <span className="text-[10px] font-medium text-[#64748b]">
              Referencia BROU
            </span>
          </div>

          {/* Unidad Indexada */}
          <div className="bg-gradient-to-b from-[#ffffff] to-[#f0f5ff] border border-[#93c5fd] hover:border-[#3b82f6] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-all shadow-2xs">
            <span className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-wider">
              Unidad Indexada
            </span>
            <div className="text-2xl font-mono font-bold text-[#1d4ed8] my-2">
              {indices?.ui}
            </div>
            <span className="text-[10px] font-medium text-[#3b82f6]">
              Valor diario INE
            </span>
          </div>

          {/* Unidad Reajustable */}
          <div className="bg-[#ffffff] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-all shadow-2xs">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              Unidad Reajustable
            </span>
            <div className="text-2xl font-mono font-bold text-[#0f172a] my-2">
              {indices?.ur}
            </div>
            <span className="text-[10px] font-medium text-[#64748b]">
              Valor mensual INE
            </span>
          </div>

          {/* URA */}
          <div className="bg-[#ffffff] border border-[#cbd5e1] hover:border-[#94a3b8] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-all shadow-2xs">
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider">
              U.R. Alquileres
            </span>
            <div className="text-2xl font-mono font-bold text-[#0f172a] my-2">
              {indices?.ura}
            </div>
            <span className="text-[10px] font-medium text-[#64748b]">
              Coeficiente URA
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};
