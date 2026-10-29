import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogIn, Loader2, Bot, KeyRound, Globe, AlertTriangle, Lock, Settings, Download } from 'lucide-react';
import { db, doc, onSnapshot, getDoc, setDoc } from './lib/firebase';
import { invoke } from '@tauri-apps/api/core';

interface AppUser {
  uid: string;
  displayName: string;
  email?: string;
  photoURL?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { Sidebar } from './components/Sidebar';
import { ChatWidget } from './components/ChatWidget';
import { DashboardOverview } from './components/DashboardOverview';
import { ClientManagement } from './components/ClientManagement';
import { AuditModule } from './components/AuditModule';
import { Calculator } from './components/Calculator';
import { NotarySettings } from './components/NotarySettings';
import { getNotaryProfile, NotaryProfile, formatNotaryDisplayTitle } from './lib/notaryProfile';
import { motion, AnimatePresence } from 'motion/react';
import { Message } from './types';

// Valores oficiales verificados INE / BCU Uruguay
const DEFAULT_INDICES = {
  ui: 6.6803,
  ur: 1946.95,
  ura: 1939.40,
  dolar_interbancario: 40.14,
  dolar_pizarra_compra: 38.90,
  dolar_pizarra_venta: 41.40
};

// Valores antiguos de prueba que deben actualizarse automáticamente si quedaron en localStorage
const STALE_UI_VALUES = new Set([6.4521, 6.5521, 6.9427]);
const STALE_UR_VALUES = new Set([1854.80, 1984.50, 1985.30]);
const STALE_URA_VALUES = new Set([1682.40, 1758.20, 1820.25]);

// Clean helper to format numeric values with es-UY standard formatting
const formatCurrencyValue = (val: number, decimals: number) => {
  return `$${val.toLocaleString('es-UY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [notaryProfile, setNotaryProfile] = useState<NotaryProfile>(() => getNotaryProfile());
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const p = getNotaryProfile();
    return Boolean(p.pinEnabled && p.securityPin);
  });
  const [pinAttempt, setPinAttempt] = useState('');
  const [pinError, setPinError] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  const [clientId, setClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');
  const [clientSecret, setClientSecret] = useState(import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '');
  const [gcpProjectId, setGcpProjectId] = useState(import.meta.env.VITE_GCP_PROJECT_ID || '');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reportContext, setReportContext] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'model', parts: [{ text: '**TABELION ACTIVO.**\nManual de Calificación DGR e índices BCU/INE sincronizados. Listo para auditar documentos, liquidar impuestos o gestionar la Agenda.' }] }
  ]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Dynamic Dolar rate from real-time API (independent of Firestore)
  const [externalUSD, setExternalUSD] = useState<number>(DEFAULT_INDICES.dolar_interbancario);

  // Reactive UI, UR, URA values loaded from Firestore indices doc
  const [firestoreVals, setFirestoreVals] = useState<{ ui: number; ur: number; ura: number }>({
    ui: DEFAULT_INDICES.ui,
    ur: DEFAULT_INDICES.ur,
    ura: DEFAULT_INDICES.ura
  });

  // Indicators State (Merged cleanly in real-time)
  const [systemIndices, setSystemIndices] = useState<{
    dolarInter: string;
    dolarCompra: string;
    dolarVenta: string;
    ui: string;
    ur: string;
    ura: string;
  } | null>(null);
  const [indicesLoading, setIndicesLoading] = useState(true);

  // Listen for Notary Profile changes and PWA beforeinstallprompt
  useEffect(() => {
    const handleProfileUpdate = () => {
      setNotaryProfile(getNotaryProfile());
    };
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('elo-profile-updated', handleProfileUpdate);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('elo-profile-updated', handleProfileUpdate);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleTriggerInstall = async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } else {
      setActiveTab('settings');
    }
  };

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinAttempt === notaryProfile.securityPin) {
      setIsLocked(false);
      setPinAttempt('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinAttempt('');
    }
  };

  // Combine live externalUSD with firestoreVals to update systemIndices
  useEffect(() => {
    const dInter = externalUSD;
    const dCompra = dInter - 1.25;
    const dVenta = dInter + 1.25;

    setSystemIndices({
      dolarInter: formatCurrencyValue(dInter, 2),
      dolarCompra: formatCurrencyValue(dCompra, 2),
      dolarVenta: formatCurrencyValue(dVenta, 2),
      ui: formatCurrencyValue(firestoreVals.ui, 4),
      ur: formatCurrencyValue(firestoreVals.ur, 2),
      ura: formatCurrencyValue(firestoreVals.ura, 2)
    });
  }, [externalUSD, firestoreVals]);

  // Dynamic live-fetch loader for USD and official backend indices
  const fetchLiveUSDRate = async (): Promise<number> => {
    try {
      const apiRes = await fetch("/api/indices");
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData?.dolar_interbancario) {
          setExternalUSD(Number(apiData.dolar_interbancario));
          if (apiData.ui && apiData.ur && apiData.ura) {
            setFirestoreVals({
              ui: Number(apiData.ui),
              ur: Number(apiData.ur),
              ura: Number(apiData.ura)
            });
          }
          return Number(apiData.dolar_interbancario);
        }
      }
    } catch {
      // Fallback to direct open.er-api fetch if backend route isn't used
    }

    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.UYU) {
          const uyuRate = Number(Number(data.rates.UYU).toFixed(2));
          setExternalUSD(uyuRate);
          return uyuRate;
        }
      }
    } catch (e) {
      console.error("Error loading real-time dollar from API:", e);
    }
    return DEFAULT_INDICES.dolar_interbancario;
  };

  // Permite a ELO o al escribano actualizar valores puntuales de UI, UR, URA o Dólar
  const handleUpdateCustomIndices = async (vals: { ui?: number; ur?: number; ura?: number; usd?: number }) => {
    const nextUi = vals.ui && vals.ui > 0 ? vals.ui : firestoreVals.ui;
    const nextUr = vals.ur && vals.ur > 0 ? vals.ur : firestoreVals.ur;
    const nextUra = vals.ura && vals.ura > 0 ? vals.ura : firestoreVals.ura;
    const nextUsd = vals.usd && vals.usd > 0 ? vals.usd : externalUSD;

    setFirestoreVals({ ui: nextUi, ur: nextUr, ura: nextUra });
    setExternalUSD(nextUsd);

    try {
      const docRef = doc(db, "config_sistema", "indices_notariales");
      await setDoc(docRef, {
        ui: nextUi,
        ur: nextUr,
        ura: nextUra,
        dolar_interbancario: nextUsd,
        dolar_pizarra_compra: Number((nextUsd - 1.25).toFixed(2)),
        dolar_pizarra_venta: Number((nextUsd + 1.25).toFixed(2))
      });
      await fetch("/api/indices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ui: nextUi,
          ur: nextUr,
          ura: nextUra,
          dolar_interbancario: nextUsd
        })
      }).catch(() => {});
    } catch (err) {
      console.error("Error updating custom indices:", err);
    }
  };

  // Fallback trigger/sync action reads directly from config_sistema inside Firestore and live API URL
  const fetchAllIndices = async () => {
    setIndicesLoading(true);
    let docSnap;
    const docRef = doc(db, "config_sistema", "indices_notariales");
    try {
      // 1. Fetch live dollar & server indices
      await fetchLiveUSDRate();

      // 2. Load UI, UR, URA from Firestore
      try {
        docSnap = await getDoc(docRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "config_sistema/indices_notariales");
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        let uiVal = typeof data.ui === 'number' ? data.ui : DEFAULT_INDICES.ui;
        let urVal = typeof data.ur === 'number' ? data.ur : DEFAULT_INDICES.ur;
        let uraVal = typeof data.ura === 'number' ? data.ura : DEFAULT_INDICES.ura;

        if (STALE_UI_VALUES.has(uiVal)) uiVal = DEFAULT_INDICES.ui;
        if (STALE_UR_VALUES.has(urVal)) urVal = DEFAULT_INDICES.ur;
        if (STALE_URA_VALUES.has(uraVal)) uraVal = DEFAULT_INDICES.ura;

        setFirestoreVals({
          ui: uiVal,
          ur: urVal,
          ura: uraVal
        });
      } else {
        try {
          await setDoc(docRef, {
            ui: DEFAULT_INDICES.ui,
            ur: DEFAULT_INDICES.ur,
            ura: DEFAULT_INDICES.ura,
            dolar_interbancario: DEFAULT_INDICES.dolar_interbancario,
            dolar_pizarra_compra: DEFAULT_INDICES.dolar_pizarra_compra,
            dolar_pizarra_venta: DEFAULT_INDICES.dolar_pizarra_venta
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, "config_sistema/indices_notariales");
        }
        setFirestoreVals({
          ui: DEFAULT_INDICES.ui,
          ur: DEFAULT_INDICES.ur,
          ura: DEFAULT_INDICES.ura
        });
      }
    } catch (err) {
      console.error("Manual Firestore indices reader failed:", err);
    } finally {
      setIndicesLoading(false);
    }
  };

  // Set up real-time listener (onSnapshot) to system indices and fetch live USD on mount
  useEffect(() => {
    fetchLiveUSDRate();

    if (!user) {
      setIndicesLoading(false);
      return;
    }

    setIndicesLoading(true);
    const docRef = doc(db, "config_sistema", "indices_notariales");

    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          let uiVal = typeof data.ui === 'number' ? data.ui : DEFAULT_INDICES.ui;
          let urVal = typeof data.ur === 'number' ? data.ur : DEFAULT_INDICES.ur;
          let uraVal = typeof data.ura === 'number' ? data.ura : DEFAULT_INDICES.ura;

          // Auto-upgrade if DB contains old mock/placeholder values to match verified BCU/INE values
          if (STALE_UI_VALUES.has(uiVal) || STALE_UR_VALUES.has(urVal) || STALE_URA_VALUES.has(uraVal)) {
            uiVal = STALE_UI_VALUES.has(uiVal) ? DEFAULT_INDICES.ui : uiVal;
            urVal = STALE_UR_VALUES.has(urVal) ? DEFAULT_INDICES.ur : urVal;
            uraVal = STALE_URA_VALUES.has(uraVal) ? DEFAULT_INDICES.ura : uraVal;
            try {
              await setDoc(docRef, {
                ui: uiVal,
                ur: urVal,
                ura: uraVal,
                dolar_interbancario: DEFAULT_INDICES.dolar_interbancario,
                dolar_pizarra_compra: DEFAULT_INDICES.dolar_pizarra_compra,
                dolar_pizarra_venta: DEFAULT_INDICES.dolar_pizarra_venta
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, "config_sistema/indices_notariales");
            }
          }

          setFirestoreVals({
            ui: uiVal,
            ur: urVal,
            ura: uraVal
          });
          setIndicesLoading(false);
        } else {
          try {
            await setDoc(docRef, {
              ui: DEFAULT_INDICES.ui,
              ur: DEFAULT_INDICES.ur,
              ura: DEFAULT_INDICES.ura,
              dolar_interbancario: DEFAULT_INDICES.dolar_interbancario,
              dolar_pizarra_compra: DEFAULT_INDICES.dolar_pizarra_compra,
              dolar_pizarra_venta: DEFAULT_INDICES.dolar_pizarra_venta
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, "config_sistema/indices_notariales");
          }
        }
      } catch (err) {
        console.error("Error updates snapshot listener:", err);
        setIndicesLoading(false);
      }
    }, (error) => {
      console.error("Firestore onSnapshot indices subscription error:", error);
      setIndicesLoading(false);
      handleFirestoreError(error, OperationType.GET, "config_sistema/indices_notariales");
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const lastReport = localStorage.getItem('last_audit_report');
    if (lastReport) setReportContext(lastReport);
  }, []);

  const updateReportContext = (report: string) => {
    setReportContext(report);
    localStorage.setItem('last_audit_report', report);
  };

  useEffect(() => {
    // Check login status on mount
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) {
      const saved = localStorage.getItem('_fs_mock_user_logged_in');
      // Default to logged in on local web environment unless explicitly signed out
      if (saved !== 'false') {
        localStorage.setItem('_fs_mock_user_logged_in', 'true');
        const p = getNotaryProfile();
        setUser({
          uid: "escribano-striker-dev",
          displayName: formatNotaryDisplayTitle(p),
          email: p.email || "strikeroficina@gmail.com",
          photoURL: ""
        });
      }
      setLoading(false);
      return;
    }

    invoke<{ logged_in: boolean; email?: string; name?: string; picture?: string; user_id?: string }>("check_login_status")
      .then((status) => {
        if (status.logged_in) {
          setUser({
            uid: status.user_id || "gcp-user",
            displayName: status.name || "Escribano Actuante",
            email: status.email || "",
            photoURL: status.picture || ""
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error checking login status:", err);
        setLoading(false);
      });
  }, []);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (!isTauri) {
        await new Promise(resolve => setTimeout(resolve, 400));
        localStorage.setItem('_fs_mock_user_logged_in', 'true');
        const p = getNotaryProfile();
        setUser({
          uid: "escribano-striker-dev",
          displayName: formatNotaryDisplayTitle(p),
          email: p.email || "strikeroficina@gmail.com",
          photoURL: ""
        });
        return;
      }

      if (!clientId.trim() || !clientSecret.trim()) {
        setAuthError("El Client ID y el Client Secret son obligatorios en modo escritorio.");
        return;
      }

      await invoke("start_login_flow", {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        projectId: gcpProjectId.trim() || null
      });

      const status = await invoke<{ logged_in: boolean; email?: string; name?: string; picture?: string; user_id?: string }>("check_login_status");
      setUser({
        uid: status.user_id || "gcp-user",
        displayName: status.name || "Escribano Actuante",
        email: status.email || "",
        photoURL: status.picture || ""
      });
    } catch (err: any) {
      setAuthError(String(err.message || err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (!isTauri) {
        localStorage.setItem('_fs_mock_user_logged_in', 'false');
        setUser(null);
        setActiveTab('dashboard');
        return;
      }
      await invoke("logout");
      setUser(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-brand-bg gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin"></div>
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-tabelion font-black text-lg tabelion-gold-text">T</span>
        </div>
        <p className="text-slate-400 font-mono text-xs tracking-widest animate-pulse">INICIANDO TABELION • URUGUAY...</p>
      </div>
    );
  }

  // PANTALLA DE BLOQUEO DE SEGURIDAD POR PIN NOTARIAL
  if (user && isLocked && notaryProfile.pinEnabled && notaryProfile.securityPin) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#09090b] p-6 font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full bg-[#0c0c0e] border border-neutral-800 p-8 rounded-[2rem] space-y-6 text-center shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-60"></div>
          <div className="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400">
            <Lock size={30} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {notaryProfile.officeName || 'Estudio Protegido'}
            </h2>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
              {formatNotaryDisplayTitle(notaryProfile)} • Bloqueo Activo
            </p>
          </div>

          <form onSubmit={handleUnlockPin} className="space-y-4">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={pinAttempt}
              onChange={(e) => {
                setPinError(false);
                setPinAttempt(e.target.value.replace(/\D/g, ''));
              }}
              placeholder="INGRESAR PIN"
              className="w-full h-12 bg-neutral-900 border border-neutral-800 rounded-xl text-center text-lg font-mono font-black tracking-[0.4em] text-white focus:outline-none focus:border-amber-500"
            />
            {pinError && (
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                PIN incorrecto. Intente nuevamente.
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black font-black rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
            >
              Desbloquear Sistema
            </button>
          </form>

          <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">
            TABELION • Protocolo de Seguridad Striker IA (Ley 18.331)
          </p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#08080a] p-6 font-sans overflow-y-auto">
        <div className="max-w-md w-full bg-[#0c0c0f] border border-neutral-800 p-8 rounded-[2rem] space-y-6 text-center relative overflow-hidden shadow-2xl my-8">
          <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent opacity-60"></div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-neutral-950 border border-amber-500/40 rounded-[1.2rem] flex items-center justify-center shadow-2xl shadow-amber-500/15">
              <span className="font-tabelion font-black text-3xl tabelion-gold-text">T</span>
            </div>
            <div>
              <h1 className="text-3xl font-tabelion font-black tracking-[0.2em] text-white uppercase">TABELION</h1>
              <p className="text-amber-400 font-bold tracking-[0.22em] text-[9px] uppercase mt-1.5">El espacio inteligente del escribano Uruguayo</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-neutral-400 text-xs leading-relaxed max-w-[300px] mx-auto">
              Configura tus credenciales o ingresa directamente al espacio de trabajo notarial.
            </p>
          </div>

          <div className="space-y-4 text-left pt-2">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider block">Google OAuth Client ID</label>
              <div className="relative flex items-center bg-neutral-900/60 border border-neutral-800 focus-within:border-blue-500/80 rounded-xl px-3 py-2.5 transition-all">
                <KeyRound size={14} className="text-neutral-600 mr-2 shrink-0" />
                <input 
                  type="text" 
                  placeholder="2345678-xxxx.apps.googleusercontent.com"
                  className="w-full bg-transparent border-none focus:outline-none text-[11px] text-white placeholder:text-neutral-700 font-medium"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={authLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider block">Google OAuth Client Secret</label>
              <div className="relative flex items-center bg-neutral-900/60 border border-neutral-800 focus-within:border-blue-500/80 rounded-xl px-3 py-2.5 transition-all">
                <KeyRound size={14} className="text-neutral-600 mr-2 shrink-0" />
                <input 
                  type="password" 
                  placeholder="GOCSPX-xxxxxxxxxxxxxxxxx"
                  className="w-full bg-transparent border-none focus:outline-none text-[11px] text-white placeholder:text-neutral-700 font-mono"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  disabled={authLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider block">Google Cloud Project ID</label>
                <span className="text-[8px] text-neutral-700 uppercase font-black tracking-widest">Opcional (Vertex AI)</span>
              </div>
              <div className="relative flex items-center bg-neutral-900/60 border border-neutral-800 focus-within:border-blue-500/80 rounded-xl px-3 py-2.5 transition-all">
                <Globe size={14} className="text-neutral-600 mr-2 shrink-0" />
                <input 
                  type="text" 
                  placeholder="mi-proyecto-gcp-1234"
                  className="w-full bg-transparent border-none focus:outline-none text-[11px] text-white placeholder:text-neutral-700 font-medium"
                  value={gcpProjectId}
                  onChange={(e) => setGcpProjectId(e.target.value)}
                  disabled={authLoading}
                />
              </div>
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl flex items-start gap-2.5 text-red-400 text-left text-[11px] leading-normal font-medium">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white disabled:bg-neutral-800 text-black disabled:text-neutral-500 hover:bg-neutral-200 font-black rounded-xl transition-all active:scale-95 shadow-xl uppercase tracking-wider text-xs"
          >
            {authLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                <LogIn size={14} />
                Ingresar a TABELION
              </>
            )}
          </button>

          <div className="pt-2 flex flex-col gap-1 text-[9px] text-neutral-600 font-bold uppercase tracking-wider">
            <span>Acceso directo habilitado para el estudio notarial.</span>
            <span className="text-[8px] text-neutral-700 mt-1 font-tabelion font-black tracking-widest">TABELION • BY STRIKER IA</span>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardOverview indices={systemIndices} loading={indicesLoading} onRefresh={fetchAllIndices} onNavigate={setActiveTab} />;
      case 'clients': return <ClientManagement user={user} />;
      case 'audit': return <AuditModule onAuditComplete={updateReportContext} />;
      case 'calculator': return <Calculator onCalculationComplete={updateReportContext} onRefreshIndices={fetchAllIndices} systemIndices={systemIndices} />;
      case 'settings': return (
        <NotarySettings
          onProfileChange={(updated) => {
            setNotaryProfile(updated);
            setUser((prev) => prev ? { ...prev, displayName: formatNotaryDisplayTitle(updated), email: updated.email } : prev);
          }}
          onLockNow={() => setIsLocked(true)}
          installPromptEvent={installPromptEvent}
          onTriggerInstall={handleTriggerInstall}
        />
      );
      case 'chat': return (
        <ChatWidget 
          isFloating={false} 
          auditContext={reportContext}
          messages={chatMessages}
          setMessages={setChatMessages}
          isOpen={true}
          setIsOpen={() => {}} 
          dolarInter={systemIndices?.dolarInter}
          ui={systemIndices?.ui}
          ur={systemIndices?.ur}
          ura={systemIndices?.ura}
          activeTab={activeTab}
          onRefreshIndices={fetchAllIndices}
          onUpdateCustomIndices={handleUpdateCustomIndices}
          onNavigateTab={setActiveTab}
        />
      );
      default: return <DashboardOverview indices={systemIndices} loading={indicesLoading} onRefresh={fetchAllIndices} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="h-screen w-full bg-brand-bg text-slate-100 overflow-hidden relative">
      <div className="flex flex-col md:flex-row h-full w-full">
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#dde4ee] border-b border-[#c5d0de] shrink-0 no-print">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 bg-[#0f172a] rounded-lg flex items-center justify-center font-tabelion font-bold text-white text-xs shrink-0">
              T
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-tabelion font-bold text-[#0f172a] uppercase tracking-[0.15em] truncate">
                TABELION
              </p>
              <p className="text-[9px] text-[#475569] font-bold uppercase tracking-wider truncate">
                {formatNotaryDisplayTitle(notaryProfile)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleTriggerInstall}
              className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-400"
              title="Instalar App"
            >
              <Download size={15} />
            </button>
            {notaryProfile.pinEnabled && notaryProfile.securityPin && (
              <button
                onClick={() => setIsLocked(true)}
                className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-400"
                title="Bloquear pantalla"
              >
                <Lock size={15} />
              </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300"
              title="Datos del Escribano"
            >
              <Settings size={15} />
            </button>
          </div>
        </header>

        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onSignOut={handleSignOut}
          user={user}
          notaryProfile={notaryProfile}
          onLockNow={() => setIsLocked(true)}
          onInstallClick={handleTriggerInstall}
        />
        
        <main className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Main View Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="min-h-full flex flex-col"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Floating Chat Widget (Self-managed bubble/window) */}
      {activeTab !== 'chat' && (
        <ChatWidget 
          isFloating={true} 
          auditContext={reportContext}
          messages={chatMessages}
          setMessages={setChatMessages}
          isOpen={isChatOpen}
          setIsOpen={setIsChatOpen}
          dolarInter={systemIndices?.dolarInter}
          ui={systemIndices?.ui}
          ur={systemIndices?.ur}
          ura={systemIndices?.ura}
          activeTab={activeTab}
          onRefreshIndices={fetchAllIndices}
          onUpdateCustomIndices={handleUpdateCustomIndices}
          onNavigateTab={setActiveTab}
        />
      )}
    </div>
  );
}
