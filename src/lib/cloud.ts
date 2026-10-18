import { useSyncExternalStore } from 'react';
import { initializeApp, deleteApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut, type Auth, type User } from 'firebase/auth';
import {isAndroidApp, LifeGoogleAuth} from './native';
import { getFirestore, collection, doc, onSnapshot, writeBatch, serverTimestamp, terminate, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { acknowledgeRecords, bindCloudWriter, decodeRecordId, getPendingRecords, getStorageError, getStoreScope, isLifeRecord, localDeviceRecords, queueLocalDeviceRecords, receiveCloudSnapshot, recordId, setStoreScope, type LifeRecord } from './lifeStore';

export interface MiVidaFirebaseConfig extends FirebaseOptions { allowRegistration?: boolean; emailPassword?: boolean; googleSignIn?: boolean; allowedEmail?: string }
export type CloudMode = 'local'|'loading'|'offline'|'pending'|'synced'|'error';
export interface CloudStatus { mode: CloudMode; configured: boolean; authReady: boolean; user: {uid:string;email:string|null}|null; initialSnapshot: boolean; accountEmpty: boolean; pendingCount: number; googlePopupPending: boolean; error: string|null; lastSyncedAt: string|null }
let status: CloudStatus = {mode:'local',configured:false,authReady:false,user:null,initialSnapshot:false,accountEmpty:false,pendingCount:0,googlePopupPending:false,error:null,lastSyncedAt:null};
let config: MiVidaFirebaseConfig | null = null;
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let stopAuth: Unsubscribe | undefined;
let stopSnapshot: Unsubscribe | undefined;
let boot: Promise<void> | undefined;
let session = 0;
let sending = false;
let snapshotPending = false;
let snapshotFromCache = true;
let serverWaitExpired = false;
let connectionFailed = false;
let records: LifeRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
const watchers = new Set<() => void>();
const configKey = 'mi-vida:firebase-web-config:v1';
const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine;
function publish(patch: Partial<CloudStatus>): void { status = {...status,...patch}; watchers.forEach(fn => fn()); }
export function useCloudStatus(): CloudStatus { return useSyncExternalStore(fn => { watchers.add(fn);return () => { watchers.delete(fn); }; },() => status,() => status); }
export function getCloudStatus(): CloudStatus { return status; }
export function getFirebaseConfig(): MiVidaFirebaseConfig | null { return config ? {...config} : null; }

function refresh(): void {
  const pendingCount = getPendingRecords().length;
  const storageError = getStorageError();
  if (storageError) { publish({mode:'error',error:storageError,pendingCount}); return; }
  let mode: CloudMode = !status.user ? 'local' : !online() ? 'offline' : connectionFailed ? 'error' : !status.initialSnapshot ? serverWaitExpired ? 'offline' : 'loading' : pendingCount || sending || snapshotPending ? 'pending' : snapshotFromCache ? 'offline' : 'synced';
  publish({mode,pendingCount,...(mode === 'synced' ? {lastSyncedAt:new Date().toISOString()} : {})});
}
export function cloudError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const messages: Record<string,string> = {
    'auth/invalid-credential':'El correo o la contraseña no coinciden.', 'auth/invalid-email':'Revisá el formato del correo.',
    'auth/email-already-in-use':'Este correo ya tiene una cuenta. Probá ingresar o recuperar la contraseña.',
    'auth/weak-password':'Elegí una contraseña de al menos 6 caracteres.', 'auth/operation-not-allowed':'Ese método de acceso todavía no está habilitado en Firebase.',
    'auth/unauthorized-domain':'Agregá este dominio a los dominios autorizados de Firebase Authentication.',
    'auth/popup-blocked':'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes o abrí Mi Vida en Chrome o Edge.',
    'auth/popup-closed-by-user':'Cerraste la ventana de Google antes de ingresar.', 'auth/network-request-failed':'No se pudo conectar. Revisá tu conexión.',
    'app/google-timeout':isAndroidApp() ? 'Google todavía no confirmó el ingreso. Completá o cancelá el selector de cuenta de Android.' : 'Google no terminó de abrir el acceso en 60 segundos. Abrí Mi Vida en Chrome o Edge y permití las ventanas emergentes. Todavía no se confirmó el ingreso.',
    'app/operation-timeout':'La operación no terminó en 60 segundos. No se confirmó su resultado. Podés seguir usando Mi Vida y revisar el estado de tu cuenta.',
    'app/wait-cancelled':'Dejaste de esperar. Si se abrió una ventana de Google, cerrala antes de volver a intentar. Esto no cancela una operación que el navegador ya esté completando.',
    'app/google-in-progress':'Hay un acceso de Google pendiente en este navegador. Completá esa ventana o abrí Mi Vida en Chrome o Edge.',
    'auth/too-many-requests':'Hubo demasiados intentos. Esperá un momento e intentá de nuevo.',
    'permission-denied':'Firebase no autorizó leer o guardar tus datos. Revisá las reglas publicadas para este proyecto.',
    'failed-precondition':'La base de datos todavía no está lista. Revisá Firestore en el proyecto Mi Vida.',
    'unavailable':'La nube no responde. Los cambios siguen guardados en este navegador.',
  };
  return messages[code] || (error instanceof Error ? error.message : 'No se pudo completar la operación.');
}
export function validateFirebaseConfig(input: unknown): MiVidaFirebaseConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Pegá el objeto JSON de configuración web de Firebase.');
  const candidate = input as Record<string,unknown>;
  if ('private_key' in candidate || 'client_email' in candidate || candidate.type === 'service_account') throw new Error('Usá la configuración web pública. No pegues una clave de cuenta de servicio.');
  for (const key of ['apiKey','projectId','authDomain','appId']) if (typeof candidate[key] !== 'string' || !String(candidate[key]).trim()) throw new Error(`La configuración necesita ${key}.`);
  const clean: Record<string,unknown> = {};
  for (const key of ['apiKey','projectId','authDomain','appId','storageBucket','messagingSenderId','measurementId','databaseURL']) if (typeof candidate[key] === 'string') clean[key] = candidate[key];
  for (const key of ['allowRegistration','emailPassword','googleSignIn']) if (typeof candidate[key] === 'boolean') clean[key] = candidate[key];
  if (typeof candidate.allowedEmail === 'string') clean.allowedEmail = candidate.allowedEmail.trim().toLowerCase();
  return clean as unknown as MiVidaFirebaseConfig;
}

