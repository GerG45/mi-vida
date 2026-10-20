import type { EventKind } from './planner';

/** Calendar snapshots deliberately contain no descriptions, people, places or OAuth credentials. */
export type CalendarEventOccurrence = {
  id: string;
  calendarId: string;
  eventId: string;
  title: string;
  date: string;
  startMin: number;
  endMin: number;
  allDay: boolean;
  busy: boolean;
  updatedAt: number;
};
export type CalendarPreferences = {
  sourceCalendarIds: string[];
  publishKinds: EventKind[];
  includeTentative: boolean;
  destinationId: string;
  lastReadAt: number | null;
  lastPublishAt: number | null;
};
export type CalendarExportLink = {
  id: string;
  date: string;
  calendarId: string;
  eventId: string;
  localHash: string;
  remoteHash: string;
};

export const CALENDAR_TIME_ZONE = 'America/Argentina/Buenos_Aires';
export const CALENDAR_MAX_DAYS = 14;
const kinds: readonly EventKind[] = ['school','travel','work','recording','gym','meal','cooking','family','personal','sleep'];
const occurrenceFields = ['id','calendarId','eventId','title','date','startMin','endMin','allDay','busy','updatedAt'];
const preferencesFields = ['sourceCalendarIds','publishKinds','includeTentative','destinationId','lastReadAt','lastPublishAt'];
const exportFields = ['id','date','calendarId','eventId','localHash','remoteHash'];
const object = (value: unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string,unknown>, fields: string[]) => Object.keys(value).length === fields.length && Object.keys(value).every(field => fields.includes(field));
const identifier = (value: unknown, max = 1024): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) && !['__proto__','prototype','constructor'].includes(value);
const stamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const optionalStamp = (value: unknown): value is number | null => value === null || stamp(value);
const minute = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440;
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const epoch = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(epoch) && value >= '1900-01-01' && value <= '2200-12-31' && new Date(epoch).toISOString().slice(0,10) === value;
}

export function normalizeCalendarEventOccurrence(value: unknown, key?: string): CalendarEventOccurrence | undefined {
  if (!object(value) || !exact(value,occurrenceFields) || !identifier(value.id,500) || (key !== undefined && value.id !== key)
    || !identifier(value.calendarId) || !identifier(value.eventId) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300
    || !isCalendarDate(value.date) || !minute(value.startMin) || !minute(value.endMin) || value.endMin <= value.startMin
    || typeof value.allDay !== 'boolean' || typeof value.busy !== 'boolean' || !stamp(value.updatedAt)
    || (value.allDay && (value.startMin !== 0 || value.endMin !== 1440))) return undefined;
  return {id:value.id,calendarId:value.calendarId,eventId:value.eventId,title:value.title,date:value.date,startMin:value.startMin,endMin:value.endMin,allDay:value.allDay,busy:value.busy,updatedAt:value.updatedAt};
}
export function isCalendarEventOccurrence(value: unknown): value is CalendarEventOccurrence { return normalizeCalendarEventOccurrence(value) !== undefined; }

export function defaultCalendarPreferences(): CalendarPreferences {
  return {sourceCalendarIds:[],publishKinds:['work','recording','gym','cooking','personal'],includeTentative:false,destinationId:'',lastReadAt:null,lastPublishAt:null};
}
export function normalizeCalendarPreferences(value: unknown): CalendarPreferences | undefined {
  if (!object(value) || !exact(value,preferencesFields) || !Array.isArray(value.sourceCalendarIds) || value.sourceCalendarIds.length > 30
    || !value.sourceCalendarIds.every(id => identifier(id)) || new Set(value.sourceCalendarIds).size !== value.sourceCalendarIds.length
    || !Array.isArray(value.publishKinds) || value.publishKinds.length > kinds.length || !value.publishKinds.every(kind => kinds.includes(kind as EventKind))
    || new Set(value.publishKinds).size !== value.publishKinds.length || typeof value.includeTentative !== 'boolean'
    || (value.destinationId !== '' && !identifier(value.destinationId)) || !optionalStamp(value.lastReadAt) || !optionalStamp(value.lastPublishAt)) return undefined;
  return {sourceCalendarIds:[...value.sourceCalendarIds] as string[],publishKinds:[...value.publishKinds] as EventKind[],includeTentative:value.includeTentative,destinationId:value.destinationId as string,lastReadAt:value.lastReadAt,lastPublishAt:value.lastPublishAt};
}
export function isCalendarPreferences(value: unknown): value is CalendarPreferences { return normalizeCalendarPreferences(value) !== undefined; }
export function normalizeCalendarExportLink(value: unknown, key?: string): CalendarExportLink | undefined {
  if (!object(value) || !exact(value,exportFields) || !identifier(value.id,500) || (key !== undefined && value.id !== key)
    || !isCalendarDate(value.date) || !identifier(value.calendarId) || !identifier(value.eventId)
    || !identifier(value.localHash,500) || !identifier(value.remoteHash,500)) return undefined;
  return {id:value.id,date:value.date,calendarId:value.calendarId,eventId:value.eventId,localHash:value.localHash,remoteHash:value.remoteHash};
}
export function isCalendarExportLink(value: unknown): value is CalendarExportLink { return normalizeCalendarExportLink(value) !== undefined; }

/** A stable identity survives title, offset and time changes on the same occurrence/date. */
export function calendarOccurrenceId(calendarId: string, eventId: string, date: string): string {
  let hash = 14695981039346656037n;
  for (const codePoint of JSON.stringify([calendarId,eventId,date])) {
    const value = codePoint.codePointAt(0)!;
    hash ^= BigInt(value);
    hash = BigInt.asUintN(64,hash * 1099511628211n);
  }
  return `gcal-${hash.toString(16).padStart(16,'0')}-${date}`;
}

