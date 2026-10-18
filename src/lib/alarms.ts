import { Capacitor, registerPlugin } from '@capacitor/core';
import { addDays, buildDay, formatTime, isoDate, type DayOverride, type ExtraEvent, type Settings } from './planner';
import { getNightPlan } from './sleep';

export type AlarmKind = 'wake' | 'reminder';
export type DeviceAlarm = { id: string; title: string; date: string; time: string; kind: AlarmKind };
export type AlarmCategory = 'travel' | 'school' | 'work' | 'recording' | 'gym' | 'personal' | 'family';
export type AlarmPreferences = { wake: boolean; bedtime: boolean; agenda: boolean; creatine: boolean; beforeMin: number; categories: AlarmCategory[]; custom: DeviceAlarm[] };
export type ScheduledAlarm = { id: number; at: number; title: string; body: string; kind: AlarmKind };
export type AlarmPreview = ScheduledAlarm & { key: string; source: 'wake' | 'bedtime' | 'agenda' | 'creatine' | 'custom' };
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
export function loadAlarmPreferences(scope: string | null) { try { return normalizeAlarmPreferences(JSON.parse(localStorage.getItem(preferenceKey(scope)) || 'null')); } catch { return defaultAlarmPreferences(); } }
export function saveAlarmPreferences(scope: string | null, prefs: AlarmPreferences) { localStorage.setItem(preferenceKey(scope),JSON.stringify(normalizeAlarmPreferences(prefs))); }

/** Positive IDs are stable across a refresh; titles and times can change without accumulating alarms. */
export function stableAlarmId(key: string): number { let hash = 2166136261; for (const c of key) {hash ^= c.charCodeAt(0);hash = Math.imul(hash,16777619);} return (hash >>> 0) % 2147483646 + 1; }
export function buildAlarmBatch({settings,overrides = {},extras = [],done = {},preferences,now = Date.now()}:{settings:Settings;overrides?:Record<string,DayOverride>;extras?:ExtraEvent[];done?:Record<string,boolean>;preferences:AlarmPreferences;now?:number}): AlarmBatch {
  const prefs = normalizeAlarmPreferences(preferences), today = isoDate(new Date(now)), through = addDays(today,13);
  const candidates: Omit<AlarmPreview,'id'>[] = [];
  const push = (key:string,at:number,title:string,body:string,kind:AlarmKind,source:AlarmPreview['source']) => { if (Number.isFinite(at) && at > now) candidates.push({key,at,title:title.slice(0,180),body:body.slice(0,450),kind,source}); };
  if (settings.scheduleEnabled === true && prefs.bedtime) for (let offset=-1;offset<14;offset++) {
    // A night can start after midnight: include yesterday's night anchor, then
    // limit by the actual date of the bedtime instead of the date of the wake-up.
    const night = getNightPlan(addDays(today,offset),settings,overrides,extras);
    if (night.bedtimeDate < today || night.bedtimeDate > through) continue;
    const wakeDay = new Date(night.wakeDate+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
    push(`bedtime:${night.wakeDate}`,alarmEpoch(night.bedtimeDate,formatTime(night.bedtime)),'Hora de ir a dormir',`Hora propuesta para acostarte: ${formatTime(night.bedtime)}. Para levantarte el ${wakeDay} a las ${formatTime(night.wakeTime)} y reservar ${night.sleepHours} h de descanso.${night.conflicts.length ? ' Hay compromisos después de esa hora; revisá la agenda.' : ''}`,'reminder','bedtime');
  }
  if (settings.scheduleEnabled === true && (prefs.wake || prefs.agenda || prefs.creatine)) for (let offset=0;offset<14;offset++) {
    const date = addDays(today,offset), plan = buildDay(date,settings,overrides,extras);
    if (prefs.wake) push(`wake:${date}`,alarmEpoch(date,formatTime(plan.wakeTime)),'Hora de levantarte',`Tu agenda de hoy empieza despertando a las ${formatTime(plan.wakeTime)}.`,'wake','wake');
    if (prefs.creatine && settings.breakfastCreatine === true) {
      const breakfast = plan.events.find(event => event.id === 'meal-breakfast');
      if (breakfast && !done[date+':'+breakfast.id]) push(`creatine:${date}`,alarmEpoch(date,formatTime(breakfast.start)),'Creatina con el desayuno','Tu recordatorio de cada mañana: tomar creatina junto con el desayuno.','reminder','creatine');
    }
    if (prefs.agenda) for (const event of plan.events) {
      if (event.id.startsWith('care-') || done[date+':'+event.id] || !prefs.categories.includes(event.kind as AlarmCategory)) continue;
      const at = alarmEpoch(date,formatTime(event.start)) - prefs.beforeMin * 60000;
      push(`agenda:${date}:${event.id}`,at,event.title,`${prefs.beforeMin ? `En ${prefs.beforeMin} min · ` : ''}${formatTime(event.start)}${event.tentative ? ' · Horario estimado' : ''}${event.detail ? ' · '+event.detail : ''}`,'reminder','agenda');
    }
  }
  for (const alarm of prefs.custom) push(`custom:${alarm.id}`,alarmEpoch(alarm.date,alarm.time),alarm.title,'Recordatorio puntual de Mi Vida.',alarm.kind,'custom');
  // Reserve capacity for explicit punctual alarms, even when they fall beyond the rolling agenda horizon.
  const custom = candidates.filter(c => c.source === 'custom').sort((a,b) => a.at-b.at || a.key.localeCompare(b.key));
  const automatic = candidates.filter(c => c.source !== 'custom').sort((a,b) => a.at-b.at || a.key.localeCompare(b.key));
  const selected = [...custom,...automatic.slice(0,Math.max(0,200-custom.length))];
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
