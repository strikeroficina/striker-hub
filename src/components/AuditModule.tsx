import React, { useState, useRef } from 'react';
import { Upload, FileText, FileSearch, Download, Trash2, Printer, AlertCircle, CheckCircle2, Loader2, Bot, X, Copy, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { runAudit } from '../lib/gemini';
import { getNotaryProfile, formatNotaryDisplayTitle } from '../lib/notaryProfile';
import { cn } from '../lib/utils';

interface AuditModuleProps {
  onAuditComplete?: (report: string) => void;
}

const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const UNSUPPORTED_MESSAGE = "Formato no soportado. Por favor, sube documentos en formato PDF, Word (.docx), texto plano (.txt) o imágenes (JPEG/PNG).";

export const AuditModule: React.FC<AuditModuleProps> = ({ onAuditComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const validateAndAddFiles = (selectedFiles: File[]): boolean => {
    const validFiles: File[] = [];
    let hasError = false;
    let errMessage = "";

    selectedFiles.forEach((file) => {
      const isDocx = file.name.toLowerCase().endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (!ALLOWED_MIMES.includes(file.type) && !isDocx) {
        errMessage = UNSUPPORTED_MESSAGE;
        hasError = true;
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      setFiles(prev => {
        // Prevent duplicate files by checking name and size together
        const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
        const uniqueNew = validFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
        if (uniqueNew.length === 0 && hasError) {
          setError(errMessage);
          return prev;
        }
        return [...prev, ...uniqueNew];
      });
      if (!hasError) {
        setError(null);
      }
    } else if (hasError) {
      setError(errMessage);
    }
    return !hasError;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setError(null);
  };

  const clearAllFiles = () => {
    setFiles([]);
    setError(null);
  };

  const startAudit = async () => {
    if (files.length === 0) return;
    
    // Strict MIME validation before trigger
    const invalidFile = files.find(f => {
      const isDocx = f.name.toLowerCase().endsWith('.docx') || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      return !ALLOWED_MIMES.includes(f.type) && !isDocx;
    });
    if (invalidFile) {
      setError(UNSUPPORTED_MESSAGE);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Map all files to base64 simultaneously
      const filesPayloadPromises = files.map(f => {
        return new Promise<{ fileBase64: string; mimeType: string; fileName: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.split(',')[1];
            resolve({
              fileBase64: base64,
              mimeType: f.type || (f.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain'),
              fileName: f.name
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
      });

      const processedFiles = await Promise.all(filesPayloadPromises);
      const profile = getNotaryProfile();
      const clientName = `${formatNotaryDisplayTitle(profile)} • ${profile.officeName} (${profile.city}, ${profile.department})`;
      const timestamp = new Date().toLocaleString('es-UY');

      const result = await runAudit(null, null, null, clientName, timestamp, processedFiles);
      
      setReport(result);
      if (onAuditComplete) onAuditComplete(result);
    } catch (err: any) {
      console.error(err);
      if (err.name === 'GeminiUnavailableError' || err.message === 'UNAVAILABLE' || err.status === 503) {
        setError('⏳ ELO está procesando un alto volumen de documentos en este momento. Por favor, aguarde 30 segundos y vuelva a presionar el botón.');
      } else {
        setError(err.message || "Error al procesar la auditoría de los documentos. Intente nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!report || !reportRef.current) return;
    
    const reportHtml = reportRef.current.innerHTML;
    const printableHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dictamen de Auditoría - TABELION</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;700;900&display=swap');
            * { box-sizing: border-box; }
            body { 
              font-family: 'Inter', -apple-system, sans-serif; 
              padding: 40px; 
              color: #000; 
              background: #fff; 
              line-height: 1.6;
              font-size: 11pt;
            }
            .print-container { max-width: 800px; margin: 0 auto; }
            h1 { font-family: 'Cinzel', Georgia, serif; font-size: 22pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; border-bottom: 4px solid #000; padding-bottom: 10px; }
            h2 { font-size: 15pt; font-weight: 900; text-transform: uppercase; margin-top: 30pt; margin-bottom: 12pt; border-left: 6px solid #000; padding-left: 15px; background: #f0f0f0; padding-top: 8px; padding-bottom: 8px; }
            h3 { font-size: 13pt; font-weight: 900; text-transform: uppercase; margin-top: 20pt; }
            p { margin-bottom: 12pt; text-align: justify; }
            ul, ol { margin-bottom: 15pt; padding-left: 30px; }
            li { margin-bottom: 8pt; }
            hr { border: 0; border-top: 3px solid #000; margin: 25px 0; }
            blockquote { border-left: 3px solid #ddd; padding-left: 15px; color: #444; font-style: italic; margin: 20px 0; }
            .footer { margin-top: 50pt; font-size: 9pt; color: #666; font-style: italic; border-top: 1px solid #eee; padding-top: 15pt; text-align: center; }
            @media print {
              body { padding: 0; }
              @page { margin: 2cm; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${reportHtml}
            <div class="footer">
              <p>${getNotaryProfile().reportFooter || 'Dictamen de asistencia digital emitido en TABELION bajo supervisión del profesional actuante.'}</p>
              <p>TABELION — El espacio inteligente del escribano Uruguayo • Motor ELO // Striker IA • ${new Date().toLocaleString('es-UY')}</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([printableHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    
    document.body.appendChild(iframe);

    setTimeout(() => {
      URL.revokeObjectURL(url);
      setTimeout(() => iframe.remove(), 10000);
    }, 1000);
  };

  const handleDownloadHtml = () => {
    if (!report || !reportRef.current) return;
    
    const reportHtml = reportRef.current.innerHTML;
    const filename = `Auditoria_TABELION_${new Date().toISOString().split('T')[0]}.html`;
    
    const fullHtml = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Dictamen Notarial - TABELION</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;700;900&display=swap');
            * { box-sizing: border-box; }
            body { 
              font-family: 'Inter', -apple-system, Helvetica, Arial, sans-serif; 
              padding: 50px; 
              color: #1a1a1a; 
              background: #fff; 
              line-height: 1.6;
              font-size: 11.5pt;
            }
            .print-container { max-width: 850px; margin: 0 auto; }
            h1 { font-family: 'Cinzel', Georgia, serif; font-size: 24pt; font-weight: 900; text-transform: uppercase; margin-bottom: 8px; border-bottom: 5px solid #000; padding-bottom: 12px; letter-spacing: 0.06em; }
            h2 { font-size: 17pt; font-weight: 900; text-transform: uppercase; margin-top: 35pt; margin-bottom: 15pt; border-left: 8px solid #000; padding-left: 20px; background: #f4f4f4; padding-top: 10px; padding-bottom: 10px; }
            h3 { font-size: 14pt; font-weight: 900; text-transform: uppercase; margin-top: 25pt; }
            p { margin-bottom: 14pt; text-align: justify; }
            ul, ol { margin-bottom: 18pt; padding-left: 35px; }
            li { margin-bottom: 10pt; }
            hr { border: 0; border-top: 3px solid #000; margin: 30px 0; }
            blockquote { border-left: 4px solid #ddd; padding-left: 20px; color: #555; font-style: italic; margin: 25px 0; }
            .footer { margin-top: 60pt; font-size: 9.5pt; color: #777; font-style: italic; border-top: 2px solid #eee; padding-top: 20pt; text-align: center; }
            @media print {
              body { padding: 0; }
              @page { margin: 2.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${reportHtml}
            <div class="footer">
              <p>Este dictamen técnico fue generado en TABELION (Copiloto ELO // Striker IA) el ${new Date().toLocaleString('es-UY')}.</p>
              <p>TABELION — EL ESPACIO INTELIGENTE DEL ESCRIBANO URUGUAYO</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      const cleanText = report
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      await navigator.clipboard.writeText(cleanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 h-full flex flex-col gap-8">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 2rem;
            color: black !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-tabelion font-bold uppercase tracking-[0.2em] text-amber-400">
              TABELION // CALIFICACIÓN REGISTRAL
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-tabelion font-black text-white uppercase tracking-[0.12em]">
            Auditoría de Títulos & Contraste DGR
          </h1>
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">
            Contraste inmediato contra el Manual de Calificación DGR y Ley 16.871 • Cero Observaciones
          </p>
        </div>
        {report && (
          <div className="flex gap-4">
            <button 
              onClick={() => { setReport(null); setFiles([]); }}
              className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xl text-xs font-black uppercase tracking-widest hover:text-white transition-all"
            >
              Nueva Auditoría
            </button>
            <button 
              onClick={handleCopy}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl",
                copied 
                  ? "bg-emerald-600 text-white shadow-emerald-600/20" 
                  : "bg-neutral-800 text-slate-300 hover:bg-neutral-700 shadow-black/20"
              )}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
            <button 
              onClick={handleDownloadHtml}
              className="px-6 py-2.5 bg-neutral-800 text-slate-300 hover:bg-neutral-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl shadow-black/20"
            >
              <Download size={16} />
              Descargar HTML
            </button>
            <button 
              onClick={handlePrint}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center gap-2 shadow-xl shadow-blue-600/20"
            >
              <Printer size={16} />
              Exportar / Imprimir
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar no-print">
        <AnimatePresence mode="wait">
          {!report ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col gap-8"
            >
              {/* Drop Zone */}
              <div 
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => files.length === 0 && fileInputRef.current?.click()}
                className={cn(
                  "flex-1 bento-card border-2 border-dashed flex flex-col items-center justify-center p-12 text-center transition-all cursor-pointer min-h-[220px]",
                  isDragging ? "border-blue-500 bg-blue-600/5" : "border-neutral-800 hover:border-neutral-700",
                  files.length > 0 ? "border-solid border-neutral-800/80 bg-neutral-900/10 cursor-default" : ""
                )}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.txt,.docx,.jpg,.jpeg,.png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                />
                
                {files.length > 0 ? (
                  <div className="w-full space-y-6">
                    <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                      <div>
                        <h3 className="text-lg font-black text-white text-left uppercase tracking-tight">Expediente de Documentos ({files.length})</h3>
                        <p className="text-xs text-neutral-500 font-bold text-left uppercase tracking-wider">Listo para auditoría integral y cruzada por ELO</p>
                      </div>
                      <button 
                        onClick={clearAllFiles}
                        className="px-4 py-2 bg-neutral-950 border border-neutral-800 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-950/10 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Limpiar Todo
                      </button>
                    </div>

                    {/* List Grid of local files */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                      {files.map((f, idx) => (
                        <div 
                          key={`${f.name}-${idx}`}
                          className="bento-card border border-neutral-800 bg-neutral-900/60 p-4 rounded-xl flex items-center justify-between gap-4 group hover:border-neutral-700 transition-all"
                        >
                          <div className="flex items-center gap-3 overflow-hidden text-left">
                            <div className="w-10 h-10 bg-blue-600/10 border border-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-black text-white truncate max-w-[200px]" title={f.name}>{f.name}</p>
                              <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
                                {(f.size / 1024 / 1024).toFixed(2)} MB • {f.name.toLowerCase().endsWith('.docx') ? 'WORD' : (f.type.split('/')[1]?.toUpperCase() || 'DOCUMENTO')}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                            className="p-2 text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"
                            title="Quitar documento"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}

                      {/* Add more interactive card */}
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 p-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer transition-all hover:bg-neutral-900/10 min-h-[72px]"
                      >
                        <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
                          <Plus size={16} />
                        </div>
                        <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                          Anexar documento
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 flex flex-col items-center">
                    <div className="w-20 h-20 bg-neutral-950 border border-neutral-800 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="text-neutral-600" size={32} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-2xl font-black text-white uppercase tracking-tight">Cargar Documentación</p>
                      <p className="text-neutral-500 text-sm font-medium">Arrastra tus archivos aquí o haz clic para buscar múltiples documentos</p>
                    </div>
                    <div className="flex gap-4 text-[10px] font-black text-neutral-600 uppercase tracking-widest mt-8">
                       <span>SOPORTA CARGA MÚLTIPLE: PDF</span> • <span>WORD (DOCX)</span> • <span>TXT</span> • <span>IMÁGENES</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button 
                onClick={startAudit}
                disabled={files.length === 0 || loading}
                className={cn(
                  "w-full py-6 rounded-2xl text-lg font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-4 shadow-2xl",
                  files.length > 0 && !loading 
                    ? "bg-white text-black hover:bg-neutral-200 active:scale-95 cursor-pointer" 
                    : "bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-700"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    PROCESANDO EN ELO... ({files.length} {files.length === 1 ? 'doc' : 'docs'})
                  </>
                ) : (
                  <>
                    <Bot size={24} />
                    INICIAR AUDITORÍA TÉCNICA {files.length > 0 ? `(${files.length} DOCUMENTOS)` : ''}
                  </>
                )}
              </button>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-500 text-left">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bento-card !p-0 overflow-hidden bg-neutral-900 border-neutral-800"
            >
              <div 
                ref={reportRef}
                className="p-10 printable-report overflow-y-auto max-h-[70vh] custom-scrollbar selection:bg-blue-600/30"
              >
                <div className="prose prose-invert prose-blue max-w-none prose-headings:uppercase prose-headings:tracking-tighter prose-headings:font-black prose-p:text-neutral-300 prose-p:font-sans prose-p:leading-loose whitespace-pre-wrap font-sans text-base">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Bot Status Footer (No print) */}
      <div className="flex items-center justify-between no-print border-t border-neutral-800/50 pt-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
             <div className={cn("w-2 h-2 rounded-full", loading ? "bg-blue-500 animate-pulse" : "bg-emerald-500")}></div>
             <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">IA ENGINE: {loading ? 'AUDITING...' : 'READY'}</span>
          </div>
          <div className="text-[10px] font-black text-neutral-700 uppercase tracking-widest">
            GROUNDING: DGR-UY ACTIVE
          </div>
        </div>
        <div className="text-[10px] font-tabelion font-black text-amber-400/70 uppercase tracking-[0.2em]">
          TABELION • URUGUAY LEGAL TECH
        </div>
      </div>
    </div>
  );
};
