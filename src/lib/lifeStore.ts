import { useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { normalizeTrainingSession, normalizeTrainingRoutine } from './training';
import { normalizeWorkItem } from './workChecklist';

export const LIFE_SECTIONS = ['settings','profile','overrides','extras','done','shopping','journal','habits','habitChecks','tasks','projects','review','gymSessions','gymRoutines','workItems'] as const;
export type LifeSection = typeof LIFE_SECTIONS[number];
export interface LifeRecord { section: string; key: string; value: unknown; deleted: boolean; updatedAt: number }
export interface LifeBackup { version: 1; exportedAt: string; sections: Record<string, unknown> }
const prefix = 'mi-vida:v1:';
const listeners = new Set<() => void>();
const defaults = new Map<string, unknown>();
const values = new Map<string, unknown>();
let activeScope: string | null = null;
let pending = new Map<string, LifeRecord>();
let revision = Date.now();
let notifyCloud: (() => void) | undefined;
let storageError: string | null = null;
let remoteSnapshot: LifeRecord[] | null = null;

function allowed(section: string): boolean { return (LIFE_SECTIONS as readonly string[]).includes(section); }
function plain(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function read<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); storageError = null; }
  catch { storageError = 'No se pudo guardar en este navegador. Exportá una copia antes de cerrar.'; }
}
function storageKey(section: string, scope = activeScope): string { return scope ? `${prefix}user:${encodeURIComponent(scope)}:${section}` : prefix + section; }
function pendingKey(scope = activeScope): string { return storageKey('__pending', scope); }
function emit(): void { listeners.forEach(listener => listener()); }
function persistPending(): void { if (activeScope) write(pendingKey(), [...pending.values()]); }
const safeKey = (key: string): boolean => !!key && key.length <= 500 && !['__proto__','prototype','constructor'].includes(key);
const text = (value: unknown, max = 10000): value is string => typeof value === 'string' && value.length <= max;
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const oneOf = (value: unknown, options: readonly string[]): boolean => typeof value === 'string' && options.includes(value);
const time = (value: unknown): boolean => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function date(value: unknown): boolean { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0,10) === value; }
function weekdays(value: unknown): boolean { return Array.isArray(value) && value.length <= 7 && value.every(day => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(value).size === value.length; }
function assertJson(value: unknown, depth = 0): void {
  if (depth > 20) throw new Error('La estructura del respaldo es demasiado profunda.');
  if (value === null || typeof value === 'boolean' || text(value,100000) || finite(value,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER)) return;
  if (Array.isArray(value)) { if (value.length > 20000) throw new Error('Hay demasiados elementos.');value.forEach(item => assertJson(item,depth + 1));return; }
  if (plain(value)) { for (const [key,item] of Object.entries(value)) { if (!safeKey(key)) throw new Error('Clave de datos no válida.');assertJson(item,depth + 1); }return; }
  throw new Error('El respaldo contiene un valor no válido.');
}
const journalTemplate = {intention:'',gratitude:'',smallStep:'',win:'',learned:'',letGo:'',freeText:'',mood:'',energy:0};
const taskTemplate = {notes:'',status:'inbox',context:'',minutes:15,energy:'medium',projectId:'',waitingFor:'',due:'',createdAt:'',updatedAt:''};
const taskStatuses = ['inbox','next','waiting','someday','reference','done','trash'];
function normalizedEntry(section: string, key: string, value: unknown): unknown {
  if (!safeKey(key)) throw new Error('Clave de entrada no válida.');
  if (section === 'workItems') { const entry=normalizeWorkItem(value,key);if(!entry)throw new Error('Tarea del bloque de trabajo no válida.');return entry; }
  if (section === 'gymSessions') { const entry=normalizeTrainingSession(value,key);if(!entry)throw new Error('Sesión de entrenamiento no válida.');return entry; }
  if (section === 'gymRoutines') { const entry=normalizeTrainingRoutine(value,key);if(!entry)throw new Error('Rutina de entrenamiento no válida.');return entry; }
  if (['done','shopping','habitChecks','review'].includes(section)) { if (typeof value !== 'boolean') throw new Error(`Marca no válida en ${section}.`);return value; }
  if (section === 'settings' || section === 'profile') {
    const initial = defaults.get(section);
    const expected = plain(initial) ? initial[key] : undefined;
    if (expected !== undefined && typeof value !== typeof expected) throw new Error(`Tipo no válido para ${key}.`);
    if (plain(initial) && !Object.prototype.hasOwnProperty.call(initial,key)) throw new Error(`Campo no reconocido: ${key}.`);
    if (section === 'profile') { if (!text(value,200)) throw new Error('Perfil no válido.');return value; }
    if (['gymDays','mealPrepDays'].includes(key)) { if (!weekdays(value)) throw new Error(`Días no válidos para ${key}.`); }
    else if (key === 'anchorMonday') { if (!date(value)) throw new Error('Fecha de referencia no válida.'); }
    else if (['preferredBedtime','defaultWake','schoolStart','cordobaArrival','recordingStart','mondayEveningStart','mondayEveningEnd','mondaySoloDeparture','mondaySoloArrival'].includes(key)) { if (!time(value)) throw new Error(`Hora no válida para ${key}.`); }
    else if (['mealPrepTuesdayStart','mealPrepFridayStart'].includes(key)) { if (value !== '' && !time(value)) throw new Error(`Hora de cocina no válida para ${key}.`); }
    else if (['homeMapsUrl','gymMapsUrl','workMapsUrl','mondayRehearsalMapsUrl'].includes(key)) { if (!text(value,2000)) throw new Error('Enlace de ubicación no válido.');if(value !== '') { let url;try { url=new URL(value); } catch { throw new Error('Enlace de ubicación no válido.'); }if(url.protocol !== 'https:' || url.username || url.password) throw new Error('Usá un enlace HTTPS de ubicación.'); } }
    else if (key === 'recordingCare') { if (!oneOf(value,['pending','withMe','covered'])) throw new Error('Cuidado de grabación no válido.'); }
    else if (key === 'danceTransport') { if (!oneOf(value,['pending','me','other'])) throw new Error('Traslado no válido.'); }
    else if (key === 'recordingDay') { if (!Number.isInteger(value) || !finite(value,0,6)) throw new Error('Día de grabación no válido.'); }
    else if (typeof value === 'number') { if (!finite(value,0,key === 'sleepHours' ? 24 : 1440)) throw new Error(`Número no válido para ${key}.`); }
    else if (typeof value !== 'boolean' && !text(value,300)) throw new Error(`Valor no válido para ${key}.`);
    return value;
  }
  if (!plain(value)) throw new Error(`Entrada no válida en ${section}.`);
  if (section === 'extras') {
    if (!text(value.id,200) || !value.id || value.id !== key || !text(value.title,300) || !value.title.trim() || !time(value.startHHmm) || !finite(value.durationMin,1,1440) || !finite(value.travelMin,0,1440) || !oneOf(value.kind,['work','personal'])) throw new Error('Compromiso no válido.');
    if ((value.date === undefined) === (value.days === undefined) || (value.date !== undefined && !date(value.date)) || (value.days !== undefined && (!weekdays(value.days) || !(value.days as unknown[]).length))) throw new Error('Fecha o repetición del compromiso no válida.');
    if (Object.keys(value).some(field => !['id','title','date','days','startHHmm','durationMin','travelMin','kind'].includes(field))) throw new Error('El compromiso contiene campos desconocidos.');
    return value;
  }
  if (section === 'overrides') {
    if (!date(key) || Object.keys(value).some(field => !['schoolClosed','dropoff','pickup','care','skipPewen'].includes(field)) || (value.schoolClosed !== undefined && typeof value.schoolClosed !== 'boolean') || (value.skipPewen !== undefined && typeof value.skipPewen !== 'boolean') || ['dropoff','pickup','care'].some(field => value[field] !== undefined && !oneOf(value[field],['auto','me','other']))) throw new Error('Cambio de fecha no válido.');
    return value;
  }
  if (section === 'journal') {
    if (!date(key) || Object.keys(value).some(field => !Object.prototype.hasOwnProperty.call(journalTemplate,field))) throw new Error('Entrada del diario no válida.');
    const entry = {...journalTemplate,...value};
    if (!finite(entry.energy,0,5) || !Number.isInteger(entry.energy) || Object.entries(entry).some(([field,item]) => field !== 'energy' && !text(item,10000))) throw new Error('Texto o energía del diario no válidos.');
    return entry;
  }
  if (['habits','tasks','projects'].includes(section)) {
    if (value.id !== key || !text(value.id,200) || !text(section === 'habits' ? value.name : value.title,300) || !String(section === 'habits' ? value.name : value.title).trim()) throw new Error(`Identificador o título no válido en ${section}.`);
    if (section === 'habits') { const entry = {cue:'',tinyStep:'',...value};if (Object.keys(entry).some(field => !['id','name','cue','tinyStep'].includes(field)) || !text(entry.cue,2000) || !text(entry.tinyStep,2000)) throw new Error('Hábito no válido.');return entry; }
    if (section === 'projects') { const entry = {outcome:'',archived:false,...value};if (Object.keys(entry).some(field => !['id','title','outcome','archived'].includes(field)) || !text(entry.outcome,10000) || typeof entry.archived !== 'boolean') throw new Error('Proyecto no válido.');return entry; }
    const entry = {...taskTemplate,...value};
    if (Object.keys(entry).some(field => !['id','title',...Object.keys(taskTemplate)].includes(field)) || !oneOf(entry.status,taskStatuses) || !oneOf(entry.energy,['low','medium','high']) || !finite(entry.minutes,1,1440) || !text(entry.notes,10000) || !text(entry.context,300) || !text(entry.projectId,200) || !text(entry.waitingFor,1000) || (entry.due !== '' && !date(entry.due)) || !text(entry.createdAt,100) || !text(entry.updatedAt,100)) throw new Error('Acción GTD no válida.');
    return entry;
  }
  throw new Error(`Sección no admitida: ${section}.`);
}
export function normalizeLifeSection(section: string, value: unknown, mergeInitial = false): unknown {
  if (!allowed(section)) throw new Error(`Sección no admitida: ${section}.`);
  assertJson(value);
  if ((section === 'extras') !== Array.isArray(value) || (!Array.isArray(value) && !plain(value))) throw new Error(`Formato no válido para ${section}.`);
  const entries = sectionEntries(section,value), normalized: Record<string,unknown> = {};
  if (Array.isArray(value) && (value.length > 2000 || Object.keys(entries).length !== value.length)) throw new Error('La lista tiene identificadores repetidos o demasiados elementos.');
  for (const [key,item] of Object.entries(entries)) normalized[key] = normalizedEntry(section,key,item);
  if (Array.isArray(value)) return Object.values(normalized);
  const initial = defaults.get(section);
  return mergeInitial && ['settings','profile'].includes(section) && plain(initial) ? {...initial,...normalized} : normalized;
}
function readSection(section: string, initial: unknown): unknown {
  try { return normalizeLifeSection(section,read(storageKey(section),clone(initial)),true); }
  catch { storageError = `Se omitieron datos no válidos de ${section}. Conservá una copia del navegador antes de reemplazarlos.`;return clone(initial); }
}
function ensure(section: string, initial: unknown): void {
  if (!allowed(section)) throw new Error(`Sección no admitida: ${section}`);
  if (!defaults.has(section)) defaults.set(section, clone(initial));
  if (!values.has(section)) {
    const fallback = defaults.get(section);
    const value = activeScope && remoteSnapshot ? normalizeLifeSection(section,materializeSection(section,fallback,[...remoteSnapshot,...pending.values()]),true) : readSection(section,fallback);
    values.set(section,value);
  }
}

export function recordId(section: string, key: string): string { return `${encodeURIComponent(section)}~${encodeURIComponent(key).replace(/~/g, '%7E')}`; }
export function decodeRecordId(id: string): {section: string; key: string} | null {
  try { const at = id.indexOf('~'); if (at < 1) return null; const section = decodeURIComponent(id.slice(0,at)); const key = decodeURIComponent(id.slice(at + 1)); return allowed(section) && key && !['__proto__','prototype','constructor'].includes(key) ? {section,key} : null; } catch { return null; }
}
export function sectionEntries(section: string, value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const entries: Record<string, unknown> = Object.create(null);
    for (const item of value) if (plain(item) && typeof item.id === 'string' && item.id) entries[item.id] = clone(item);
    return entries;
  }
  if (plain(value)) return clone(value);
  throw new Error(`La sección ${section} debe ser un objeto o una lista con id.`);
}
export function diffSection(section: string, previous: unknown, next: unknown, updatedAt = Date.now()): LifeRecord[] {
  const before = sectionEntries(section, previous), after = sectionEntries(section, next);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return [];
    const deleted = !Object.prototype.hasOwnProperty.call(after, key);
    return [{section,key,value: deleted ? null : after[key],deleted,updatedAt}];
  });
}
export function materializeSection(section: string, initial: unknown, records: LifeRecord[]): unknown {
  const entries = sectionEntries(section, initial);
  for (const record of records) {
    if (record.section !== section || ['__proto__','prototype','constructor'].includes(record.key)) continue;
    if (record.deleted) delete entries[record.key];
    else entries[record.key] = clone(record.value);
  }
  return Array.isArray(initial) ? Object.values(entries) : entries;
}

