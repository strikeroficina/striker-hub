export interface NotaryProfile {
  fullName: string;
  title: 'Escribano Público' | 'Escribana Pública' | 'Abogado / Escribano';
  matricula: string;
  rut: string;
  officeName: string;
  city: string;
  department: string;
  specialty: string;
  phone: string;
  email: string;
  address: string;
  reportFooter: string;
  sheetId: string;
  driveFolderId: string;
  // Seguridad y Protección de Datos (Protocolo Tabelion // Striker IA - Ley 18.331)
  pinEnabled: boolean;
  securityPin: string;
  fencingEnabled: boolean;
  anonymizationEnabled: boolean;
  isolationEnabled: boolean;
  updatedAt: string;
}

const STORAGE_KEY = 'striker_notary_profile_v1';

export const URUGUAY_DEPARTMENTS = [
  'Montevideo',
  'Maldonado',
  'Canelones',
  'Colonia',
  'Rocha',
  'San José',
  'Salto',
  'Paysandú',
  'Rivera',
  'Tacuarembó',
  'Lavalleja',
  'Florida',
  'Soriano',
  'Río Negro',
  'Cerro Largo',
  'Durazno',
  'Treinta y Tres',
  'Artigas',
  'Flores'
];

export const DEFAULT_NOTARY_PROFILE: NotaryProfile = {
  fullName: 'Titular del Estudio',
  title: 'Escribano Público',
  matricula: '',
  rut: '',
  officeName: 'Estudio Notarial • Tabelion',
  city: 'Montevideo',
  department: 'Montevideo',
  specialty: 'Compraventas, Sucesiones, Propiedad Horizontal y Arrendamientos',
  phone: '',
  email: 'strikeroficina@gmail.com',
  address: '',
  reportFooter: 'Dictamen técnico emitido en TABELION (El espacio inteligente del escribano Uruguayo) bajo supervisión profesional • Secreto Profesional (Ley 18.331).',
  sheetId: '',
  driveFolderId: '',
  pinEnabled: false,
  securityPin: '',
  fencingEnabled: true,
  anonymizationEnabled: true,
  isolationEnabled: true,
  updatedAt: new Date().toISOString()
};

export function getNotaryProfile(): NotaryProfile {
  if (typeof window === 'undefined') return DEFAULT_NOTARY_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTARY_PROFILE;
    const parsed = JSON.parse(raw);
    if (parsed.officeName === 'Escribanía Digital Striker') {
      parsed.officeName = DEFAULT_NOTARY_PROFILE.officeName;
    }
    return {
      ...DEFAULT_NOTARY_PROFILE,
      ...parsed
    };
  } catch (e) {
    console.error('Error reading notary profile:', e);
    return DEFAULT_NOTARY_PROFILE;
  }
}

export function saveNotaryProfile(profile: Partial<NotaryProfile>): NotaryProfile {
  const current = getNotaryProfile();
  const updated: NotaryProfile = {
    ...current,
    ...profile,
    updatedAt: new Date().toISOString()
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('elo-profile-updated', { detail: updated }));
  }
  return updated;
}

export function formatNotaryDisplayTitle(profile: NotaryProfile): string {
  const prefix = profile.title === 'Escribana Pública' ? 'Esc.' : 'Esc.';
  const name = profile.fullName?.trim() || 'Escribano Actuante';
  const cleanName = name.replace(/^esc\.?\s*/i, '');
  const mat = profile.matricula?.trim() ? ` (Mat. ${profile.matricula.trim()})` : '';
  return `${prefix} ${cleanName}${mat}`;
}

export function exportStudioBackup(): string {
  const payload = {
    version: '2026.3-TABELION',
    exportedAt: new Date().toISOString(),
    notaryProfile: getNotaryProfile(),
    clients: JSON.parse(localStorage.getItem('rel_tbl_clientes') || '[]'),
    notes: JSON.parse(localStorage.getItem('rel_tbl_notas') || '[]'),
    attachments: JSON.parse(localStorage.getItem('rel_tbl_adjuntos') || '[]'),
    indices: JSON.parse(localStorage.getItem('_fs_doc:config_sistema/indices_notariales') || 'null')
  };
  return JSON.stringify(payload, null, 2);
}

export function importStudioBackup(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;
    if (data.notaryProfile) {
      saveNotaryProfile(data.notaryProfile);
    }
    if (Array.isArray(data.clients)) {
      localStorage.setItem('rel_tbl_clientes', JSON.stringify(data.clients));
    }
    if (Array.isArray(data.notes)) {
      localStorage.setItem('rel_tbl_notas', JSON.stringify(data.notes));
    }
    if (Array.isArray(data.attachments)) {
      localStorage.setItem('rel_tbl_adjuntos', JSON.stringify(data.attachments));
    }
    if (data.indices) {
      localStorage.setItem('_fs_doc:config_sistema/indices_notariales', JSON.stringify(data.indices));
    }
    window.dispatchEvent(new CustomEvent('elo-agenda-updated'));
    return true;
  } catch (e) {
    console.error('Error importing studio backup:', e);
    return false;
  }
}
