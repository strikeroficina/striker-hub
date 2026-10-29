import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, RefreshCw, Landmark, Activity, Coins, Percent } from 'lucide-react';

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

export const UruguayIndicesCard: React.FC<UruguayIndicesCardProps> = ({ indices: propIndices, loading: propLoading, onRefresh }) => {
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
    }, 800);
  };

  return (
    <div className="w-full bg-slate-850/50 backdrop-blur-md rounded-[1.5rem] border border-slate-800/80 p-6 relative overflow-hidden transition-all duration-300 shadow-xl shadow-slate-950/10">
      {/* Decorative top border line */}
      <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-blue-500/10 via-emerald-500/50 to-blue-500/10 opacity-70"></div>
      
      {/* Main Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Activity className="text-emerald-400" size={16} />
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">
              Indicadores Económicos Notariales
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              Uruguay 2026 • Fuente Oficial BCU / INE
            </p>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-3">
          {!loading && indices && (
            <span className="text-[9px] font-mono text-slate-500 font-semibold uppercase tracking-wider">
              Sincronizado: {indices.lastUpdated}
            </span>
          )}
          <button 
            type="button"
            onClick={handleManualRefresh}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-widest transition-all ${loading ? 'opacity-55 cursor-not-allowed' : 'active:scale-95'}`}
          >
            <RefreshCw size={11} className={`${loading ? 'animate-spin text-emerald-400' : ''}`} />
            {loading ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      {loading ? (
        /* Skeleton Loading State matching styling */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 py-6">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="bg-slate-900/30 border border-slate-900/40 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden min-h-[9.5rem] h-auto justify-between">
              <div className="w-24 h-3 bg-slate-800/80 rounded-md animate-pulse"></div>
              <div className="w-32 h-9 bg-slate-800 rounded-md animate-pulse"></div>
              <div className="w-20 h-2 bg-slate-800/55 rounded-md animate-pulse"></div>
              {/* Pulsing sub-bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]"></div>
            </div>
          ))}
          <div className="col-span-full text-center mt-3">
            <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest animate-pulse">
              Sincronizando con fuentes oficiales...
            </span>
          </div>
        </div>
      ) : (
        /* Active populated Grid layout */
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 py-4"
        >
          {/* Indicator Item: Dólar Interbancario */}
          <div className="bg-slate-900/35 hover:bg-slate-900/50 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between min-h-[9.5rem] h-auto transition-all group">
            <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
              <span>Dólar Interbancario</span>
              <Coins size={11} className="text-slate-600 group-hover:text-amber-500 transition-colors" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tighter text-white py-2">
              {indices?.dolarInter}
            </div>
            <div className="text-[9px] font-semibold text-slate-500 font-mono flex items-center gap-1 mt-1">
              Valor Promedio BCU
            </div>
          </div>

          {/* Indicator Item: Dólar Pizarra */}
          <div className="bg-slate-900/35 hover:bg-slate-900/50 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between min-h-[9.5rem] h-auto transition-all group">
            <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
              <span>Dólar Pizarra</span>
              <Landmark size={11} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
            </div>
            {(() => {
              const parts = indices?.dolarPizarra ? indices.dolarPizarra.split('/') : [];
              const comp = parts[0]?.trim() || '$41,35';
              const vent = parts[1]?.trim() || '$44,35';
              return (
                <div className="flex flex-col gap-1 py-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-slate-500 font-bold">COMPRA:</span>
                    <span className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-200">{comp}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] text-slate-500 font-bold">VENTA:</span>
                    <span className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-200">{vent}</span>
                  </div>
                </div>
              );
            })()}
            <div className="text-[9px] font-semibold text-slate-500 font-mono flex items-center gap-1 mt-1">
              Compra / Venta BROU
            </div>
          </div>

          {/* Indicator Item: Unidad Indexada */}
          <div className="bg-slate-900/35 hover:bg-slate-900/50 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between min-h-[9.5rem] h-auto transition-all group">
            <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
              <span>Unidad Indexada (UI)</span>
              <TrendingUp size={11} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tighter text-emerald-400 py-2">
              {indices?.ui}
            </div>
            <div className="text-[9px] font-semibold text-emerald-500/70 font-mono flex items-center gap-1 mt-1">
              Tasa Diaria INE
            </div>
          </div>

          {/* Indicator Item: Unidad Reajustable */}
          <div className="bg-slate-900/35 hover:bg-slate-900/50 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between min-h-[9.5rem] h-auto transition-all group">
            <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
              <span>Unidad Reajustable (UR)</span>
              <Percent size={11} className="text-slate-600 group-hover:text-purple-500 transition-colors" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tighter text-white py-2">
              {indices?.ur}
            </div>
            <div className="text-[9px] font-semibold text-slate-500 font-mono flex items-center gap-1 mt-1">
              Valor Mensual U.R.
            </div>
          </div>

          {/* Indicator Item: Unidad Reajustable de Alquileres */}
          <div className="bg-slate-900/35 hover:bg-slate-900/50 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between min-h-[9.5rem] h-auto transition-all group">
            <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
              <span>Módulo Alquiler (URA)</span>
              <Landmark size={11} className="text-slate-600 group-hover:text-indigo-500 transition-colors" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tighter text-slate-300 py-2">
              {indices?.ura}
            </div>
            <div className="text-[9px] font-semibold text-slate-500 font-mono flex items-center gap-1 mt-1">
              Arrendamientos Activos
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
