import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Smartphone,
  Monitor,
  Download,
  Upload,
  Check,
  Building2,
  MapPin,
  FileSpreadsheet,
  FolderLock,
  Eye,
  EyeOff,
  Save,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  NotaryProfile,
  URUGUAY_DEPARTMENTS,
  getNotaryProfile,
  saveNotaryProfile,
  exportStudioBackup,
  importStudioBackup
} from '../lib/notaryProfile';
import { getStoredApiKey, setStoredApiKey } from '../lib/gemini';

interface NotarySettingsProps {
  onProfileChange?: (profile: NotaryProfile) => void;
  onLockNow?: () => void;
  installPromptEvent?: any;
  onTriggerInstall?: () => void;
}

export const NotarySettings: React.FC<NotarySettingsProps> = ({
  onProfileChange,
  onLockNow,
  installPromptEvent,
  onTriggerInstall
}) => {
  const [profile, setProfile] = useState<NotaryProfile>(() => getNotaryProfile());
  const [apiKey, setApiKey] = useState<string>(() => getStoredApiKey());
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'perfil' | 'seguridad' | 'instalacion'>('perfil');
  const fileRestoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSync = () => setProfile(getNotaryProfile());
    window.addEventListener('elo-profile-updated', handleSync);
    return () => window.removeEventListener('elo-profile-updated', handleSync);
  }, []);

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = saveNotaryProfile(profile);
    setStoredApiKey(apiKey);
    if (onProfileChange) onProfileChange(updated);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleExportBackup = () => {
    const json = exportStudioBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const cleanOffice = (profile.officeName || 'Estudio').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `Respaldo_TABELION_${cleanOffice}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice('✓ Respaldo completo descargado correctamente.');
    setTimeout(() => setBackupNotice(null), 3000);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importStudioBackup(String(reader.result || ''));
      if (ok) {
        const refreshed = getNotaryProfile();
        setProfile(refreshed);
        if (onProfileChange) onProfileChange(refreshed);
        setBackupNotice('✓ Base de datos y perfil restaurados con éxito.');
      } else {
        setBackupNotice('⚠️ Archivo de respaldo inválido.');
      }
      setTimeout(() => setBackupNotice(null), 3500);
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 px-1 sm:px-4 space-y-6 font-sans pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[9px] font-tabelion font-black uppercase tracking-[0.18em] rounded">
              TABELION • CONFIGURACIÓN DEL ESTUDIO
            </span>
            <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest">
              • LEY 18.331 ACTIVA
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-tabelion font-black text-white uppercase tracking-[0.12em] mt-1">
            Datos del Escribano & Seguridad
          </h1>
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-0.5">
            El espacio inteligente del escribano Uruguayo • Membrete Oficial, Ciberseguridad e Instalación PC/Celular
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {profile.pinEnabled && profile.securityPin && onLockNow && (
            <button
              type="button"
              onClick={onLockNow}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"
            >
              <Lock size={13} />
              Bloquear Pantalla
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSaveAll()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
          >
            {savedBanner ? <Check size={14} /> : <Save size={14} />}
            {savedBanner ? '¡Cambios Aplicados!' : 'Guardar Configuración'}
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 bg-[#0c0c0e] p-1.5 rounded-2xl border border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveSection('perfil')}
          className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSection === 'perfil'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <UserCheck size={14} />
          <span>1. Ficha del Escribano</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('seguridad')}
          className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSection === 'seguridad'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <ShieldCheck size={14} />
          <span>2. Seguridad & API</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('instalacion')}
          className={`py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSection === 'instalacion'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Smartphone size={14} />
          <span>3. App PC & Celular</span>
        </button>
      </div>

      {/* SECTION 1: DATOS PERSONALES E INSTITUCIONALES DEL ESCRIBANO */}
      {activeSection === 'perfil' && (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSaveAll}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Left Card: Identidad Profesional */}
          <div className="lg:col-span-7 bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <UserCheck className="text-blue-400" size={16} />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">
                  Identidad Profesional del Titular
                </h2>
              </div>
              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">
                Sincronizado con ELO & PDF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Título Profesional
                </label>
                <select
                  value={profile.title}
                  onChange={(e) => setProfile({ ...profile, title: e.target.value as any })}
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Escribano Público">Escribano Público</option>
                  <option value="Escribana Pública">Escribana Pública</option>
                  <option value="Abogado / Escribano">Abogado / Escribano</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Nombre y Apellido del Escribano/a *
                </label>
                <input
                  type="text"
                  required
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="Ej: Elicelda Rodríguez / Mathias Esquibel"
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Nº Matrícula (SCJ / Caja Notarial)
                </label>
                <input
                  type="text"
                  value={profile.matricula}
                  onChange={(e) => setProfile({ ...profile, matricula: e.target.value })}
                  placeholder="Ej: 14.820"
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  RUT / C.I. Profesional
                </label>
                <input
                  type="text"
                  value={profile.rut}
                  onChange={(e) => setProfile({ ...profile, rut: e.target.value })}
                  placeholder="Ej: 210000000019 / 4.123.456-7"
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                Especialidad Notarial Principal (Contexto Operativo para ELO)
              </label>
              <input
                type="text"
                value={profile.specialty}
                onChange={(e) => setProfile({ ...profile, specialty: e.target.value })}
                placeholder="Ej: Compraventas, Sucesiones, Propiedad Horizontal, Fideicomisos"
                className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Correo Oficial del Estudio
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="estudio@escribania.com.uy"
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Teléfono / Móvil del Despacho
                </label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="Ej: 099 123 456"
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Right Card: Datos del Estudio y Jurisdicción */}
          <div className="lg:col-span-5 bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>

            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="text-emerald-400" size={16} />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">
                  Estudio & Jurisdicción
                </h2>
              </div>
              <MapPin size={14} className="text-neutral-600" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                Nombre de la Escribanía / Estudio
              </label>
              <input
                type="text"
                value={profile.officeName}
                onChange={(e) => setProfile({ ...profile, officeName: e.target.value })}
                placeholder="Ej: Estudio Notarial Rodríguez & Asoc."
                className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Departamento (Sede Registral)
                </label>
                <select
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  {URUGUAY_DEPARTMENTS.map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Ciudad / Zona de Influencia
                </label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="Ej: Punta del Este / Centro"
                  className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                Dirección del Despacho
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Ej: Av. Gorlero 940, Of. 302 / Rincón 450"
                className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                Pie de Firma / Membrete para Informes PDF y Auditorías
              </label>
              <textarea
                rows={2}
                value={profile.reportFooter}
                onChange={(e) => setProfile({ ...profile, reportFooter: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              Guardar Datos del Escribano
            </button>
          </div>
        </motion.form>
      )}

      {/* SECTION 2: SEGURIDAD NOTARIAL & CREDENCIALES IA */}
      {activeSection === 'seguridad' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Left: PIN de Bloqueo y Protocolo Ciberseguridad */}
          <div className="lg:col-span-6 bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>

            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="text-amber-400" size={16} />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">
                  Protocolo de Ciberseguridad ELO
                </h2>
              </div>
              <span className="text-[9px] font-mono text-amber-400 font-bold uppercase">
                Ley Nº 18.331
              </span>
            </div>

            {/* Bloqueo por PIN */}
            <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    {profile.pinEnabled ? <Lock size={12} className="text-amber-400" /> : <Unlock size={12} className="text-neutral-500" />}
                    Bloqueo de Acceso por PIN Notarial
                  </span>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Protege la pantalla de tu PC o celular cuando te ausentas del escritorio.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={profile.pinEnabled}
                  onChange={(e) => setProfile({ ...profile, pinEnabled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    value={profile.securityPin}
                    onChange={(e) => setProfile({ ...profile, securityPin: e.target.value.replace(/\D/g, '') })}
                    placeholder="PIN numérico (4 a 6 dígitos)"
                    className="w-full h-10 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 text-xs font-mono tracking-widest text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveAll()}
                  className="px-4 bg-amber-600 hover:bg-amber-500 text-black font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer"
                >
                  Fijar PIN
                </button>
              </div>
            </div>

            {/* Capas de Ingeniería de Seguridad del Protocolo Oficial */}
            <div className="space-y-2.5">
              <label className="flex items-start justify-between gap-3 p-3 bg-neutral-950 border border-neutral-850 rounded-xl cursor-pointer">
                <div>
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                    Fencing (Cercamiento Anti-Inyección)
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">
                    Bloquea instrucciones maliciosas o prompts ocultos dentro de PDFs/DOCX externos.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={profile.fencingEnabled}
                  onChange={(e) => setProfile({ ...profile, fencingEnabled: e.target.checked })}
                  className="mt-1 accent-emerald-500"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 bg-neutral-950 border border-neutral-850 rounded-xl cursor-pointer">
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block">
                    Aislamiento de Ejecución & No-Entrenamiento
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">
                    Los documentos se procesan como variables pasivas aisladas bajo secreto profesional.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={profile.isolationEnabled}
                  onChange={(e) => setProfile({ ...profile, isolationEnabled: e.target.checked })}
                  className="mt-1 accent-blue-500"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 bg-neutral-950 border border-neutral-850 rounded-xl cursor-pointer">
                <div>
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block">
                    Anonimización Perimetral (Ley Nº 18.331)
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">
                    Protección de datos personales y soberanía del ecosistema en la instancia del profesional.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={profile.anonymizationEnabled}
                  onChange={(e) => setProfile({ ...profile, anonymizationEnabled: e.target.checked })}
                  className="mt-1 accent-purple-500"
                />
              </label>
            </div>
          </div>

          {/* Right: Motor IA Propio (Medidor del Escribano) + Respaldo Soberano */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="text-blue-400" size={16} />
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">
                    Soberanía de IA (Medidor del Estudio)
                  </h2>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold">
                  Instancia Dedicada
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-neutral-400 font-black uppercase tracking-widest block">
                  Clave API de Google Gemini del Estudio (`GEMINI_API_KEY`)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIzaSy... (Usa la clave del servidor si se deja vacío)"
                      className="w-full h-10 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 pr-9 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveAll()}
                    className="px-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-[10px] uppercase tracking-widest cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[8px] text-neutral-500 font-black uppercase tracking-widest flex items-center gap-1">
                    <FileSpreadsheet size={10} /> ID Planilla Google Sheets
                  </label>
                  <input
                    type="text"
                    value={profile.sheetId}
                    onChange={(e) => setProfile({ ...profile, sheetId: e.target.value })}
                    placeholder="Opcional: ID de planilla..."
                    className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-3 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] text-neutral-500 font-black uppercase tracking-widest flex items-center gap-1">
                    <FolderLock size={10} /> ID Carpeta Protocolo Drive
                  </label>
                  <input
                    type="text"
                    value={profile.driveFolderId}
                    onChange={(e) => setProfile({ ...profile, driveFolderId: e.target.value })}
                    placeholder="Opcional: ID carpeta Drive..."
                    className="w-full h-9 bg-neutral-900 border border-neutral-800 rounded-lg px-3 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Respaldo Local Soberano */}
            <div className="bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">
                    Respaldo Soberano del Estudio (PC / Celular)
                  </h3>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    Exporta o restaura tus clientes, notas, adjuntos y ficha del escribano en un archivo privado.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="py-3 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download size={14} className="text-blue-400" />
                  Exportar Respaldo
                </button>
                <button
                  type="button"
                  onClick={() => fileRestoreRef.current?.click()}
                  className="py-3 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload size={14} className="text-emerald-400" />
                  Restaurar Copia
                </button>
                <input
                  type="file"
                  ref={fileRestoreRef}
                  onChange={handleImportBackup}
                  accept=".json,application/json"
                  className="hidden"
                />
              </div>

              {backupNotice && (
                <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-[10px] font-bold text-emerald-400 text-center">
                  {backupNotice}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* SECTION 3: INSTALACIÓN RÁPIDA EN PC Y CELULAR (PWA) */}
      {activeSection === 'instalacion' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Banner de Instalación Directa */}
          <div className="bg-gradient-to-r from-blue-950/40 via-[#0c0c0e] to-emerald-950/30 border border-blue-500/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-[9px] font-tabelion font-black uppercase tracking-[0.2em] text-amber-400">
                APLICACIÓN WEB PROGRESIVA (PWA) • LISTA PARA INSTALAR
              </span>
              <h2 className="text-xl font-tabelion font-black text-white uppercase tracking-[0.1em]">
                Instalar TABELION en este Dispositivo
              </h2>
              <p className="text-xs text-neutral-400 max-w-xl">
                El espacio inteligente del escribano Uruguayo funciona como aplicación nativa independiente en escritorio (Windows / Mac) y en celulares (iPhone / Android), con acceso directo desde tu pantalla de inicio o barra de tareas.
              </p>
            </div>

            {installPromptEvent && onTriggerInstall ? (
              <button
                type="button"
                onClick={onTriggerInstall}
                className="px-6 py-4 bg-white hover:bg-neutral-200 text-black font-black rounded-xl text-xs uppercase tracking-widest flex items-center gap-2.5 shadow-xl shrink-0 cursor-pointer active:scale-95 transition-all"
              >
                <Download size={16} />
                Instalar Ahora (1 Clic)
              </button>
            ) : (
              <div className="px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-[10px] font-bold text-emerald-400 uppercase tracking-wider shrink-0">
                ✓ App Lista en Navegador (Ver guía abajo)
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tarjeta PC */}
            <div className="bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-neutral-800 pb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">
                    Instalación en PC (Windows / Mac)
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase">
                    Google Chrome o Microsoft Edge
                  </p>
                </div>
              </div>
              <ol className="space-y-3 text-xs text-neutral-300 list-decimal list-inside">
                <li>
                  En la barra de direcciones superior derecha del navegador, haz clic en el ícono de <strong>Instalar aplicación</strong> (pantalla con flecha hacia abajo).
                </li>
                <li>
                  Presiona <strong>"Instalar"</strong>. Striker Hub se abrirá en su propia ventana dedicada y creará un acceso directo en tu Escritorio y Barra de Tareas.
                </li>
              </ol>
            </div>

            {/* Tarjeta Celular */}
            <div className="bg-[#0c0c0e] border border-neutral-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-neutral-800 pb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">
                    Instalación en Celular (Android & iPhone)
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase">
                    Acceso directo a pantalla completa
                  </p>
                </div>
              </div>
              <ul className="space-y-3 text-xs text-neutral-300">
                <li>
                  <strong className="text-emerald-400 uppercase text-[10px] tracking-wider block">En Android (Chrome):</strong>
                  Toca el menú de 3 puntos arriba a la derecha y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                </li>
                <li>
                  <strong className="text-blue-400 uppercase text-[10px] tracking-wider block">En iPhone / iPad (Safari):</strong>
                  Toca el botón <strong>Compartir</strong> (cuadrado con flecha hacia arriba) en la barra inferior y selecciona <strong>"Agregar a Inicio"</strong>.
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
