import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Search, 
  Mail, 
  Phone, 
  Trash2, 
  FileText, 
  Download, 
  Plus, 
  X, 
  AlertCircle, 
  File, 
  UploadCloud, 
  ChevronRight,
  PlusCircle,
  FileCheck2,
  ExternalLink,
  BookOpen,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc } from '../lib/firebase';

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

import {
  dbGetContacts,
  dbInsertContact,
  dbUpdateContact,
  dbDeleteContact,
  dbInsertNote,
  dbInsertAttachment,
  dbDeleteAttachment,
  AgendaContact
} from '../lib/relationalDb';

type AgendaNote = AgendaContact['notes'][number];
type AgendaAttachment = AgendaContact['attachments'][number];

interface ClientManagementProps {
  user: { uid: string; displayName?: string; email?: string; photoURL?: string } | null;
}

export const ClientManagement: React.FC<ClientManagementProps> = ({ user }) => {
  const [contacts, setContacts] = useState<AgendaContact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  // New Client Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    observations: ''
  });

  // Edit Client Form states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    observations: ''
  });

  // Custom confirmation modals states to bypass native confirm() iframe blockage
  const [contactToDelete, setContactToDelete] = useState<AgendaContact | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Note/Activity state
  const [newNoteText, setNewNoteText] = useState('');
  
  // File upload state & Dragover UI indicators
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to sync to firestore if logged in (mock sync)
  const syncContactToCloud = async (contact: AgendaContact) => {
    if (!user) return;
    try {
      const contactRef = doc(db, 'users', user.uid, 'agenda_contactos', contact.id);
      await setDoc(contactRef, {
        id: contact.id,
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        observations: contact.observations || '',
        notes: contact.notes || [],
        attachments: contact.attachments || [],
        deleted: contact.deleted || false
      });
    } catch (err) {
      console.error("Firestore synchronization error:", err);
    }
  };

  // Initialize and load from local storage
  const loadContactsFromDb = () => {
    const list = dbGetContacts();
    setContacts(list);
    const visible = list.filter(c => !c.deleted);
    if (visible.length > 0 && !selectedContactId) {
      setSelectedContactId(visible[0].id);
    }
  };

  useEffect(() => {
    loadContactsFromDb();

    const handleAgendaUpdated = (e: Event) => {
      const customEv = e as CustomEvent<{ selectId?: string }>;
      const list = dbGetContacts();
      setContacts(list);
      if (customEv.detail?.selectId) {
        setSelectedContactId(customEv.detail.selectId);
      } else {
        const visible = list.filter(c => !c.deleted);
        if (visible.length > 0 && (!selectedContactId || !visible.some(v => v.id === selectedContactId))) {
          setSelectedContactId(visible[0].id);
        }
      }
    };
    window.addEventListener('elo-agenda-updated', handleAgendaUpdated);

    if (user) {
      (async () => {
        try {
          const { collection, getDocs, query } = await import('../lib/firebase');
          const q = query(collection(db, 'users', user.uid, 'agenda_contactos'));
          
          let snapshot;
          try {
            snapshot = await getDocs(q);
          } catch (err) {
            console.error(err);
          }

          const cloudContacts: AgendaContact[] = [];
          if (snapshot) {
            snapshot.forEach((docSnap) => {
              cloudContacts.push(docSnap.data() as AgendaContact);
            });
          }
          
          if (cloudContacts.length > 0) {
            // Sync with local DB if needed
          }
        } catch (e) {
          console.error("Error fetching or seeding agenda from Firestore:", e);
        }
      })();
    }

    return () => {
      window.removeEventListener('elo-agenda-updated', handleAgendaUpdated);
    };
  }, [user]);

  // Helper date DD/MM/AAAA
  const getFormattedDate = (): string => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    // Year fixed to 2026 baseline
    const year = 2026; 
    return `${day}/${month}/${year}`;
  };

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Create Client Action
  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newClient = dbInsertContact({
      id: 'c_' + Date.now(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      observations: formData.observations.trim()
    });

    const updatedList = dbGetContacts();
    setContacts(updatedList);
    
    // Sync to cloud if user is logged in
    const contactFull = updatedList.find(c => c.id === newClient.id);
    if (contactFull) {
      syncContactToCloud(contactFull);
    }
    
    setIsModalOpen(false);
    setFormData({ name: '', email: '', phone: '', observations: '' });
    setSelectedContactId(newClient.id);
  };

  // Start Editing Client Profile
  const handleStartEdit = (contact: AgendaContact) => {
    setEditFormData({
      id: contact.id,
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      observations: contact.observations || ''
    });
    setIsEditModalOpen(true);
  };

  // Confirm and Save Client Edit
  const handleUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name.trim()) return;

    dbUpdateContact(editFormData.id, {
      name: editFormData.name.trim(),
      email: editFormData.email.trim(),
      phone: editFormData.phone.trim(),
      observations: editFormData.observations.trim()
    });

    const updatedList = dbGetContacts();
    setContacts(updatedList);
    
    const contactFull = updatedList.find(c => c.id === editFormData.id);
    if (contactFull) {
      syncContactToCloud(contactFull);
    }

    setIsEditModalOpen(false);
  };

  // Delete Entire Contact (Logical Soft Delete Modals)
  const handleDeleteContactRequest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = contacts.find(c => c.id === id);
    if (target) {
      setContactToDelete(target);
    }
  };

  const handleConfirmDeleteContact = () => {
    if (!contactToDelete) return;
    const id = contactToDelete.id;

    dbDeleteContact(id);

    const updatedList = dbGetContacts();
    setContacts(updatedList);

    const contactFull = updatedList.find(c => c.id === id);
    if (contactFull) {
      syncContactToCloud(contactFull);
    }

    if (selectedContactId === id) {
      const remaining = updatedList.filter(c => !c.deleted);
      setSelectedContactId(remaining.length > 0 ? remaining[0].id : null);
    }
    setContactToDelete(null);
  };

  // Add Comment/Observation note chronologically ascending (ZONA A)
  const handleAddNote = () => {
    if (!newNoteText.trim() || !selectedContactId) return;

    dbInsertNote({
      cliente_id: selectedContactId,
      text: newNoteText.trim(),
      date: getFormattedDate(),
      timestamp: Date.now()
    });

    const updatedList = dbGetContacts();
    setContacts(updatedList);

    const contactFull = updatedList.find(c => c.id === selectedContactId);
    if (contactFull) {
      syncContactToCloud(contactFull);
    }
    setNewNoteText('');
  };

  // Base64 helper for attachment processing (ZONA B)
  const processFiles = (fileList: FileList) => {
    if (!selectedContactId) return;
    setFileError(null);

    Array.from(fileList).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isAllowed = extension === 'pdf' || extension === 'docx';
      
      if (!isAllowed) {
        setFileError("Formato de archivo no soportado. Por favor, suba únicamente documentos en formato PDF o Word (.docx).");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Url = e.target?.result as string;
        if (!base64Url) return;

        dbInsertAttachment({
          cliente_id: selectedContactId,
          name: file.name,
          mimeType: file.type || (extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          dataUrl: base64Url,
          size: formatBytes(file.size),
          uploadedAt: getFormattedDate()
        });

        const updatedList = dbGetContacts();
        setContacts(updatedList);

        const contactFull = updatedList.find(c => c.id === selectedContactId);
        if (contactFull) {
          syncContactToCloud(contactFull);
        }
      };

      reader.onerror = () => {
        setFileError("Ocurrió un error al leer el archivo. Inténtelo nuevamente.");
      };

      reader.readAsDataURL(file);
    });
  };

  // Delete single attachment Request
  const handleDeleteAttachmentRequest = (attachmentId: string) => {
    if (!selectedContactId) return;
    const contact = contacts.find(c => c.id === selectedContactId);
    if (!contact) return;
    const attachment = contact.attachments.find(a => a.id === attachmentId);
    if (attachment) {
      setAttachmentToDelete({ id: attachment.id, name: attachment.name });
    }
  };

  const handleConfirmDeleteAttachment = () => {
    if (!attachmentToDelete || !selectedContactId) return;
    const attachmentId = attachmentToDelete.id;

    dbDeleteAttachment(attachmentId);

    const updatedList = dbGetContacts();
    setContacts(updatedList);

    const contactFull = updatedList.find(c => c.id === selectedContactId);
    if (contactFull) {
      syncContactToCloud(contactFull);
    }
    setAttachmentToDelete(null);
  };

  // Decode Base64 data and open Document safely via Object URL
  const handleOpenDocument = (file: AgendaAttachment) => {
    try {
      const parts = file.dataUrl.split(',');
      if (parts.length < 2) {
        alert("No se pudo decodificar el formato del archivo adjunto.");
        return;
      }
      const base64Data = parts[1];
      const contentType = parts[0].split(':')[1].split(';')[0];
      
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: contentType });
      const url = URL.createObjectURL(blob);
      
      // Open in standard browser window context
      const newWin = window.open();
      if (newWin) {
        newWin.document.write(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="UTF-8">
              <title>${file.name}</title>
              <style>
                body { margin: 0; padding: 0; background-color: #0c0c0e; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; color: #fff; }
                iframe { border: none; width: 100%; height: 100vh; }
                .container { text-align: center; padding: 25px; border: 1px solid #222; background: #121214; border-radius: 12px; max-width: 450px; }
                .btn { background: #2563eb; color: white; display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; margin-top: 15px; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; transition: background 0.2s; }
                .btn:hover { background: #1d4ed8; }
                h1 { font-size: 16px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; color: #3b82f6; }
                p { font-size: 12px; color: #a3a3a3; margin: 0; }
              </style>
            </head>
            <body>
              ${contentType.includes('pdf') 
                ? '<iframe src="' + url + '"></iframe>' 
                : '<div class="container"><h1>Previsualización no disponible</h1><p>Los archivos de tipo Word (.docx) no pueden renderizarse directamente en el navegador de forma nativa.</p><a href="' + url + '" download="' + file.name + '" class="btn">Descargar Archivo</a></div>'
              }
            </body>
          </html>
        `);
      } else {
        // Safe download fall-back
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
      }
    } catch (error) {
      console.error("Open document crash:", error);
      const a = document.createElement('a');
      a.href = file.dataUrl;
      a.download = file.name;
      a.click();
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Sorting ascending alphabetically by Name and Apellido (A-Z), ignoring soft-deleted clients
  const sortedContacts = [...contacts]
    .filter(c => !c.deleted)
    .sort((a, b) => 
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );

  // Search filtering in real-time by Name field
  const filteredContacts = sortedContacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeContact = contacts.find(c => c.id === selectedContactId) || null;

  return (
    <div className="space-y-6 h-full flex flex-col font-sans">
      
      {/* Title & Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-tabelion font-bold text-[#0f172a] uppercase tracking-[0.14em]">Agenda del Estudio</h1>
          <p className="text-[#475569] text-sm font-medium">Tarjetero notarial, control de hitos y respaldo documental</p>
        </div>
        <div>
          <button 
            type="button"
            id="btn-new-client"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-blue-900/10 active:scale-95"
          >
            <UserPlus size={14} />
            Ingresar Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Main Sandbox Workspace Layout: Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden min-h-[500px]">
        
        {/* LEFT COLUMN: A-Z Linear Client Cards Container (Spans 5 of 12) */}
        <div className="lg:col-span-5 flex flex-col bg-[#f6f8fc] border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-md h-full max-h-[800px]">
          
          {/* BARRA DE BÚSQUEDA Y FILTRADO */}
          <div className="p-4 border-b border-[#cbd5e1] bg-[#eaeff7]/70">
            <div className="relative flex items-center bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 focus-within:border-[#1d4ed8] transition-all shadow-2xs">
              <Search size={16} className="text-[#475569] mr-2.5 shrink-0" />
              <input 
                type="text" 
                id="agenda-search-input"
                placeholder="Filtrar contactos por nombre..." 
                className="w-full bg-transparent border-none focus:outline-none text-xs font-semibold text-[#0f172a] placeholder:text-[#64748b]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  type="button" 
                  onClick={() => setSearchTerm('')}
                  className="text-[#64748b] hover:text-[#0f172a] transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* List Wrapper - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-2.5">
            {filteredContacts.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <AlertCircle className="text-[#64748b]" size={32} />
                <p className="text-[#334155] font-bold text-xs uppercase tracking-widest">Sin contactos cargados</p>
                <p className="text-[#475569] text-sm text-center max-w-[220px]">Pruebe con otro término o ingrese un contacto manual.</p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isActive = contact.id === selectedContactId;
                const initials = contact.name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
                
                return (
                  <div
                    key={contact.id}
                    id={`contact-row-${contact.id}`}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 flex items-center justify-between group ${
                      isActive 
                        ? 'bg-[#ffffff] border-[#1d4ed8] text-[#0f172a] shadow-md' 
                        : 'bg-[#eaeff7]/50 border-transparent hover:bg-[#ffffff] hover:border-[#cbd5e1] text-[#334155]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      {/* Monogram avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs tracking-wider shrink-0 ${
                        isActive 
                          ? 'bg-[#0f172a] text-white shadow-xs' 
                          : 'bg-[#dde4ee] border border-[#cbd5e1] text-[#1e293b] group-hover:text-[#1d4ed8]'
                      }`}>
                        {initials}
                      </div>

                      {/* Info lines: Nombre y Apellido | Correo | Teléfono con fuente más legible */}
                      <div className="overflow-hidden space-y-1">
                        <h4 className="text-sm font-bold tracking-tight text-[#0f172a] truncate max-w-[230px]">{contact.name}</h4>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#475569] font-medium">
                          {contact.email ? (
                            <span className="truncate max-w-[160px] flex items-center gap-1">
                              <Mail size={11} className="text-[#64748b] shrink-0" />
                              {contact.email}
                            </span>
                          ) : (
                            <span className="text-[#64748b]">[Sin correo]</span>
                          )}
                          <span className="text-[#94a3b8]">•</span>
                          {contact.phone ? (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone size={11} className="text-[#64748b] shrink-0" />
                              {contact.phone}
                            </span>
                          ) : (
                            <span className="text-[#64748b]">[Sin teléfono]</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        type="button" 
                        onClick={(e) => handleDeleteContactRequest(contact.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/10 rounded-lg text-[#64748b] hover:text-rose-600 transition-all duration-150"
                        title="Eliminar de agenda"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={16} className={`text-[#64748b] ${isActive ? 'text-[#1d4ed8] transform translate-x-0.5' : ''} transition-all`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Alphabetical list footer count */}
          <div className="p-3.5 border-t border-[#cbd5e1] bg-[#eaeff7]/70 text-center">
            <span className="text-xs font-bold text-[#334155] uppercase tracking-wider">
              Contactos Activos del Estudio: {sortedContacts.length}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Ficha Detallada (Spans 7 of 12) */}
        <div className="lg:col-span-7 flex flex-col bg-[#f6f8fc] border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-md h-full max-h-[800px] overflow-y-auto custom-scrollbar">
          
          {activeContact ? (
            <div className="p-6 sm:p-7 space-y-6">
              
              {/* Header Box: Avatar, Name and Basic Info */}
              <div className="p-6 bg-[#ffffff] border border-[#cbd5e1] rounded-2xl space-y-5 shadow-2xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-tabelion font-bold text-xl shrink-0 shadow-xs">
                      {activeContact.name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">{activeContact.name}</h2>
                      <p className="text-xs text-[#475569] font-semibold uppercase tracking-wider mt-1">Ficha Digital de Control Interno</p>
                    </div>
                  </div>

                  {/* Acciones de Ficha: Editar y Eliminar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id="btn-edit-active-client"
                      onClick={() => handleStartEdit(activeContact)}
                      className="px-3.5 py-2 bg-[#eef2f8] hover:bg-[#e2e8f0] text-[#0f172a] border border-[#cbd5e1] rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                      title="Editar datos del cliente"
                    >
                      <Pencil size={13} className="text-[#1d4ed8]" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <button
                      type="button"
                      id="btn-delete-active-client"
                      onClick={(e) => handleDeleteContactRequest(activeContact.id, e)}
                      className="px-3.5 py-2 bg-[#eef2f8] hover:bg-rose-500/10 text-[#334155] hover:text-rose-600 border border-[#cbd5e1] hover:border-rose-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                      title="Eliminar cliente del sistema"
                    >
                      <Trash2 size={13} className="text-rose-600" />
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-[#e2e8f0]">
                  <div className="flex items-center gap-3 p-3.5 bg-[#f4f7fb] border border-[#dce4f0] rounded-xl">
                    <Mail size={16} className="text-[#1d4ed8] shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-[11px] text-[#475569] font-bold uppercase leading-none tracking-wider">Correo Electrónico</p>
                      <p className="text-sm font-semibold text-[#0f172a] mt-1.5 truncate">{activeContact.email || 'No especificado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3.5 bg-[#f4f7fb] border border-[#dce4f0] rounded-xl">
                    <Phone size={16} className="text-[#1d4ed8] shrink-0" />
                    <div>
                      <p className="text-[11px] text-[#475569] font-bold uppercase leading-none tracking-wider">Teléfono / Móvil</p>
                      <p className="text-sm font-mono font-semibold text-[#0f172a] mt-1.5">{activeContact.phone || 'No especificado'}</p>
                    </div>
                  </div>
                </div>

                {activeContact.observations && (
                  <div className="pt-1">
                    <p className="text-xs text-[#475569] font-bold uppercase tracking-wider mb-1.5">Observaciones Iniciales</p>
                    <div className="p-3.5 bg-[#f4f7fb] border-l-4 border-[#1d4ed8] rounded-r-xl">
                      <p className="text-sm text-[#1e293b] leading-relaxed">{activeContact.observations}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ZONA A: INGRESO DE ACTIVIDAD Y OBSERVACIONES */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-2.5">
                  <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-[0.15em] flex items-center gap-2">
                    <BookOpen size={15} className="text-[#1d4ed8]" />
                    Zona A: Historial de Comentarios e Hitos
                  </h3>
                  <span className="text-[11px] text-[#475569] uppercase tracking-wider font-semibold">Control Cronológico</span>
                </div>

                {/* Input Area */}
                <div className="bg-[#ffffff] border border-[#cbd5e1] rounded-xl p-4 space-y-3 shadow-2xs">
                  <textarea
                    rows={2}
                    placeholder="Ingresar un nuevo comentario, antecedente u observación en esta ficha..."
                    className="w-full bg-transparent border-none text-sm focus:outline-none text-[#0f172a] placeholder:text-[#64748b] leading-relaxed resize-none"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!newNoteText.trim()}
                      className="bg-[#0f172a] hover:bg-[#1e3a8a] text-white disabled:bg-[#e2e8f0] disabled:text-[#94a3b8] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                    >
                      <PlusCircle size={14} />
                      Agregar Nota
                    </button>
                  </div>
                </div>

                {/* notes listing */}
                <div className="space-y-3 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                  {activeContact.notes.length === 0 ? (
                    <p className="text-center py-6 text-sm text-[#64748b] italic">No se han registrado observaciones posteriores.</p>
                  ) : (
                    activeContact.notes.map((note) => (
                      <div key={note.id} className="p-4 bg-[#ffffff] border border-[#cbd5e1] rounded-xl relative group shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] uppercase font-bold tracking-wider text-[#475569] mb-1.5 font-mono">
                          <span>REGISTRO DEL ESTUDIO</span>
                          <span>{note.date}</span>
                        </div>
                        <p className="text-sm text-[#0f172a] font-medium leading-relaxed whitespace-pre-line">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ZONA B: ARCHIVOS ADJUNTOS EN LA FICHA */}
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-2.5">
                  <h3 className="text-xs font-bold text-[#0f172a] uppercase tracking-[0.15em] flex items-center gap-2">
                    <FileText size={15} className="text-[#1d4ed8]" />
                    Zona B: Documentos de Respaldo (.PDF / .DOCX)
                  </h3>
                  <span className="text-[11px] text-[#475569] uppercase tracking-wider font-semibold">Expediente Digital</span>
                </div>

                {/* Custom drag & drop area */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-[#1d4ed8] bg-blue-500/5' 
                      : fileError 
                        ? 'border-rose-400 bg-rose-500/5' 
                        : 'border-[#cbd5e1] bg-[#ffffff]/70 hover:bg-[#ffffff] hover:border-[#94a3b8]'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        processFiles(e.target.files);
                      }
                    }}
                    className="hidden"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                  />
                  <UploadCloud size={26} className={isDragging ? 'text-[#1d4ed8] animate-bounce' : fileError ? 'text-rose-600' : 'text-[#475569]'} />
                  
                  <p className="text-xs font-bold uppercase text-[#1e293b] tracking-wider mt-2.5">
                    Arrastra tu archivo aquí o haz clic para subir
                  </p>
                  <p className="text-[11px] font-medium text-[#64748b] mt-1">
                    Formatos admitidos: PDF y Microsoft Word (.docx)
                  </p>
                </div>

                {fileError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-300 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs font-medium leading-relaxed">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{fileError}</span>
                  </div>
                )}

                {/* List of uploaded files under the selected client */}
                <div className="space-y-2.5">
                  {activeContact.attachments.length === 0 ? (
                    <p className="text-center py-4 text-sm text-[#64748b] italic">No hay archivos adjuntos en esta ficha.</p>
                  ) : (
                    activeContact.attachments.map((file) => {
                      const isWord = file.name.toLowerCase().endsWith('.docx');
                      
                      return (
                        <div key={file.id} className="p-3.5 bg-[#ffffff] border border-[#cbd5e1] rounded-xl flex items-center justify-between group-file shadow-2xs">
                          <div className="flex items-center gap-3.5 overflow-hidden">
                            <div className="p-2.5 bg-[#eaeff7] rounded-xl text-[#1e293b]">
                              <File size={18} className={isWord ? 'text-[#1d4ed8]' : 'text-rose-600'} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-bold text-[#0f172a] truncate pr-4" title={file.name}>
                                {file.name}
                              </p>
                              <p className="text-xs font-mono font-medium text-[#475569] uppercase tracking-tight mt-0.5">
                                {file.size} • {isWord ? 'WORD (DOCX)' : 'DOCUMENTO PDF'} • {file.uploadedAt}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Download Action */}
                            <a 
                              href={file.dataUrl} 
                              download={file.name}
                              className="p-2 bg-[#eef2f8] hover:bg-[#e2e8f0] border border-[#cbd5e1] text-[#0f172a] rounded-lg transition-colors flex items-center justify-center"
                              title="Descargar documento"
                            >
                              <Download size={14} />
                            </a>

                            {/* Delete Action */}
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachmentRequest(file.id)}
                              className="p-2 bg-[#eef2f8] hover:bg-rose-500/10 border border-[#cbd5e1] text-[#475569] hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar de la ficha"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#475569] h-full">
              <BookOpen size={48} className="text-[#94a3b8] mb-4" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#0f172a]">Ficha no seleccionada</h3>
              <p className="text-sm text-[#475569] max-w-[300px] mt-2 leading-relaxed">
                Seleccione un contacto del listado de la izquierda para visualizar su ficha detallada, comentarios y documentos de respaldo.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* FORMULARIO DE INGRESO MANUAL DE DATOS (Modal limpio y emergente) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-[#f6f8fc] border border-[#cbd5e1] rounded-[1.5rem] shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden"
            >
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-60"></div>

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0f172a] uppercase tracking-wider">Nuevo Registro de Contacto</h3>
                  <p className="text-xs text-[#475569] font-medium mt-0.5">Ingreso de datos del cliente en la agenda del estudio</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-[#e2e8f0] rounded-lg text-[#475569] hover:text-[#0f172a] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleCreateContact} className="space-y-4">
                
                {/* Nombre y Apellido */}
                <div className="space-y-1.5">
                  <label htmlFor="input-fullname" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Nombre y Apellido *</label>
                  <input
                    type="text"
                    id="input-fullname"
                    required
                    placeholder="Ingresar nombre y apellido..."
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-medium"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                {/* Correo electrónico */}
                <div className="space-y-1.5">
                  <label htmlFor="input-email" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Correo Electrónico</label>
                  <input
                    type="email"
                    id="input-email"
                    placeholder="Ej: cliente@apellido.com"
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-medium"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                {/* Teléfono / Móvil */}
                <div className="space-y-1.5">
                  <label htmlFor="input-phone" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Teléfono / Móvil</label>
                  <input
                    type="text"
                    id="input-phone"
                    placeholder="Ej: 099 111 222"
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-mono font-medium"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>

                {/* Observaciones iniciales */}
                <div className="space-y-1.5">
                  <label htmlFor="input-observations" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Observaciones Iniciales</label>
                  <textarea
                    id="input-observations"
                    rows={3}
                    placeholder="Escriba antecedentes, observaciones iniciales o notas previas respecto al contacto..."
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-medium leading-relaxed resize-none"
                    value={formData.observations}
                    onChange={(e) => setFormData({...formData, observations: e.target.value})}
                  />
                </div>

                {/* Modal actions panel */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#cbd5e1]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#ffffff] text-[#334155] hover:text-[#0f172a] hover:bg-[#e2e8f0] text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Guardar Cliente
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORMULARIO DE EDICIÓN DE DATOS (Modal limpio y emergente para Editar) */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-[#f6f8fc] border border-[#cbd5e1] rounded-[1.5rem] shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden"
            >
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60"></div>

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#cbd5e1] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0f172a] uppercase tracking-wider">Modificar Ficha de Contacto</h3>
                  <p className="text-xs text-[#475569] font-medium mt-0.5">Actualización de datos del cliente</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 hover:bg-[#e2e8f0] rounded-lg text-[#475569] hover:text-[#0f172a] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleUpdateContact} className="space-y-4">
                
                {/* Nombre y Apellido */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-input-fullname" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Nombre y Apellido *</label>
                  <input
                    type="text"
                    id="edit-input-fullname"
                    required
                    placeholder="Ingresar nombre y apellido..."
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-medium"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  />
                </div>

                {/* Correo electrónico */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-input-email" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Correo Electrónico</label>
                  <input
                    type="email"
                    id="edit-input-email"
                    placeholder="Ej: cliente@apellido.com"
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-medium"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  />
                </div>

                {/* Teléfono / Móvil */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-input-phone" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Teléfono / Móvil</label>
                  <input
                    type="text"
                    id="edit-input-phone"
                    placeholder="Ej: 099 111 222"
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-mono font-medium"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  />
                </div>

                {/* Observaciones iniciales */}
                <div className="space-y-1.5">
                  <label htmlFor="edit-input-observations" className="text-xs text-[#334155] font-bold uppercase tracking-wider">Observaciones Iniciales</label>
                  <textarea
                    id="edit-input-observations"
                    rows={3}
                    placeholder="Escriba antecedentes, observaciones iniciales o notas previas respecto al contacto..."
                    className="w-full bg-[#ffffff] border border-[#cbd5e1] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-blue-500 text-[#0f172a] placeholder:text-[#94a3b8] font-medium leading-relaxed resize-none"
                    value={editFormData.observations}
                    onChange={(e) => setEditFormData({...editFormData, observations: e.target.value})}
                  />
                </div>

                {/* Modal actions panel */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#cbd5e1]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#ffffff] text-[#334155] hover:text-[#0f172a] hover:bg-[#e2e8f0] text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Guardar Cambios
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CLIENTE (Personalizado de alta fidelidad) */}
      <AnimatePresence>
        {contactToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-[#f6f8fc] border border-red-950/40 rounded-[1.5rem] shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden"
            >
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60"></div>

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                <div className="flex items-center gap-2">
                  <Trash2 size={16} className="text-red-500" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirmar Borrado</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setContactToDelete(null)}
                  className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Message text */}
              <div className="space-y-3">
                <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                  ¿Está seguro que desea eliminar a <strong className="text-white font-extrabold">{contactToDelete.name}</strong> de la agenda del estudio?
                </p>
                <div className="p-3 bg-red-950/10 border border-red-900/10 rounded-xl">
                  <p className="text-[10px] text-red-400 font-medium leading-relaxed">
                    Se aplicará un borrado lógico seguro. La información del cliente quedará oculta en el listado activo de la agenda, pero archivada de forma segura para preservar el histórico de auditoría.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setContactToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteContact}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-red-900/10 active:scale-95 flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Confirmar Eliminación
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE ADJUNTO (Personalizado de alta fidelidad) */}
      <AnimatePresence>
        {attachmentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-[#f6f8fc] border border-red-950/40 rounded-[1.5rem] shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden"
            >
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60"></div>

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                <div className="flex items-center gap-2">
                  <Trash2 size={16} className="text-red-500" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Eliminar Adjunto</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setAttachmentToDelete(null)}
                  className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Message text */}
              <div className="space-y-3">
                <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                  ¿Desea desvincular y eliminar el documento adjunto <strong className="text-white font-extrabold">{attachmentToDelete.name}</strong>?
                </p>
                <div className="p-3 bg-red-950/10 border border-red-900/10 rounded-xl">
                  <p className="text-[10px] text-red-400 font-medium leading-relaxed">
                    Esta acción desvinculará este documento de la ficha digital del cliente de forma definitiva y permanente.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setAttachmentToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900 text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAttachment}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-red-900/10 active:scale-95 flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  Eliminar Adjunto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
