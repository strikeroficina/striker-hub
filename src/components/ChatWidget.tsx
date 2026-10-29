import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Maximize2, Minimize2, Trash2, X, Copy, Check, KeyRound } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatWithELO, getStoredApiKey, setStoredApiKey } from '../lib/gemini';
import { dbGetContacts, dbInsertContact, dbDeleteContact, dbInsertNote } from '../lib/relationalDb';
import { Message } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChatWidgetProps {
  isFloating?: boolean;
  auditContext?: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  dolarInter?: string;
  ui?: string;
  ur?: string;
  ura?: string;
  activeTab?: string;
  onRefreshIndices?: () => Promise<void> | void;
  onUpdateCustomIndices?: (vals: { ui?: number; ur?: number; ura?: number; usd?: number }) => void;
  onNavigateTab?: (tab: string) => void;
}

const MessageBubble: React.FC<{ m: Message; idx: number }> = ({ m, idx }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const text = m.parts[0].text;
      const cleanText = text
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '')
        .trim();
      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={idx}
      className={cn(
        "flex gap-3 max-w-[90%] group",
        m.role === 'user' ? "ml-auto flex-row-reverse" : ""
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 shadow-sm",
        m.role === 'user' ? "bg-slate-800 border border-slate-700" : "bg-blue-600/10 border border-blue-500/20"
      )}>
        {m.role === 'user' ? <User size={16} className="text-slate-400" /> : <Bot size={16} className="text-blue-400" />}
      </div>
      <div className="relative">
        <div className={cn(
          "p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap",
          m.role === 'user' 
            ? "bg-blue-600 text-white rounded-tr-none" 
            : "bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50"
        )}>
          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-loose">
            <ReactMarkdown>{m.parts[0].text}</ReactMarkdown>
          </div>
        </div>
        {m.role === 'model' && (
          <button 
            onClick={handleCopy}
            className="absolute -right-10 top-0 p-2 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copiar contenido limpio"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  isFloating = true, 
  auditContext,
  messages,
  setMessages,
  isOpen,
  setIsOpen,
  dolarInter,
  ui,
  ur,
  ura,
  activeTab,
  onRefreshIndices,
  onUpdateCustomIndices,
  onNavigateTab
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey());
  const [keySaved, setKeySaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  // Ejecutor de comandos estructurados emitidos por ELO sobre los módulos del Hub
  const processEloActions = (rawText: string): string => {
    const actionRegex = /\[\[ACTION:([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    const executedNotices: string[] = [];

    while ((match = actionRegex.exec(rawText)) !== null) {
      const payload = match[1];
      const parts = payload.split('|').map(p => p.trim());
      const actionType = parts[0]?.toUpperCase();
      const params: Record<string, string> = {};

      for (let i = 1; i < parts.length; i++) {
        const eqIdx = parts[i].indexOf('=');
        if (eqIdx > 0) {
          const k = parts[i].slice(0, eqIdx).trim();
          const v = parts[i].slice(eqIdx + 1).trim();
          params[k] = v;
        }
      }

      if (actionType === 'AGENDA_ADD' && params.name) {
        const newClient = dbInsertContact({
          id: 'c_' + Date.now(),
          name: params.name,
          email: params.email || '',
          phone: params.phone || '',
          observations: params.observations || 'Agendado por el Copiloto ELO'
        });
        window.dispatchEvent(new CustomEvent('elo-agenda-updated', { detail: { selectId: newClient.id } }));
        executedNotices.push(`✓ Cliente agendado en Agenda: ${params.name}`);
      } else if (actionType === 'AGENDA_DELETE' && params.name) {
        const contacts = dbGetContacts().filter(c => !c.deleted);
        const q = params.name.toLowerCase();
        const target = contacts.find(c => c.name.toLowerCase().includes(q));
        if (target) {
          dbDeleteContact(target.id);
          window.dispatchEvent(new CustomEvent('elo-agenda-updated'));
          executedNotices.push(`✓ Cliente eliminado de Agenda: ${target.name}`);
        }
      } else if (actionType === 'AGENDA_NOTE' && params.name && params.text) {
        const contacts = dbGetContacts().filter(c => !c.deleted);
        const q = params.name.toLowerCase();
        const target = contacts.find(c => c.name.toLowerCase().includes(q));
        if (target) {
          const d = new Date();
          const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
          dbInsertNote({
            cliente_id: target.id,
            text: params.text,
            date: dateStr,
            timestamp: Date.now()
          });
          window.dispatchEvent(new CustomEvent('elo-agenda-updated', { detail: { selectId: target.id } }));
          executedNotices.push(`✓ Nota agregada a la ficha de ${target.name}`);
        }
      } else if (actionType === 'INDICES_REFRESH') {
        if (onRefreshIndices) onRefreshIndices();
        executedNotices.push(`✓ Índices económicos sincronizados en tiempo real`);
      } else if (actionType === 'INDICES_SET') {
        const updates: { ui?: number; ur?: number; ura?: number; usd?: number } = {};
        if (params.ui) updates.ui = parseFloat(params.ui.replace(',', '.'));
        if (params.ur) updates.ur = parseFloat(params.ur.replace(',', '.'));
        if (params.ura) updates.ura = parseFloat(params.ura.replace(',', '.'));
        if (params.usd) updates.usd = parseFloat(params.usd.replace(',', '.'));
        if (onUpdateCustomIndices) onUpdateCustomIndices(updates);
        executedNotices.push(`✓ Valores de índices actualizados en el Hub`);
      } else if (actionType === 'NAVIGATE' && params.tab) {
        if (onNavigateTab) onNavigateTab(params.tab);
      }
    }

    const cleaned = rawText.replace(actionRegex, '').trim();
    if (executedNotices.length > 0) {
      return `${cleaned}\n\n---\n*${executedNotices.join(' • ')}*`;
    }
    return cleaned;
  };

  const handleSaveApiKey = () => {
    setStoredApiKey(apiKeyInput);
    setKeySaved(true);
    setTimeout(() => {
      setKeySaved(false);
      setShowKeyConfig(false);
    }, 1200);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', parts: [{ text: userMessage }] }]);
    setIsLoading(true);

    try {
      // Si la solicitud involucra cálculos, impuestos, honorarios o cotizaciones, actualizamos índices dinámicamente
      const lower = userMessage.toLowerCase();
      if (
        onRefreshIndices &&
        (lower.includes('calcul') ||
          lower.includes('ui') ||
          lower.includes('ur') ||
          lower.includes('dolar') ||
          lower.includes('dólar') ||
          lower.includes('itp') ||
          lower.includes('irpf') ||
          lower.includes('honorario') ||
          lower.includes('actualiz') ||
          lower.includes('sincroniz'))
      ) {
        await onRefreshIndices();
      }

      // Consume dynamic real-world indicators
      const urVal = ur || '$1.946,95';
      const uiVal = ui || '$6,6803';
      const uraVal = ura || '$1.939,40';
      const usdInter = dolarInter || '$40,14';

      // Parse float to calculate pizarra spread dynamically from dolarInter
      let dInterNum = 40.14;
      if (dolarInter) {
        const cleanDolar = dolarInter.replace('$', '').replace(/\./g, '').replace(',', '.');
        dInterNum = parseFloat(cleanDolar) || 40.14;
      }
      const dCompra = (dInterNum - 1.25).toFixed(2);
      const dVenta = (dInterNum + 1.25).toFixed(2);
      const usdPizarra = `$${dCompra.replace('.', ',')} / $${dVenta.replace('.', ',')}`;

      // Resumen en vivo de la Agenda de Clientes para que ELO pueda consultar, agendar o eliminar
      const activeContacts = dbGetContacts().filter(c => !c.deleted);
      const agendaSummary = activeContacts.length > 0
        ? activeContacts.map(c => `- ${c.name} (Tel: ${c.phone || 'S/D'}, Email: ${c.email || 'S/D'}, Obs: ${c.observations || 'Ninguna'}, Notas: ${c.notes.length}, Adjuntos: ${c.attachments.length})`).join('\n')
        : 'Sin contactos activos en la agenda.';

      const indicesContext = `[MÓDULO ACTIVO DEL ESCRIBANO]: ${activeTab || 'dashboard'}

[ÍNDICES FINANCIEROS Y DE REAJUSTE VIGENTES EN EL HUB]:
- Unidad Indexada (UI) vigente (INE/BCU): ${uiVal}
- Unidad Reajustable (UR) vigente (INE): ${urVal}
- Unidad Reajustable de Alquileres (URA) vigente (INE): ${uraVal}
- Tipo de Cambio Dólar Interbancario (BCU) vigente: ${usdInter}
- Tipo de Cambio Dólar Pizarra (BROU) vigente: ${usdPizarra}
Utiliza obligatoriamente estos números exactos para cualquier consulta, asesoramiento o liquidación fiscal que te pida el escribano.

[AGENDA ACTIVA DEL ESTUDIO (${activeContacts.length} clientes)]:
${agendaSummary}`;

      const combinedContext = auditContext 
        ? `${indicesContext}\n\n[ÚLTIMO INFORME DE AUDITORÍA O LIQUIDACIÓN EN PANTALLA]:\n${auditContext}`
        : indicesContext;

      const visibleHistory = messages.filter(
        m => !m.parts[0]?.text?.startsWith("CONTEXTO DEL SISTEMA:") && !m.parts[0]?.text?.startsWith("CONTEXTO REAL DEL HUB:")
      );

      const rawResponse = await chatWithELO(userMessage, visibleHistory, combinedContext);
      const finalResponse = processEloActions(rawResponse || 'No pude generar una respuesta.');
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: finalResponse }] }]);
    } catch (error: any) {
      console.error(error);
      let textToShow = '';
      if (error.name === 'GeminiUnavailableError' || error.message === 'UNAVAILABLE' || error.status === 503) {
        textToShow = '⏳ ELO está procesando un alto volumen de documentos en este momento. Por favor, aguarde unos segundos y vuelva a enviar su consulta.';
      } else {
        const errorMessage = error.message || 'Lo siento, ocurrió un error al procesar tu solicitud. Verifica la clave API en el ícono de llave arriba a la derecha.';
        textToShow = `⚠️ **Error del Sistema:** ${errorMessage}`;
      }
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: textToShow }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isFloating && !isOpen && (
          <motion.button
            key="chat-trigger"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-slate-800 border border-slate-700/50 rounded-full flex items-center justify-center shadow-2xl z-[9999] group hover:bg-slate-700 transition-colors no-print"
          >
            <Bot className="text-blue-400 group-hover:text-blue-300 transition-colors" size={28} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
            <div className="absolute right-20 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-[10px] font-black text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none transform translate-x-2 group-hover:translate-x-0 tracking-widest shadow-xl">
              CONSULTAR A ELO
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isOpen || !isFloating) && (
          <motion.div 
            key="chat-window"
            initial={isFloating ? { opacity: 0, y: 20, scale: 0.95 } : { opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={isFloating ? { opacity: 0, y: 20, scale: 0.95 } : { opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "flex flex-col bg-slate-900/95 backdrop-blur-md border border-slate-800 overflow-hidden no-print",
              !isFloating 
                ? "h-full w-full rounded-2xl" 
                : (isExpanded 
                    ? "fixed inset-4 sm:inset-10 z-[9999] shadow-2xl rounded-3xl" 
                    : "fixed bottom-24 right-4 sm:right-6 w-[360px] sm:w-[500px] max-w-[calc(100vw-32px)] h-[600px] max-h-[calc(100vh-120px)] z-[9999] shadow-2xl rounded-2xl")
            )}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                  <Bot className="text-blue-400" size={22} />
                </div>
                <div>
                  <h2 className="font-black text-xs text-white uppercase tracking-tighter">ELO // STRIKER</h2>
                  <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                    OPERATIVO • CERO RELLENO
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowKeyConfig(!showKeyConfig)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showKeyConfig ? "bg-blue-600/20 text-blue-400" : "hover:bg-slate-800 text-slate-500"
                  )}
                  title="Configurar API Key de Gemini (Por Escribano)"
                >
                  <KeyRound size={15} />
                </button>
                <button 
                  onClick={() => setMessages([{ role: 'model', parts: [{ text: '**MEMORIA REINICIADA.**\nListo para nueva orden, liquidación o dictamen.' }] }])}
                  className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                  title="Reiniciar contexto"
                >
                  <Trash2 size={16} />
                </button>
                
                {isFloating && (
                  <>
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-2 hidden sm:block hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                      title={isExpanded ? "Contraer" : "Expandir"}
                    >
                      {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg text-slate-500 transition-colors"
                      title="Cerrar chat"
                    >
                      <X size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Panel rápido para configurar API Key por Escribano */}
            <AnimatePresence>
              {showKeyConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-slate-800 bg-slate-950/90 px-4 py-3 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                      Clave API Gemini del Estudio (Opcional si ya está en servidor)
                    </span>
                    {keySaved && <span className="text-[9px] font-bold text-emerald-400">✓ Guardada</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                    >
                      Guardar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Area */}
            <div 
              ref={scrollRef} 
              className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth custom-scrollbar bg-slate-900/20"
            >
              {messages
                .filter(
                  m =>
                    !m.parts[0]?.text?.startsWith("CONTEXTO DEL SISTEMA:") &&
                    !m.parts[0]?.text?.startsWith("CONTEXTO REAL DEL HUB:")
                )
                .map((m, idx) => (
                  <MessageBubble key={idx} m={m} idx={idx} />
                ))}
              
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                    <Loader2 className="text-blue-400 animate-spin" size={16} />
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-slate-700/50">
                    <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Orden directa: liquidar, auditar, agendar o consultar norma..."
                  className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-500 text-white shadow-inner"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-800 shadow-lg shadow-blue-600/20"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex justify-between items-center px-1 mt-3">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                  UI: {ui || '$6,6803'} • UR: {ur || '$1.946,95'} • USD: {dolarInter || '$40,14'}
                </span>
                <span className="text-[9px] text-slate-500 italic">Grounding DGR-UY</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