async function flush(): Promise<void> {
  refresh();
  if (sending || !db || !status.user || !status.initialSnapshot || !online() || connectionFailed) return;
  const pending = getPendingRecords();
  if (!pending.length) return;
  const thisSession = session, scope = getStoreScope(), uid = status.user.uid;
  sending = true; refresh();
  try {
    for (let offset = 0; offset < pending.length; offset += 400) {
      if (thisSession !== session || !db) return;
      const chunk = pending.slice(offset,offset + 400);
      const batch = writeBatch(db);
      for (const record of chunk) batch.set(doc(db,'users',uid,'miVidaRecords',recordId(record.section,record.key)), {value:record.value,deleted:record.deleted,updatedAt:serverTimestamp()});
      await batch.commit();
      if (thisSession !== session || getStoreScope() !== scope) return;
      acknowledgeRecords(chunk);
    }
    if (thisSession === session) publish({error:null});
  } catch (error) {
    if (thisSession === session) { connectionFailed = true; publish({error:cloudError(error)}); }
  } finally {
    if (thisSession === session) { sending = false; refresh(); if (!connectionFailed && getPendingRecords().length) void flush(); }
  }
}

function watchUser(user: User | null): void {
  publish({authReady:true});
  session++; stopSnapshot?.(); stopSnapshot = undefined; sending = false; snapshotPending = false; snapshotFromCache = true; serverWaitExpired = false; connectionFailed = false; records = [];
  if (!user || !db || !config) { setStoreScope(null); publish({user:null,initialSnapshot:false,accountEmpty:false,error:null,lastSyncedAt:null}); refresh(); return; }
  if (config.allowedEmail && user.email?.toLowerCase() !== config.allowedEmail) {
    setStoreScope(null); publish({user:null,mode:'error',error:'Esta instalación está configurada para otro correo.'}); void signOut(auth!); return;
  }
  const thisSession = session;
  setStoreScope(`${config.projectId}:${user.uid}`);
  publish({user:{uid:user.uid,email:user.email},mode:online() ? 'loading' : 'offline',initialSnapshot:false,accountEmpty:false,error:null,lastSyncedAt:null});
  setTimeout(() => { if (session === thisSession && !status.initialSnapshot) {serverWaitExpired = true;refresh();} },12000);
  stopSnapshot = onSnapshot(collection(db,'users',user.uid,'miVidaRecords'), {includeMetadataChanges:true}, snapshot => {
    if (session !== thisSession) return;
    snapshotPending = snapshot.metadata.hasPendingWrites;
    snapshotFromCache = snapshot.metadata.fromCache;
    // A cache-only initial snapshot cannot prove that a new account is empty.
    if (!status.initialSnapshot && snapshot.metadata.fromCache) { refresh(); return; }
    records = snapshot.docs.flatMap(item => {
      const identity = decodeRecordId(item.id), data = item.data();
      if (!identity) return [];
      const record: LifeRecord = {...identity,value:data.value,deleted:data.deleted,updatedAt: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0};
      return isLifeRecord(record) ? [record] : [];
    });
    receiveCloudSnapshot(records);
    connectionFailed = false;
    publish({initialSnapshot:true,accountEmpty:snapshot.empty,error:null});
    refresh(); void flush();
  }, error => { if (session === thisSession) { connectionFailed = true;publish({mode:'error',error:cloudError(error)}); } });
}

