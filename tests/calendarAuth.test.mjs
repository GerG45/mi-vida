import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compiled = ts.transpileModule(await fs.readFile(new URL('../src/lib/calendarAuth.ts', import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022},
}).outputText.replace(/^import .*;\r?\n/gm, '');
let id = 0;
async function harness({native = false, signedIn = true} = {}) {
  const user = {uid: 'owner', email: 'owner@example.com', providerData: [{providerId: 'google.com'}]};
  const auth = {currentUser: signedIn ? user : null};
  const app = {name: 'mi-vida-web'};
  const watchers = new Set(), timers = new Map(), cleared = [];
  let nextTimer = 0, popup, nativeRequest, apps = [app];
  let authorize = async () => ({accessToken: 'native-token'});
  let reauthenticate = async () => ({user, credential: {accessToken: 'web-token'}});
  class GoogleAuthProvider {
    static PROVIDER_ID = 'google.com';
    static credentialFromResult(result) {return result.credential;}
    scopes = [];
    addScope(scope) {this.scopes.push(scope);}
    setCustomParameters(parameters) {this.parameters = parameters;}
  }
  const key = `calendarAuthTest${++id}`;
  globalThis[key] = {
    getApps: () => apps,
    getAuth: () => auth,
    GoogleAuthProvider,
    onAuthStateChanged: (_, listener) => {watchers.add(listener); return () => watchers.delete(listener);},
    reauthenticateWithPopup: (current, provider) => {popup = {current, provider}; return reauthenticate();},
    isAndroidApp: () => native,
    LifeCalendarAuth: {
      authorize: options => {nativeRequest = options; return authorize();},
      clearToken: async options => {cleared.push(options);},
    },
    setTimeout: (fn, ms) => {const key = ++nextTimer; timers.set(key, {fn, ms}); return key;},
    clearTimeout: key => timers.delete(key),
  };
  const prefix = `const {getApps,getAuth,GoogleAuthProvider,onAuthStateChanged,reauthenticateWithPopup,isAndroidApp,LifeCalendarAuth,setTimeout,clearTimeout} = globalThis.${key};\n`;
  const api = await import(`data:text/javascript;base64,${Buffer.from(prefix + compiled).toString('base64')}`);
  return {
    api, user, auth, timers, cleared,
    get popup() {return popup;}, get nativeRequest() {return nativeRequest;},
    setReauthenticate(fn) {reauthenticate = fn;}, setAuthorize(fn) {authorize = fn;},
    changeUser(next) {auth.currentUser = next; watchers.forEach(listener => listener(next));},
    removeApp() {apps = [];},
    cleanup() {api.disconnectCalendarAccess(); delete globalThis[key];},
  };
}

test('Calendar requires the already signed-in Google account before opening authorization', async () => {
  const h = await harness({signedIn: false});
  await assert.rejects(h.api.authorizeCalendarAccess('owner@example.com'), /Primero ingresá/);
  assert.equal(h.popup, undefined);
  h.auth.currentUser = h.user;
  await assert.rejects(h.api.authorizeCalendarAccess('other@example.com'), /misma cuenta/);
  assert.equal(h.api.getCalendarAccessToken(), null);
  h.cleanup();
});

test('web reauth requests only the three Calendar scopes without replacing Firebase sign-in', async () => {
  const h = await harness();
  let notifications = 0;
  const unsubscribe = h.api.subscribeCalendarAuth(() => notifications++);
  await h.api.authorizeCalendarAccess('OWNER@example.com');
  assert.equal(h.popup.current, h.user);
  assert.deepEqual(h.popup.provider.scopes, [...h.api.CALENDAR_SCOPES]);
  assert.deepEqual(h.popup.provider.parameters, {login_hint: 'owner@example.com'});
  assert.equal(h.auth.currentUser, h.user);
  assert.equal(h.api.getCalendarAccessToken(), 'web-token');
  assert.equal(h.api.getCalendarAuthorizedEmail(), 'owner@example.com');
  assert.equal(h.api.getCalendarAuthStatus(), h.api.getCalendarAuthStatus(), 'React external snapshots remain stable');
  assert.equal(h.api.getCalendarAuthStatus().authorizing, false);
  assert.equal(notifications, 2);
  unsubscribe(); h.cleanup();
});

test('account change during consent rejects the returned token and clears pending connection', async () => {
  const h = await harness();
  let resolve;
  h.setReauthenticate(() => new Promise(done => {resolve = done;}));
  const pending = h.api.authorizeCalendarAccess();
  assert.equal(h.api.getCalendarAuthStatus().authorizing, true);
  h.changeUser({uid: 'other', email: 'other@example.com'});
  resolve({user: h.user, credential: {accessToken: 'stale-token'}});
  await assert.rejects(pending, /Cambió la sesión/);
  assert.equal(h.api.getCalendarAccessToken(), null);
  assert.equal(h.api.getCalendarAuthStatus().authorizing, false);
  h.cleanup();
});

test('disconnect while consent is pending prevents late success from reconnecting', async () => {
  const h = await harness();
  let resolve;
  h.setReauthenticate(() => new Promise(done => {resolve = done;}));
  const pending = h.api.authorizeCalendarAccess();
  h.api.disconnectCalendarAccess();
  resolve({user: h.user, credential: {accessToken: 'late-token'}});
  await assert.rejects(pending, /Cambió la sesión/);
  assert.equal(h.api.getCalendarAccessToken(), null);
  h.cleanup();
});

test('native authorization binds the Firebase email and disconnect clears only its Calendar token', async () => {
  const h = await harness({native: true});
  await h.api.authorizeCalendarAccess();
  assert.deepEqual(h.nativeRequest, {email: 'owner@example.com'});
  assert.equal(h.popup, undefined);
  assert.equal(h.api.getCalendarAccessToken(), 'native-token');
  h.api.disconnectCalendarAccess();
  assert.deepEqual(h.cleared, [{accessToken: 'native-token'}]);
  assert.equal(h.auth.currentUser, h.user);
  assert.equal(h.api.getCalendarAccessToken(), null);
  h.cleanup();
});

test('expiring or removing the Firebase app makes the in-memory credential unusable', async () => {
  const h = await harness();
  await h.api.authorizeCalendarAccess();
  const timeout = [...h.timers.values()][0];
  assert.equal(timeout.ms, 50 * 60_000);
  timeout.fn();
  assert.equal(h.api.getCalendarAccessToken(), null);
  assert.equal(h.api.getCalendarAuthorizedEmail(), null);
  await h.api.authorizeCalendarAccess();
  h.removeApp();
  assert.equal(h.api.getCalendarAccessToken(), null);
  h.cleanup();
});

test('Google cancellation leaves Firebase signed in and permits another attempt', async () => {
  const h = await harness();
  h.setReauthenticate(async () => {throw new Error('cancelled');});
  await assert.rejects(h.api.authorizeCalendarAccess(), /cancelled/);
  assert.equal(h.auth.currentUser, h.user);
  assert.equal(h.api.getCalendarAuthStatus().authorizing, false);
  assert.equal(h.api.getCalendarAccessToken(), null);
  h.setReauthenticate(async () => ({user: h.user, credential: {accessToken: 'retry-token'}}));
  await h.api.authorizeCalendarAccess();
  assert.equal(h.api.getCalendarAccessToken(), 'retry-token');
  h.cleanup();
});
