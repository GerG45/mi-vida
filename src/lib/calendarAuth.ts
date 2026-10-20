import {getApps} from 'firebase/app';
import {getAuth, GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, type Auth} from 'firebase/auth';
import {isAndroidApp, LifeCalendarAuth} from './native';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
] as const;

export interface CalendarAuthStatus {
  connected: boolean;
  email: string | null;
  expiresAt: number | null;
  authorizing: boolean;
}

interface CalendarSession {accessToken: string; auth: Auth; uid: string; email: string; expiresAt: number}
let session: CalendarSession | null = null;
let authorizing = false;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let observedAuth: Auth | undefined;
let stopObserving: (() => void) | undefined;
let pendingUid: string | null = null;
let status: CalendarAuthStatus = {connected: false, email: null, expiresAt: null, authorizing: false};
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach(listener => listener());

function currentAuth(): Auth | null {
  const app = getApps().find(candidate => candidate.name === 'mi-vida-web');
  return app ? getAuth(app) : null;
}

function clearSession(): void {
  session = null;
  if (timer) clearTimeout(timer);
  timer = undefined;
}

function validSession(): CalendarSession | null {
  if (!session) return null;
  const auth = currentAuth();
  const user = auth?.currentUser;
  if (auth !== session.auth || !user || user.uid !== session.uid || user.email?.toLowerCase() !== session.email || Date.now() >= session.expiresAt) return null;
  return session;
}

export function getCalendarAccessToken(): string | null {return validSession()?.accessToken ?? null;}
export function getCalendarAuthorizedEmail(): string | null {return validSession()?.email ?? null;}
export function getCalendarAuthStatus(): CalendarAuthStatus {
  const active = validSession();
  const next = {connected: Boolean(active), email: active?.email ?? null, expiresAt: active?.expiresAt ?? null, authorizing};
  if (next.connected !== status.connected || next.email !== status.email || next.expiresAt !== status.expiresAt || next.authorizing !== status.authorizing) status = next;
  return status;
}
export function subscribeCalendarAuth(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {subscribers.delete(listener);};
}

/** Disconnects this running app without revoking the user's other Google/Firebase grants. */
export function disconnectCalendarAccess(): void {
  const token = session?.accessToken;
  generation++;
  clearSession();
  authorizing = false;
  pendingUid = null;
  emit();
  // Clear Google's native cache after a revoked/expired credential; never clear Firebase sign-in.
  if (token && isAndroidApp()) void LifeCalendarAuth.clearToken({accessToken: token}).catch(() => {});
}

function observeAccount(auth: Auth): void {
  if (observedAuth === auth) return;
  stopObserving?.();
  observedAuth = auth;
  stopObserving = onAuthStateChanged(auth, user => {
    if ((session && (!user || user.uid !== session.uid || user.email?.toLowerCase() !== session.email)) ||
        (pendingUid && user?.uid !== pendingUid)) disconnectCalendarAccess();
  });
}

/** Must be invoked from the user's Connect button; no automatic consent popups. */
export async function authorizeCalendarAccess(email?: string): Promise<void> {
  if (authorizing) throw new Error('Ya hay una autorización de Calendar abierta. Completala o cerrala antes de volver a intentar.');
  const auth = currentAuth();
  const user = auth?.currentUser;
  const expectedEmail = (email ?? user?.email ?? '').trim().toLowerCase();
  if (!auth || !user || !expectedEmail) throw new Error('Primero ingresá a Mi Vida con tu cuenta de Google.');
  if (user.email?.toLowerCase() !== expectedEmail) throw new Error('Conectá Calendar con la misma cuenta que usás en Mi Vida.');
  if (!user.providerData.some(provider => provider.providerId === GoogleAuthProvider.PROVIDER_ID)) throw new Error('Para conectar Calendar, ingresá a Mi Vida con Google.');
  observeAccount(auth);
  const requestGeneration = ++generation;
  const uid = user.uid;
  pendingUid = uid;
  authorizing = true;
  emit();
  try {
    let accessToken: string | undefined;
    if (isAndroidApp()) {
      accessToken = (await LifeCalendarAuth.authorize({email: expectedEmail})).accessToken;
    } else {
      const provider = new GoogleAuthProvider();
      for (const scope of CALENDAR_SCOPES) provider.addScope(scope);
      provider.setCustomParameters({login_hint: expectedEmail});
      // Reauthentication refuses a different Firebase account instead of replacing the session.
      const result = await reauthenticateWithPopup(user, provider);
      if (result.user.uid !== uid || result.user.email?.toLowerCase() !== expectedEmail) throw new Error('La cuenta de Calendar no coincide con la cuenta de Mi Vida.');
      accessToken = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
    }
    if (requestGeneration !== generation || currentAuth() !== auth || auth.currentUser?.uid !== uid || auth.currentUser.email?.toLowerCase() !== expectedEmail) throw new Error('Cambió la sesión durante la autorización. Volvé a conectar Calendar.');
    if (!accessToken || accessToken.length > 16_000) throw new Error('Google no devolvió un acceso válido a Calendar. Volvé a conectar.');
    clearSession();
    // Google access tokens last about an hour. Renew sooner; API 401 also invalidates this session.
    session = {accessToken, auth, uid, email: expectedEmail, expiresAt: Date.now() + 50 * 60_000};
    timer = setTimeout(() => {clearSession(); emit();}, 50 * 60_000);
  } finally {
    if (requestGeneration === generation) {authorizing = false; pendingUid = null; emit();}
  }
}