async function initialize(next: MiVidaFirebaseConfig | null): Promise<void> {
  session++;stopSnapshot?.();stopAuth?.();stopSnapshot = undefined;stopAuth = undefined;
  setStoreScope(null);
  if (auth) await signOut(auth).catch(() => {});
  if (db) await terminate(db).catch(() => {});
  if (app) await deleteApp(app).catch(() => {});
  auth = null;db = null;app = null;config = next;
  publish({configured:!!next,authReady:!next,user:null,mode:'local',initialSnapshot:false,accountEmpty:false,pendingCount:0,error:null,lastSyncedAt:null});
  if (!next) return;
  try {
    const {allowRegistration: _registration, emailPassword: _password, googleSignIn: _google, allowedEmail: _email,...options} = next;
    app = initializeApp(options,'mi-vida-web');auth = getAuth(app);db = getFirestore(app);
    stopAuth = onAuthStateChanged(auth,watchUser,error => publish({mode:'error',error:cloudError(error)}));
  } catch (error) { publish({mode:'error',error:cloudError(error)}); }
}
export function bootstrapCloud(): Promise<void> {
  if (boot) return boot;
  boot = (async () => {
    bindCloudWriter(() => {
      refresh();
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => { void flush(); },650);
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('online',() => { if (connectionFailed && auth?.currentUser) watchUser(auth.currentUser);else {connectionFailed = false;refresh();void flush();} });
      window.addEventListener('offline',refresh);
    }
    let next: MiVidaFirebaseConfig | null = null;
    try { const saved = localStorage.getItem(configKey); if (saved) next = validateFirebaseConfig(JSON.parse(saved)); } catch { /* A bad stored config must not prevent local use. */ }
    if (!next) try {
      const base = (import.meta as ImportMeta & {env?:{BASE_URL?:string}}).env?.BASE_URL || './';
      const response = await fetch(`${base}firebase-config.json`,{cache:'no-store'});
      if (response.ok) {
        const candidate = await response.json();
        if (candidate && candidate.projectId) {
          next = validateFirebaseConfig(candidate);
          // Public web config is cached so an offline reload can restore Auth and its own local scope.
          try { localStorage.setItem(configKey,JSON.stringify(next)); } catch { /* Cloud can still run when config caching is unavailable. */ }
        }
      }
    } catch { /* A missing/offline config leaves the app local. */ }
    await initialize(next);
  })();
  return boot;
}
export async function setFirebaseConfig(input: unknown): Promise<void> {
  const next = input === null ? null : validateFirebaseConfig(input);
  if (next) localStorage.setItem(configKey,JSON.stringify(next)); else localStorage.removeItem(configKey);
  await initialize(next);
}
function requireAuth(): Auth { if (!auth) throw new Error('Configurá Firebase antes de iniciar sesión.'); return auth; }
function assertEmail(email: string): void { if (config?.allowedEmail && email.trim().toLowerCase() !== config.allowedEmail) throw new Error('Usá el correo habilitado para esta instalación.'); }
function assertNoPopup(): void { if (status.googlePopupPending) throw Object.assign(new Error('Hay un acceso de Google pendiente.'),{code:'app/google-in-progress'}); }
function assertEmailPassword(): void { if (!config?.emailPassword) throw new Error('El acceso con correo y contraseña no está habilitado para esta instalación.');assertNoPopup(); }
export async function loginWithEmail(email: string,password: string): Promise<void> { assertEmailPassword();assertEmail(email);await signInWithEmailAndPassword(requireAuth(),email.trim(),password); }
export async function registerWithEmail(email: string,password: string): Promise<void> { assertEmailPassword();if (!config?.allowRegistration) throw new Error('El registro no está habilitado. Usá tu cuenta creada en Firebase.');assertEmail(email);await createUserWithEmailAndPassword(requireAuth(),email.trim(),password); }
export async function resetPassword(email: string): Promise<void> { assertEmailPassword();assertEmail(email);await sendPasswordResetEmail(requireAuth(),email.trim()); }
export async function loginWithGoogle(): Promise<void> {
  if (!config || config.googleSignIn === false) throw new Error('Google no está habilitado para esta instalación.');
  assertNoPopup();
  const currentAuth = requireAuth();
  publish({googlePopupPending:true});
  try {
    if (isAndroidApp()) {
      const {idToken} = await LifeGoogleAuth.signIn();
      await signInWithCredential(currentAuth,GoogleAuthProvider.credential(idToken));
    } else await signInWithPopup(currentAuth,new GoogleAuthProvider());
  }
  finally { publish({googlePopupPending:false}); }
}
export async function logoutCloud(): Promise<void> {
  await signOut(requireAuth());
  if (isAndroidApp()) await LifeGoogleAuth.signOut();
}
export async function retryCloud(): Promise<void> { connectionFailed = false;if (auth?.currentUser) watchUser(auth.currentUser);else await flush(); }
export async function uploadLocalDeviceData(): Promise<void> {
  if (!status.user || !status.initialSnapshot || !status.accountEmpty || snapshotFromCache) throw new Error('La cuenta debe estar conectada y vacía para subir los datos de este dispositivo.');
  const local = localDeviceRecords();
  if (!local.length) throw new Error('Este navegador no tiene datos locales guardados para subir.');
  queueLocalDeviceRecords(local);publish({accountEmpty:false});await flush();
}
