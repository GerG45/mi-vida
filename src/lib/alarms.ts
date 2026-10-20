import { Capacitor, registerPlugin } from '@capacitor/core';
import { addDays, buildDay, formatTime, isoDate, type DayOverride, type ExtraEvent, type Settings } from './planner';
import { getNightPlan, SLEEP_PREPARATION_MINUTES } from './sleep';
import type { CalendarEventOccurrence } from './calendarModel';

export type AlarmKind = 'wake' | 'reminder';
export type DeviceAlarm = { id: string; title: string; date: string; time: string; kind: AlarmKind };
export type AlarmCategory = 'travel' | 'school' | 'work' | 'recording' | 'gym' | 'personal' | 'family';
export type AlarmPreferences = { wake: boolean; bedtime: boolean; agenda: boolean; creatine: boolean; beforeMin: number; categories: AlarmCategory[]; custom: DeviceAlarm[] };
export type ScheduledAlarm = { id: number; at: number; title: string; body: string; kind: AlarmKind };
export type AlarmPreview = ScheduledAlarm & { key: string; source: 'wake' | 'bedtime' | 'bedtime-prepare' | 'agenda' | 'creatine' | 'custom' };
export type AlarmBatch = { notifications: ScheduledAlarm[]; preview: AlarmPreview[]; through: string; omitted: number };
export type AlarmPermissionStatus = { granted: boolean; notifications: boolean; exactAlarms: boolean; fullScreen: boolean; alarmVolume: number; alarmMaxVolume: number; pending: number; stored: number; nextAt: number | null; lastError: string | null };
export interface LifeRemindersPlugin {
  permissionStatus(): Promise<AlarmPermissionStatus>;
  requestPermission(): Promise<AlarmPermissionStatus>;
  openExactAlarmSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openFullScreenSettings(): Promise<void>;
  openAlarmSettings(): Promise<void>;
  schedule(options: { notifications: ScheduledAlarm[] }): Promise<unknown>;
  testAlarm(): Promise<unknown>;
  cancelAll(): Promise<unknown>;
}
export const LifeReminders = registerPlugin<LifeRemindersPlugin>('LifeReminders');
export function isAndroidAlarms() { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'; }
export const alarmCategories: { value: AlarmCategory; label: string }[] = [
  {value:'travel',label:'Salidas y traslados'}, {value:'school',label:'Jardín'}, {value:'work',label:'Trabajo y ensayos'},
  {value:'recording',label:'Grabaciones'}, {value:'gym',label:'Entrenamiento'}, {value:'personal',label:'Personales'}, {value:'family',label:'Familia y danza'},
];
export function defaultAlarmPreferences(): AlarmPreferences { return {wake:false,bedtime:false,agenda:false,creatine:false,beforeMin:10,categories:alarmCategories.map(c => c.value),custom:[]}; }
export function alarmEpoch(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [year,month,day] = date.split('-').map(Number), [hour,minute] = time.split(':').map(Number);
  const result = new Date(year,month-1,day,hour,minute);
  return result.getFullYear() === year && result.getMonth() === month-1 && result.getDate() === day && result.getHours() === hour && result.getMinutes() === minute ? result.getTime() : NaN;
}
export function normalizeAlarmPreferences(raw: unknown): AlarmPreferences {
  const defaults = defaultAlarmPreferences();
  if (!raw || typeof raw !== 'object') return defaults;
  const value = raw as Partial<AlarmPreferences>;
  return {
    wake:value.wake === true, bedtime:value.bedtime === true, agenda:value.agenda === true, creatine:value.creatine === true,
    beforeMin:typeof value.beforeMin === 'number' && Number.isFinite(value.beforeMin) ? Math.max(0,Math.min(60,Math.round(value.beforeMin))) : defaults.beforeMin,
    categories:Array.isArray(value.categories) ? [...new Set(value.categories.filter((category): category is AlarmCategory => alarmCategories.some(c => c.value === category)))] : defaults.categories,
    custom:Array.isArray(value.custom) ? value.custom.filter((item): item is DeviceAlarm => !!item && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0 && item.id.length < 150 && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 100 && Number.isFinite(alarmEpoch(item.date,item.time)) && (item.kind === 'wake' || item.kind === 'reminder')).slice(0,30) : [],
  };
}
function preferenceKey(scope: string | null) { return 'mi-vida.device-alarms.v1.' + encodeURIComponent(scope || 'local'); }
export function loadAlarmPreferences(scope: string | null, enableSleepRoutine = isAndroidAlarms()): AlarmPreferences {
  let raw: unknown = null;
  try { raw=JSON.parse(localStorage.getItem(preferenceKey(scope)) || 'null'); } catch { /* Keep the rest of the app usable when storage is unavailable. */ }
  const preferences=normalizeAlarmPreferences(raw);
  // The requested two-step routine is enabled once on Android, without changing wake-up choices.
  // Persisting the marker together with the choices preserves a later explicit opt-out.
  if(enableSleepRoutine && (!raw || typeof raw!=='object' || !('bedtimeRoutineVersion' in raw) || raw.bedtimeRoutineVersion!==1)) {
    const migrated={...preferences,bedtime:true};
    try { saveAlarmPreferences(scope,migrated); } catch { /* Still usable for this session; later explicit changes report storage errors in the UI. */ }
    return migrated;
  }
  return preferences;
}
export function saveAlarmPreferences(scope: string | null, prefs: AlarmPreferences) { localStorage.setItem(preferenceKey(scope),JSON.stringify({...normalizeAlarmPreferences(prefs),bedtimeRoutineVersion:1})); }
export const BEDTIME_PREPARATION_MINUTES = SLEEP_PREPARATION_MINUTES;

/** Positive IDs are stable across a refresh; titles and times can change without accumulating alarms. */
export function stableAlarmId(key: string): number { let hash = 2166136261; for (const c of key) {hash ^= c.charCodeAt(0);hash = Math.imul(hash,16777619);} return (hash >>> 0) % 2147483646 + 1; }
export function buildAlarmBatch({settings,overrides = {},extras = [],done = {},preferences,now = Date.now(),externalOccurrences = []}:{settings:Settings;overrides?:Record<string,DayOverride>;extras?:ExtraEvent[];done?:Record<string,boolean>;preferences:AlarmPreferences;now?:number;externalOccurrences?:CalendarEventOccurrence[]}): AlarmBatch {
  const prefs = normalizeAlarmPreferences(preferences), today = isoDate(new Date(now)), through = addDays(today,13);
  const candidates: Omit<AlarmPreview,'id'>[] = [];
  const push = (key:string,at:number,title:string,body:string,kind:AlarmKind,source:AlarmPreview['source']) => { if (Number.isFinite(at) && at > now) candidates.push({key,at,title:title.slice(0,180),body:body.slice(0,450),kind,source}); };
  if (settings.scheduleEnabled === true && prefs.bedtime) for (let offset=-1;offset<14;offset++) {
    // Each phase is bounded by its own actual date: a midnight bedtime can have
    // its preparation on the previous day, including the last day of this window.
    const night = getNightPlan(addDays(today,offset),settings,overrides,extras,externalOccurrences);
    const wakeDay = new Date(night.wakeDate+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
    const bedtimeAt=alarmEpoch(night.bedtimeDate,formatTime(night.bedtime));
    const prepareAt=bedtimeAt-BEDTIME_PREPARATION_MINUTES*60000;
    const inWindow=(at:number)=>{const date=isoDate(new Date(at));return date>=today&&date<=through;};
    if(inWindow(prepareAt))push(`bedtime-prepare:${night.wakeDate}`,prepareAt,'Prepararte para dormir',`En ${BEDTIME_PREPARATION_MINUTES} min, a las ${formatTime(night.bedtime)}, es tu hora propuesta para acostarte. Empezá a bajar el ritmo y dejá listo lo de mañana. Despertar del ${wakeDay}: ${formatTime(night.wakeTime)}.`,'reminder','bedtime-prepare');
    if(inWindow(bedtimeAt))push(`bedtime:${night.wakeDate}`,bedtimeAt,'Hora de ir a dormir',`Hora propuesta para acostarte: ${formatTime(night.bedtime)}. Para levantarte el ${wakeDay} a las ${formatTime(night.wakeTime)} y reservar ${night.sleepHours} h de descanso.${night.conflicts.length ? ' Hay compromisos después de esa hora; revisá la agenda.' : ''}`,'reminder','bedtime');
  }
  if (settings.scheduleEnabled === true && (prefs.wake || prefs.agenda || prefs.creatine)) for (let offset=0;offset<14;offset++) {
    const date = addDays(today,offset), plan = buildDay(date,settings,overrides,extras,externalOccurrences);
    if (prefs.wake) push(`wake:${date}`,alarmEpoch(date,formatTime(plan.wakeTime)),'Hora de levantarte',`Tu agenda de hoy empieza despertando a las ${formatTime(plan.wakeTime)}.`,'wake','wake');
    if (prefs.creatine && settings.breakfastCreatine === true) {
      const breakfast = plan.events.find(event => event.id === 'meal-breakfast');
      if (breakfast && !done[date+':'+breakfast.id]) push(`creatine:${date}`,alarmEpoch(date,formatTime(breakfast.start)),'Creatina con el desayuno','Tu recordatorio de cada mañana: tomar creatina junto con el desayuno.','reminder','creatine');
    }
    if (prefs.agenda) for (const event of plan.events) {
      if (event.source === 'google' || event.id.startsWith('care-') || done[date+':'+event.id] || !prefs.categories.includes(event.kind as AlarmCategory)) continue;
      const at = alarmEpoch(date,formatTime(event.start)) - prefs.beforeMin * 60000;
      push(`agenda:${date}:${event.id}`,at,event.title,`${prefs.beforeMin ? `En ${prefs.beforeMin} min · ` : ''}${formatTime(event.start)}${event.tentative ? ' · Horario estimado' : ''}${event.detail ? ' · '+event.detail : ''}`,'reminder','agenda');
    }
  }
  for (const alarm of prefs.custom) push(`custom:${alarm.id}`,alarmEpoch(alarm.date,alarm.time),alarm.title,'Recordatorio puntual de Mi Vida.',alarm.kind,'custom');
  // Protect punctual alarms, waking and both sleep phases before filling the remaining agenda slots.
  const custom = candidates.filter(c => c.source === 'custom').sort((a,b) => a.at-b.at || a.key.localeCompare(b.key));
  const protectedSources = new Set<AlarmPreview['source']>(['wake','bedtime','bedtime-prepare']);
  const protectedAutomatic = candidates.filter(c => protectedSources.has(c.source)).sort((a,b) => a.at-b.at || a.key.localeCompare(b.key));
  const automatic = candidates.filter(c => c.source !== 'custom'&&!protectedSources.has(c.source)).sort((a,b) => a.at-b.at || a.key.localeCompare(b.key));
  const selected = [...custom,...protectedAutomatic,...automatic.slice(0,Math.max(0,200-custom.length-protectedAutomatic.length))];
  const ids = new Set<number>();
  const preview = selected.sort((a,b) => a.key.localeCompare(b.key)).map(candidate => {let id=stableAlarmId(candidate.key);while(ids.has(id)) id=id === 2147483646 ? 1 : id+1;ids.add(id);return {...candidate,id};}).sort((a,b) => a.at-b.at || a.key.localeCompare(b.key));
  return {notifications:preview.map(({id,at,title,body,kind}) => ({id,at,title,body,kind})),preview,through,omitted:candidates.length-preview.length};
}

// One queue prevents a slow older bridge call from restoring another account's alarms.
let nativeQueue = Promise.resolve();
let schedulerRevision = 0;
export function invalidateAlarmSchedule() { return ++schedulerRevision; }
export function queueAlarmSchedule(revision:number,notifications:ScheduledAlarm[],cancelFirst=false): Promise<AlarmPermissionStatus | null> {
  const result = nativeQueue.catch(() => {}).then(async () => {
    if (revision !== schedulerRevision) return null;
    if (cancelFirst) await LifeReminders.cancelAll();
    if (revision !== schedulerRevision) return null;
    const status = await LifeReminders.permissionStatus();
    if (revision !== schedulerRevision) return null;
    if (!status.granted) await LifeReminders.cancelAll();
    else await LifeReminders.schedule({notifications});
    if (revision !== schedulerRevision) return null;
    return LifeReminders.permissionStatus();
  });
  nativeQueue = result.then(() => {},() => {});
  return result;
}
