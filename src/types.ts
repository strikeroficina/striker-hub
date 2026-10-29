export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  rut_dni: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Audit {
  id: string;
  userId: string;
  clientId?: string;
  title: string;
  padron?: string;
  findings: string;
  status: 'draft' | 'finalized';
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}
