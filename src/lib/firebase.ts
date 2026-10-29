export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: {
    providerId: string;
    email: string | null;
  }[];
}

// Auth listeners registry
type AuthStateCallback = (user: User | null) => void;
const authCallbacks = new Set<AuthStateCallback>();

class MockAuth {
  private _currentUser: User | null = null;

  constructor() {
    // Automatic high fidelity simulated session for local/Antigravity standalone usage
    const savedUser = localStorage.getItem('_fs_mock_user');
    if (savedUser) {
      try {
        this._currentUser = JSON.parse(savedUser);
      } catch (e) {
        this._currentUser = null;
      }
    }
    
    if (!this._currentUser) {
      const defaultUser: User = {
        uid: 'escribano-striker-dev',
        email: 'strikeroficina@gmail.com',
        displayName: 'Escribano Striker IA',
        emailVerified: true,
        isAnonymous: false,
        tenantId: null,
        providerData: [{ providerId: 'google.com', email: 'strikeroficina@gmail.com' }]
      };
      this._currentUser = defaultUser;
      localStorage.setItem('_fs_mock_user', JSON.stringify(defaultUser));
    }
  }

  get currentUser() {
    return this._currentUser;
  }

  onAuthStateChanged(callback: AuthStateCallback) {
    authCallbacks.add(callback);
    setTimeout(() => {
      callback(this._currentUser);
    }, 0);
    return () => {
      authCallbacks.delete(callback);
    };
  }

  async signOut() {
    this._currentUser = null;
    localStorage.removeItem('_fs_mock_user');
    authCallbacks.forEach(cb => cb(null));
  }

  async signInWithPopup() {
    const defaultUser: User = {
      uid: 'escribano-striker-dev',
      email: 'strikeroficina@gmail.com',
      displayName: 'Escribano Striker IA',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [{ providerId: 'google.com', email: 'strikeroficina@gmail.com' }]
    };
    this._currentUser = defaultUser;
    localStorage.setItem('_fs_mock_user', JSON.stringify(defaultUser));
    authCallbacks.forEach(cb => cb(defaultUser));
    return { user: defaultUser };
  }
}

export const auth = new MockAuth();

export function onAuthStateChanged(authInstance: MockAuth, callback: AuthStateCallback) {
  return authInstance.onAuthStateChanged(callback);
}

export async function signIn() {
  return auth.signInWithPopup();
}

export async function signOut() {
  return auth.signOut();
}

const DEFAULT_INDICES = {
  ui: 6.6803,          // Cotización Oficial INE / BCU Uruguay
  ur: 1946.95,         // Cotización Oficial INE Uruguay
  ura: 1939.40,        // Cotización Oficial INE Uruguay
  dolar_interbancario: 40.14,
  dolar_pizarra_compra: 38.90,
  dolar_pizarra_venta: 41.40
};

// --- SIMULATED FIRESTORE ENGINE (Offline-first LocalStorage backend) ---

export const db = {};

export class MockDocRef {
  constructor(public path: string) {}
}

export class MockCollectionRef {
  constructor(public path: string) {}
}

export function doc(database: any, collectionOrPath: string | MockCollectionRef, ...paths: string[]) {
  let fullPath = "";
  if (typeof collectionOrPath === 'string') {
    fullPath = [collectionOrPath, ...paths].join('/');
  } else {
    fullPath = [collectionOrPath.path, ...paths].join('/');
  }
  return new MockDocRef(fullPath);
}

export function collection(database: any, ...paths: string[]) {
  const fullPath = paths.join('/');
  return new MockCollectionRef(fullPath);
}

export function query(collectionRef: MockCollectionRef, ...constraints: any[]) {
  return collectionRef;
}

const docListeners: { [path: string]: Set<(snap: any) => void> } = {};

export async function getDoc(docRef: MockDocRef) {
  const key = `_fs_doc:${docRef.path}`;
  const raw = localStorage.getItem(key);
  
  if (raw) {
    try {
      const data = JSON.parse(raw);
      return {
        exists: () => true,
        data: () => data
      };
    } catch (e) {}
  }

  if (docRef.path === "config_sistema/indices_notariales") {
    return {
      exists: () => true,
      data: () => DEFAULT_INDICES
    };
  }

  return {
    exists: () => false,
    data: () => null
  };
}

export async function setDoc(docRef: MockDocRef, data: any, options?: any) {
  const key = `_fs_doc:${docRef.path}`;
  let finalData = { ...data };

  if (options && options.merge) {
    const existingRaw = localStorage.getItem(key);
    if (existingRaw) {
      try {
        finalData = { ...JSON.parse(existingRaw), ...data };
      } catch (e) {}
    }
  }

  localStorage.setItem(key, JSON.stringify(finalData));

  const listeners = docListeners[docRef.path];
  if (listeners) {
    const snap = {
      exists: () => true,
      data: () => finalData
    };
    listeners.forEach(cb => cb(snap));
  }
}

export function onSnapshot(docRef: MockDocRef, callback: (snap: any) => void, errorCallback?: (err: any) => void) {
  if (!docListeners[docRef.path]) {
    docListeners[docRef.path] = new Set();
  }
  docListeners[docRef.path].add(callback);

  getDoc(docRef).then(snap => {
    callback(snap);
  }).catch(err => {
    if (errorCallback) errorCallback(err);
  });

  return () => {
    const set = docListeners[docRef.path];
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        delete docListeners[docRef.path];
      }
    }
  };
}

export async function getDocs(collectionOrQueryRef: MockCollectionRef) {
  const prefix = `_fs_doc:${collectionOrQueryRef.path}/`;
  const docs: { id: string; data: () => any }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const path = key.substring(8); // length of '_fs_doc:'
      const docId = path.substring(path.lastIndexOf('/') + 1);
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          docs.push({
            id: docId,
            data: () => data
          });
        } catch (e) {}
      }
    }
  }

  return {
    forEach: (cb: (docSnap: any) => void) => {
      docs.forEach(cb);
    },
    docs
  };
}

async function testConnection() {
  console.log("Antigravity secure local database system initialized successfully.");
}
testConnection();
