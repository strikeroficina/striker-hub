import React from 'react';
import { FileSearch, Calculator, Users, Bot, ShieldCheck, ArrowUpRight, Scale } from 'lucide-react';
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
  onRefresh,
  onNavigate
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
    <div className="min-h-full flex-1 flex flex-col justify-between gap-6 py-4 sm:py-6 px-2 sm:px-6 max-w-7xl mx-auto w-full">
      {/* HERO HEADER: TABELION */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="text-center space-y-3 pt-2"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-900/90 border border-amber-500/25 text-[9px] font-black uppercase tracking-[0.25em] text-amber-400/90">
          <Scale size={11} className="text-amber-400" />
          <span>Tradición del Tabelión Romano • Ingeniería Striker IA</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-tabelion font-black tracking-[0.22em] text-white uppercase leading-none">
          TABELION
        </h1>

        <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.32em] tabelion-gold-text">
          El espacio inteligente del escribano Uruguayo
        </p>

        <p className="text-[11px] sm:text-xs text-neutral-400 max-w-2xl mx-auto leading-relaxed font-medium pt-0.5">
          Inspirado en el <span className="text-neutral-200 font-semibold">Tabelión romano</span>, redactor de documentos dotados de credibilidad legal y ancestro directo del notariado latino. Diseñado para eliminar horas de trabajo pesado, evitar observaciones registrales y liquidar tributos con certeza absoluta.
        </p>
      </motion.header>

      {/* TRES PILARES OPERATIVOS DE TABELION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto w-full">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('audit')}
          className="group text-left bg-[#0c0c0f] hover:bg-neutral-900/80 border border-neutral-800/90 hover:border-amber-500/40 rounded-2xl p-5 transition-all relative overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent opacity-60 group-hover:opacity-100"></div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <FileSearch size={18} />
            </div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500 group-hover:text-amber-400 flex items-center gap-1 transition-colors">
              Manual DGR <ArrowUpRight size={12} />
            </span>
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">
            Auditoría en Segundos • Cero Observaciones
          </h3>
          <p className="text-[11px] text-neutral-400 leading-relaxed mt-1.5">
            Contrasta escrituras, antecedentes y certificados contra el <span className="text-neutral-200 font-semibold">Manual de Calificación de la DGR</span> y la Ley 16.871 antes de ingresar al Registro.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('calculator')}
          className="group text-left bg-[#0c0c0f] hover:bg-neutral-900/80 border border-neutral-800/90 hover:border-blue-500/40 rounded-2xl p-5 transition-all relative overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent opacity-60 group-hover:opacity-100"></div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <Calculator size={18} />
            </div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500 group-hover:text-blue-400 flex items-center gap-1 transition-colors">
              ITP • IRPF • AEU <ArrowUpRight size={12} />
            </span>
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">
            Exactitud Tributaria Sin Dolores de Cabeza
          </h3>
          <p className="text-[11px] text-neutral-400 leading-relaxed mt-1.5">
            Liquida ITP, IRPF/IRNR (optimización paralela Ficto vs. Real con corte Ley 18.083) y Arancel AEU con índices oficiales sincronizados.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('clients')}
          className="group text-left bg-[#0c0c0f] hover:bg-neutral-900/80 border border-neutral-800/90 hover:border-emerald-500/40 rounded-2xl p-5 transition-all relative overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent opacity-60 group-hover:opacity-100"></div>
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Users size={18} />
            </div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500 group-hover:text-emerald-400 flex items-center gap-1 transition-colors">
              Despacho Soberano <ArrowUpRight size={12} />
            </span>
          </div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider">
            Legajos, Agenda & Copiloto ELO
          </h3>
          <p className="text-[11px] text-neutral-400 leading-relaxed mt-1.5">
            Tarjetero notarial independiente con resguardo documental (.PDF/.DOCX), blindaje Ley 18.331 y ejecución directa por órdenes de voz o texto.
          </p>
        </button>
      </div>

      {/* PANEL CENTRAL DE INDICADORES OFICIALES */}
      <div className="max-w-6xl mx-auto w-full">
        <UruguayIndicesCard indices={mappedIndices} loading={loading} onRefresh={onRefresh} />
      </div>

      <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-neutral-900/90 mt-auto">
        <div className="text-[9px] font-bold text-neutral-500 flex flex-wrap items-center gap-6 uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Certeza Registral DGR: Activa
          </span>
          <span>BCU / INE Feed: Sincronizado</span>
          <span className="flex items-center gap-1 text-amber-400/80">
            <ShieldCheck size={11} /> Secreto Profesional Ley 18.331
          </span>
        </div>
        <div className="text-[9px] text-neutral-500 font-tabelion font-bold uppercase tracking-[0.2em]">
          TABELION • BY STRIKER IA
        </div>
      </footer>
    </div>
  );
};

export const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-full space-y-4">
    <div className="p-8 bg-brand-card border border-brand-border rounded-full animate-bounce">
      <Bot size={64} className="text-brand-primary" />
    </div>
    <h2 className="text-2xl font-bold">{title}</h2>
    <p className="text-slate-400 max-w-sm text-center">Módulo operativo en TABELION. Consulta a ELO para ejecutar acciones directas.</p>
  </div>
);