const wallFormatter = new Intl.DateTimeFormat('en-CA',{timeZone:CALENDAR_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function wallParts(epoch: number, formatter = wallFormatter): Record<string,string> {
  return Object.fromEntries(formatter.formatToParts(new Date(epoch)).filter(part => part.type !== 'literal').map(part => [part.type,part.value]));
}
function wallDate(epoch: number): string { const p=wallParts(epoch);return `${p.year}-${p.month}-${p.day}`; }
const ordinal = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86400000;
function dayAt(date: string, offset = 0): string { const next = new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+offset);return next.toISOString().slice(0,10); }

/** Convert a zoned wall time without using the device's own timezone. Invalid/DST-gap times are rejected. */
function zonedEpoch(wall: string, timeZone: string): number {
  const match=/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,9}))?)?$/.exec(wall);
  if (!match || !isCalendarDate(match[1])) return NaN;
  const expected=Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4] || '00'}Z`);
  const millis=Number(`0.${match[5] || '0'}`)*1000;
  let formatter: Intl.DateTimeFormat;
  try { formatter=timeZone===CALENDAR_TIME_ZONE?wallFormatter:new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}); }
  catch { return NaN; }
  let result=expected;
  for (let attempt=0;attempt<4;attempt++) {
    const p=wallParts(result,formatter), projected=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    const difference=expected-projected;
    if (!difference) return result + Math.floor(millis);
    result+=difference;
  }
  return NaN;
}
function timedEpoch(value: unknown): number {
  if (!object(value) || typeof value.dateTime !== 'string') return NaN;
  const match=/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,9})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value.dateTime);
  if (match) return isCalendarDate(match[1]) ? Date.parse(value.dateTime) : NaN;
  return typeof value.timeZone === 'string' ? zonedEpoch(value.dateTime,value.timeZone) : NaN;
}
const dayStart = (date: string) => zonedEpoch(`${date}T00:00:00`,CALENDAR_TIME_ZONE);

/**
 * Normalize events.list({singleEvents:true}) results into at most fourteen Buenos Aires dates.
 * Timed end points and all-day end dates are exclusive. Raw Google fields never enter storage.
 */
export function normalizeGoogleCalendarEvents(calendarId: string, rawEvents: unknown, fromDate: string, throughDate: string): Record<string,CalendarEventOccurrence> {
  const result: Record<string,CalendarEventOccurrence> = {};
  if (!identifier(calendarId) || !Array.isArray(rawEvents) || !isCalendarDate(fromDate) || !isCalendarDate(throughDate)
    || throughDate < fromDate || ordinal(throughDate)-ordinal(fromDate) >= CALENDAR_MAX_DAYS) return result;
  const days = Array.from({length:Math.round(ordinal(throughDate)-ordinal(fromDate))+1},(_,offset)=>dayAt(fromDate,offset));
  const rangeStart=dayStart(fromDate), rangeEnd=dayStart(dayAt(throughDate,1));
  for (const raw of rawEvents.slice(0,5000)) {
    if (!object(raw) || !identifier(raw.id) || raw.status === 'cancelled' || (object(raw.selfAttendee) && raw.selfAttendee.responseStatus === 'declined')) continue;
    const title=(typeof raw.summary==='string'?raw.summary:'Sin título').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,300) || 'Sin título';
    const parsedUpdate=typeof raw.updated==='string'?Date.parse(raw.updated):NaN;
    const updatedAt=stamp(parsedUpdate)?parsedUpdate:0;
    const busy=raw.transparency!=='transparent';
    const allDay=object(raw.start) && typeof raw.start.date==='string';
    if (allDay) {
      if (!object(raw.start) || !object(raw.end) || !isCalendarDate(raw.start.date) || !isCalendarDate(raw.end.date) || raw.end.date<=raw.start.date) continue;
      for (const date of days) {
        if (date<raw.start.date || date>=raw.end.date) continue;
        const id=calendarOccurrenceId(calendarId,raw.id,date);
        result[id]={id,calendarId,eventId:raw.id,title,date,startMin:0,endMin:1440,allDay:true,busy,updatedAt};
      }
      continue;
    }
    const start=timedEpoch(raw.start), end=timedEpoch(raw.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end<=start || start>=rangeEnd || end<=rangeStart) continue;
    const first=wallDate(Math.max(start,rangeStart)), last=wallDate(Math.min(end-1,rangeEnd-1));
    for (const date of days) {
      if (date<first || date>last) continue;
      const beginning=dayStart(date), ending=dayStart(dayAt(date,1));
      const clippedStart=Math.max(start,beginning), clippedEnd=Math.min(end,ending);
      if (clippedEnd<=clippedStart) continue;
      const p=wallParts(clippedStart), q=wallParts(clippedEnd);
      const startMin=clippedStart===beginning?0:Number(p.hour)*60+Number(p.minute);
      const endMin=clippedEnd===ending?1440:Math.min(1440,Number(q.hour)*60+Number(q.minute)+(Number(q.second)>0 || clippedEnd%1000>0?1:0));
      if (endMin<=startMin) continue;
      const id=calendarOccurrenceId(calendarId,raw.id,date);
      result[id]={id,calendarId,eventId:raw.id,title,date,startMin,endMin,allDay:false,busy,updatedAt};
    }
  }
  return result;
}

// The planner has no runtime dependency on this model, preserving the pure agenda module.
export { getCalendarBusyEvents } from './planner';