function updateSection<T>(section: string, action: SetStateAction<T>): void {
  const previous = values.get(section) as T;
  const next = normalizeLifeSection(section,clone(typeof action === 'function' ? (action as (value:T) => T)(previous) : action),true);
  const changes = diffSection(section, previous, next, revision = Math.max(revision + 1,Date.now()));
  if (!changes.length) return;
  values.set(section, next);
  write(storageKey(section), next);
  if (activeScope) { changes.forEach(record => pending.set(recordId(section,record.key), record)); persistPending(); }
  emit(); notifyCloud?.();
}
const setters = new Map<string, Dispatch<SetStateAction<unknown>>>();
export function useLifeState<T>(section: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  ensure(section, initial);
  if (!setters.has(section)) setters.set(section, action => updateSection(section, action));
  const state = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => values.get(section) as T, () => initial);
  return [state, setters.get(section) as Dispatch<SetStateAction<T>>];
}

export function bindCloudWriter(callback: () => void): void { notifyCloud = callback; }
export function getStorageError(): string | null { return storageError; }
export function getStoreScope(): string | null { return activeScope; }
export function setStoreScope(scope: string | null): void {
  if (activeScope === scope) return;
  activeScope = scope;
  remoteSnapshot = null;
  const saved = scope ? read<LifeRecord[]>(pendingKey(), []) : [];
  pending = new Map(saved.filter(isLifeRecord).map(record => [recordId(record.section,record.key),record]));
  for (const [section, initial] of defaults) values.set(section, readSection(section,initial));
  emit();
}
export function getPendingRecords(): LifeRecord[] { return [...pending.values()]; }
export function acknowledgeRecords(sent: LifeRecord[]): void {
  for (const record of sent) { const id = recordId(record.section,record.key); if (pending.get(id)?.updatedAt === record.updatedAt) pending.delete(id); }
  persistPending(); emit();
}
export function isLifeRecord(value: unknown): value is LifeRecord {
  if (!plain(value) || !allowed(String(value.section)) || typeof value.key !== 'string' || !value.key || ['__proto__','prototype','constructor'].includes(value.key) || typeof value.deleted !== 'boolean' || typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return false;
  if (!Object.prototype.hasOwnProperty.call(value,'value')) return false;
  try { if (!value.deleted) normalizedEntry(String(value.section),value.key,value.value);assertJson(value.value);return true; } catch { return false; }
}
export function receiveCloudSnapshot(records: LifeRecord[]): void {
  remoteSnapshot = records.filter(isLifeRecord);
  const merged = new Map(records.filter(isLifeRecord).map(record => [recordId(record.section,record.key),record]));
  // Locally queued edits survive a reconnect until the server acknowledges them.
  pending.forEach((record,id) => merged.set(id,record));
  const all = [...merged.values()];
  for (const [section, initial] of defaults) {
    const next = normalizeLifeSection(section,materializeSection(section, initial, all),true);
    values.set(section, next); write(storageKey(section), next);
  }
  emit();
}
export function getLifeBackup(): LifeBackup {
  const sections: Record<string,unknown> = {};
  for (const section of LIFE_SECTIONS) {
    const value = values.has(section) ? values.get(section) : read(storageKey(section), undefined);
    if (value !== undefined) sections[section] = clone(value);
  }
  return {version:1,exportedAt:new Date().toISOString(),sections};
}
export function restoreLifeBackup(data: unknown): void {
  if (!plain(data) || data.version !== 1 || !plain(data.sections)) throw new Error('Formato de respaldo no válido.');
  if (JSON.stringify(data).length > 5_000_000) throw new Error('El respaldo es demasiado grande.');
  const sections = Object.entries(data.sections);
  if (!sections.length || sections.some(([key,value]) => !allowed(key) || (!plain(value) && !Array.isArray(value)))) throw new Error('El respaldo contiene secciones no válidas.');
  const validated = sections.map(([section,value]) => [section,normalizeLifeSection(section,value)] as const); // Validate everything before changing anything.
  for (const [section,value] of validated) {
    ensure(section, Array.isArray(value) ? [] : {});
    const current = values.get(section);
    updateSection(section,['settings','profile'].includes(section) && plain(current) && plain(value) ? {...current,...value} : value);
  }
}
export function localDeviceRecords(): LifeRecord[] {
  const records: LifeRecord[] = [];
  for (const section of LIFE_SECTIONS) {
    const raw = read<unknown>(storageKey(section,null), undefined);
    const local = raw === undefined ? undefined : normalizeLifeSection(section,raw);
    if (local === undefined) continue;
    for (const [key,value] of Object.entries(sectionEntries(section,local))) records.push({section,key,value,deleted:false,updatedAt:revision = Math.max(revision + 1,Date.now())});
  }
  return records;
}
export function queueLocalDeviceRecords(records: LifeRecord[]): void {
  if (!activeScope) throw new Error('Primero iniciá sesión.');
  records.forEach(record => pending.set(recordId(record.section,record.key),record));
  persistPending();
  receiveCloudSnapshot(records);
  notifyCloud?.();
}

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (!event.key?.startsWith(prefix)) return;
  if (event.key === pendingKey() && activeScope) {
    const saved = read<LifeRecord[]>(pendingKey(),[]); pending = new Map(saved.filter(isLifeRecord).map(record => [recordId(record.section,record.key),record]));
  }
  for (const [section,initial] of defaults) if (event.key === storageKey(section)) values.set(section,readSection(section,initial));
  emit(); notifyCloud?.();
});
