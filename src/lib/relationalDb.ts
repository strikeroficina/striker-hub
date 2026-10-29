// Database interface matching relational design
export interface DbClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  observations: string;
  deleted: boolean;
}

export interface DbNote {
  id: string;
  cliente_id: string;
  text: string;
  date: string; // DD/MM/AAAA
  timestamp: number;
}

export interface DbAttachment {
  id: string;
  cliente_id: string;
  name: string;
  mimeType: string;
  dataUrl: string; // Base64 url
  size: string;
  uploadedAt: string;
}

// UI structure expected by components
export interface AgendaContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  observations: string;
  notes: { id: string; text: string; date: string; timestamp: number }[];
  attachments: { id: string; name: string; mimeType: string; dataUrl: string; size: string; uploadedAt: string }[];
  deleted?: boolean;
}

const SEED_CLIENTS: DbClient[] = [
  {
    id: 'c1',
    name: 'Juan Manuel Pérez',
    email: 'juan.perez@gmail.com',
    phone: '099 123 456',
    observations: 'Cliente histórico del estudio notarial. Consultas recurrentes sobre arrendamientos rurales e hipotecas fluviales.',
    deleted: false
  },
  {
    id: 'c2',
    name: 'María Inés Rodríguez',
    email: 'maria.ines@outlook.com',
    phone: '098 765 432',
    observations: 'Sucesión intestada en trámite de calificación registral. Padrón único en el departamento de Maldonado.',
    deleted: false
  },
  {
    id: 'c3',
    name: 'Constanza Silva Larreta',
    email: 'csilva@larreta.com.uy',
    phone: '094 555 111',
    observations: 'Asesoramiento corporativo independiente. Redacción periódica de actas de asamblea extraordinaria para Sociedad Anónima.',
    deleted: false
  }
];

const SEED_NOTES: DbNote[] = [
  { id: 'n2', cliente_id: 'c1', text: 'Consulta telefónica respecto a plazos de expropiación por obra pública en Ruta Cinco.', date: '12/04/2026', timestamp: 1775952000000 },
  { id: 'n1', cliente_id: 'c1', text: 'Se entregó copia autorizada del contrato de compraventa y plano de mensura.', date: '28/05/2026', timestamp: 1780012800000 },
  { id: 'n3', cliente_id: 'c2', text: 'Reunión de liquidación de herencia y confección de inventario solemne.', date: '21/04/2026', timestamp: 1776728400000 }
];

const KEY_CLIENTS = 'rel_tbl_clientes';
const KEY_NOTES = 'rel_tbl_notas';
const KEY_ATTACHMENTS = 'rel_tbl_adjuntos';

// Initialize tables if they do not exist
function initDb() {
  if (!localStorage.getItem(KEY_CLIENTS)) {
    localStorage.setItem(KEY_CLIENTS, JSON.stringify(SEED_CLIENTS));
  }
  if (!localStorage.getItem(KEY_NOTES)) {
    localStorage.setItem(KEY_NOTES, JSON.stringify(SEED_NOTES));
  }
  if (!localStorage.getItem(KEY_ATTACHMENTS)) {
    localStorage.setItem(KEY_ATTACHMENTS, JSON.stringify([]));
  }
}

// Get raw arrays from local storage
export function getRawClients(): DbClient[] {
  initDb();
  try {
    return JSON.parse(localStorage.getItem(KEY_CLIENTS) || '[]');
  } catch (e) {
    console.error('Error parsing raw clients', e);
    return [];
  }
}

export function getRawNotes(): DbNote[] {
  initDb();
  try {
    return JSON.parse(localStorage.getItem(KEY_NOTES) || '[]');
  } catch (e) {
    console.error('Error parsing raw notes', e);
    return [];
  }
}

export function getRawAttachments(): DbAttachment[] {
  initDb();
  try {
    return JSON.parse(localStorage.getItem(KEY_ATTACHMENTS) || '[]');
  } catch (e) {
    console.error('Error parsing raw attachments', e);
    return [];
  }
}

// Save raw arrays
function saveRawClients(data: DbClient[]) {
  localStorage.setItem(KEY_CLIENTS, JSON.stringify(data));
}

function saveRawNotes(data: DbNote[]) {
  localStorage.setItem(KEY_NOTES, JSON.stringify(data));
}

function saveRawAttachments(data: DbAttachment[]) {
  localStorage.setItem(KEY_ATTACHMENTS, JSON.stringify(data));
}

// API functions performing relational queries
export function dbGetContacts(): AgendaContact[] {
  const clients = getRawClients();
  const notes = getRawNotes();
  const attachments = getRawAttachments();

  return clients.map(client => {
    // Relational join with client_id
    const clientNotes = notes
      .filter(n => n.cliente_id === client.id)
      .sort((a, b) => a.timestamp - b.timestamp); // Ascending chronological order (oldest first)

    const clientAttachments = attachments
      .filter(a => a.cliente_id === client.id);

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      observations: client.observations,
      deleted: client.deleted,
      notes: clientNotes.map(n => ({ id: n.id, text: n.text, date: n.date, timestamp: n.timestamp })),
      attachments: clientAttachments.map(a => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        dataUrl: a.dataUrl,
        size: a.size,
        uploadedAt: a.uploadedAt
      }))
    };
  });
}

export function dbInsertContact(contact: Omit<DbClient, 'deleted'>) {
  const clients = getRawClients();
  const newClient: DbClient = {
    ...contact,
    deleted: false
  };
  clients.push(newClient);
  saveRawClients(clients);
  return newClient;
}

export function dbUpdateContact(id: string, updates: Partial<Omit<DbClient, 'id' | 'deleted'>>) {
  const clients = getRawClients();
  let updatedClient: DbClient | null = null;
  const newClients = clients.map(c => {
    if (c.id === id) {
      updatedClient = { ...c, ...updates };
      return updatedClient;
    }
    return c;
  });
  saveRawClients(newClients);
  return updatedClient;
}

export function dbDeleteContact(id: string) {
  const clients = getRawClients();
  const newClients = clients.map(c => {
    if (c.id === id) {
      return { ...c, deleted: true };
    }
    return c;
  });
  saveRawClients(newClients);
}

export function dbInsertNote(note: Omit<DbNote, 'id'>) {
  const notes = getRawNotes();
  const newNote: DbNote = {
    ...note,
    id: 'n_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
  };
  notes.push(newNote);
  saveRawNotes(notes);
  return newNote;
}

export function dbInsertAttachment(attachment: Omit<DbAttachment, 'id'>) {
  const attachments = getRawAttachments();
  const newAttachment: DbAttachment = {
    ...attachment,
    id: 'a_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
  };
  attachments.push(newAttachment);
  saveRawAttachments(attachments);
  return newAttachment;
}

export function dbDeleteAttachment(id: string) {
  const attachments = getRawAttachments();
  const newAttachments = attachments.filter(a => a.id !== id);
  saveRawAttachments(newAttachments);
}
