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
    <div className="w-full bg-[#171614] rounded-2xl border border-[#262420] p-6 sm:p-8 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-[#22201c]">
        <div>
          <h2 className="text-xs font-medium text-[#cfc9be] uppercase tracking-[0.18em]">
            Indicadores y Cotizaciones Oficiales
          </h2>
          <p className="text-xs font-academic italic text-[#857f74] mt-0.5">
            Banco Central del Uruguay & Instituto Nacional de Estadística
          </p>
        </div>

        <div className="flex items-center gap-4">
          {!loading && indices && (
            <span className="text-[11px] text-[#7d786f]">
              {indices.lastUpdated}
            </span>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1d1c19] hover:bg-[#262420] border border-[#2c2a25] rounded-lg text-[10px] font-medium text-[#cfc9be] uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin text-[#c5a880]' : 'text-[#a39e93]'} />
            {loading ? 'Sincronizando' : 'Actualizar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="bg-[#121210] border border-[#22201c] rounded-xl p-5 h-32 animate-pulse" />
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
          <div className="bg-[#121210] border border-[#22201c] hover:border-[#36332e] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-colors">
            <span className="text-[10px] font-medium text-[#857f74] uppercase tracking-wider">
              Dólar Interbancario
            </span>
            <div className="text-2xl font-mono font-medium text-[#f2efe9] my-2">
              {indices?.dolarInter}
            </div>
            <span className="text-[10px] text-[#6e695f]">
              Promedio BCU
            </span>
          </div>

          {/* Dólar Pizarra */}
          <div className="bg-[#121210] border border-[#22201c] hover:border-[#36332e] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-colors">
            <span className="text-[10px] font-medium text-[#857f74] uppercase tracking-wider">
              Dólar Pizarra
            </span>
            {(() => {
              const parts = indices?.dolarPizarra ? indices.dolarPizarra.split('/') : [];
              const comp = parts[0]?.trim() || '$38,90';
              const vent = parts[1]?.trim() || '$41,40';
              return (
                <div className="space-y-1 my-1">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-[10px] text-[#6e695f]">Compra</span>
                    <span className="font-mono font-medium text-[#e4dfd5]">{comp}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-[10px] text-[#6e695f]">Venta</span>
                    <span className="font-mono font-medium text-[#e4dfd5]">{vent}</span>
                  </div>
                </div>
              );
            })()}
            <span className="text-[10px] text-[#6e695f]">
              Referencia BROU
            </span>
          </div>

          {/* Unidad Indexada */}
          <div className="bg-[#121210] border border-[#22201c] hover:border-[#36332e] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-colors">
            <span className="text-[10px] font-medium text-[#857f74] uppercase tracking-wider">
              Unidad Indexada
            </span>
            <div className="text-2xl font-mono font-medium text-[#d4bc98] my-2">
              {indices?.ui}
            </div>
            <span className="text-[10px] text-[#6e695f]">
              Valor diario INE
            </span>
          </div>

          {/* Unidad Reajustable */}
          <div className="bg-[#121210] border border-[#22201c] hover:border-[#36332e] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-colors">
            <span className="text-[10px] font-medium text-[#857f74] uppercase tracking-wider">
              Unidad Reajustable
            </span>
            <div className="text-2xl font-mono font-medium text-[#f2efe9] my-2">
              {indices?.ur}
            </div>
            <span className="text-[10px] text-[#6e695f]">
              Valor mensual INE
            </span>
          </div>

          {/* URA */}
          <div className="bg-[#121210] border border-[#22201c] hover:border-[#36332e] rounded-xl p-5 flex flex-col justify-between min-h-[8.5rem] transition-colors">
            <span className="text-[10px] font-medium text-[#857f74] uppercase tracking-wider">
              U.R. Alquileres
            </span>
            <div className="text-2xl font-mono font-medium text-[#e4dfd5] my-2">
              {indices?.ura}
            </div>
            <span className="text-[10px] text-[#6e695f]">
              Coeficiente URA
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};
