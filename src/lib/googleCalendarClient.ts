import { buildDay, formatTime, type DayOverride, type ExtraEvent, type Settings } from './planner';
import { CALENDAR_TIME_ZONE, isCalendarDate, normalizeGoogleCalendarEvents, type CalendarEventOccurrence, type CalendarExportLink, type CalendarPreferences } from './calendarModel';

const API = 'https://www.googleapis.com/calendar/v3';
const MARKER = 'Mi Vida calendar/v1';
const APP_DELETED = 'mi-vida-deleted-v1';
export type GoogleCalendarChoice = { id:string; title:string; primary:boolean; owned:boolean; managed:boolean };
export type CalendarPublishItem = { id:string; date:string; title:string; startMin:number; endMin:number; tentative:boolean; hash:string; body:Record<string,unknown> };
export type CalendarPublishResult = { links:Record<string,CalendarExportLink>; created:number; updated:number; removed:number; unchanged:number; conflicts:string[] };
type RawEvent = Record<string,unknown> & { id?:string; etag?:string; status?:string; extendedProperties?:{private?:Record<string,string>} };
export class CalendarApiError extends Error {
  constructor(public status:number, public reason:string) {
    super(status===401?'La autorización de Google venció. Volvé a conectar Calendar.':status===403 && /accessNotConfigured|SERVICE_DISABLED/i.test(reason)?'Falta habilitar Google Calendar API en el proyecto de Mi Vida.':status===403?'Google no permitió esta operación. Revisá los permisos de Calendar y volvé a conectar.':status===429?'Google pidió una pausa. Esperá un minuto y volvé a intentar.':status===412?'Ese bloque cambió en Google mientras se actualizaba. Conservamos su versión de Google.':'No se pudo actualizar Google Calendar. Tus datos de Mi Vida se conservan.');
  }
}
const object = (value:unknown):value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);
async function request<T>(token:string,path:string,options:{method?:string;body?:unknown;etag?:string;signal?:AbortSignal}={}):Promise<T> {
  if (!token) throw new CalendarApiError(401,'missingToken');
  const response=await fetch(`${API}${path}`,{method:options.method||'GET',headers:{Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{}),...(options.etag?{'If-Match':options.etag}:{})},body:options.body?JSON.stringify(options.body):undefined,signal:options.signal});
  if (!response.ok) {
    const data=await response.json().catch(()=>null);
    const reason=object(data)&&object(data.error)&&Array.isArray(data.error.errors)&&object(data.error.errors[0])?String(data.error.errors[0].reason||''):'';
    throw new CalendarApiError(response.status,reason);
  }
  return response.status===204?undefined as T:await response.json() as T;
}
export function calendarDayOffset(date:string,offset:number):string { const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10); }
export function calendarToday(now=new Date()):string { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:CALENDAR_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}`; }
function rangeQuery(fromDate:string,throughDate:string):URLSearchParams {
  if (!isCalendarDate(fromDate)||!isCalendarDate(throughDate)||throughDate<fromDate||throughDate>calendarDayOffset(fromDate,13)) throw new Error('Elegí un rango de hasta 14 días.');
  return new URLSearchParams({timeMin:`${fromDate}T00:00:00-03:00`,timeMax:`${calendarDayOffset(throughDate,1)}T00:00:00-03:00`,singleEvents:'true',showDeleted:'false',timeZone:CALENDAR_TIME_ZONE,maxResults:'2500'});
}
export async function listGoogleCalendars(token:string,signal?:AbortSignal):Promise<GoogleCalendarChoice[]> {
  const values:GoogleCalendarChoice[]=[];let page='';const seen=new Set<string>();
  do {
    if (seen.has(page)||seen.size>=20) throw new Error('Google devolvió demasiados calendarios. Probá de nuevo.');seen.add(page);
    const query=new URLSearchParams({maxResults:'250',minAccessRole:'reader',fields:'items(id,summary,primary,accessRole,description,deleted),nextPageToken',...(page?{pageToken:page}:{})});
    const data=await request<{items?:unknown[];nextPageToken?:string}>(token,`/users/me/calendarList?${query}`,{signal});
    for(const value of data.items||[]) if(object(value)&&typeof value.id==='string'&&!value.deleted) values.push({id:value.id,title:typeof value.summary==='string'?value.summary.slice(0,300):'Calendario',primary:value.primary===true,owned:value.accessRole==='owner',managed:typeof value.description==='string'&&value.description.includes(MARKER)});
    page=data.nextPageToken||'';
  }while(page);
  return values.sort((a,b)=>Number(b.primary)-Number(a.primary)||a.title.localeCompare(b.title,'es'));
}
export async function readGoogleCalendarOccurrences(token:string,sourceIds:string[],destinationId:string,fromDate:string,throughDate:string,signal?:AbortSignal):Promise<Record<string,CalendarEventOccurrence>> {
  const result:Record<string,CalendarEventOccurrence>={};
  for(const calendarId of [...new Set(sourceIds)].filter(id=>id!==destinationId).slice(0,30)) {
    const raw:unknown[]=[];let page='';const seen=new Set<string>();
    do {
      if(seen.has(page)||seen.size>=20) throw new Error('Hay demasiados eventos en ese calendario. No se reemplazó tu última lectura.');seen.add(page);
      const query=rangeQuery(fromDate,throughDate);query.set('fields','items(id,summary,start,end,status,transparency,updated,attendees(self,responseStatus)),nextPageToken');if(page)query.set('pageToken',page);
      const data=await request<{items?:unknown[];nextPageToken?:string}>(token,`/calendars/${encodeURIComponent(calendarId)}/events?${query}`,{signal});
      for(const item of data.items||[]) {
        if(object(item)&&Array.isArray(item.attendees)&&item.attendees.some(a=>object(a)&&a.self===true&&a.responseStatus==='declined')) continue;
        raw.push(item);
      }
      if(raw.length>5000) throw new Error('Ese calendario supera los 5000 eventos en dos semanas. No se reemplazó tu última lectura.');
      page=data.nextPageToken||'';
    }while(page);
    Object.assign(result,normalizeGoogleCalendarEvents(calendarId,raw,fromDate,throughDate));
  }
  return result;
}
export function mergeCalendarSnapshot(current:Record<string,CalendarEventOccurrence>,incoming:Record<string,CalendarEventOccurrence>,sourceIds:string[],destinationId:string,fromDate:string,throughDate:string):Record<string,CalendarEventOccurrence> {
  const selected=new Set(sourceIds.filter(id=>id!==destinationId));
  return {...Object.fromEntries(Object.entries(current).filter(([,event])=>event.date<fromDate || event.date>throughDate&&selected.has(event.calendarId))),...incoming};
}
export async function findOrCreateMiVidaCalendar(token:string,destinationId:string,signal?:AbortSignal):Promise<string> {
  const calendars=await listGoogleCalendars(token,signal);
  const existing=calendars.find(calendar=>calendar.id===destinationId&&calendar.managed&&calendar.owned)||calendars.find(calendar=>calendar.managed&&calendar.owned);
  if(existing)return existing.id;
  if(destinationId)throw new Error('No encontramos el calendario de destino. Volvé a conectar para revisar el acceso; no creamos un reemplazo automáticamente.');
  const created=await request<{id:string}>(token,'/calendars',{method:'POST',body:{summary:'Mi Vida.',description:`${MARKER}\nBloques planificados desde Mi Vida. Sin diario ni resultados personales.`,timeZone:CALENDAR_TIME_ZONE},signal});
  if(!created.id)throw new Error('Google no devolvió el calendario creado. Actualizá la lista antes de intentar otra vez.');
  return created.id;
}
async function sha256(value:unknown):Promise<string> { const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(data)].map(byte=>byte.toString(16).padStart(2,'0')).join(''); }
function eventMoment(date:string,min:number):{dateTime:string;timeZone:string} { const actualDate=calendarDayOffset(date,Math.floor(min/1440));return {dateTime:`${actualDate}T${formatTime(min)}:00-03:00`,timeZone:CALENDAR_TIME_ZONE}; }
/** Hash human-editable content as well as fields Mi Vida controls; edits in Google are never overwritten silently. */
async function remoteContentHash(event:RawEvent):Promise<string> {
  const time=(value:unknown)=>object(value)?typeof value.dateTime==='string'?Date.parse(value.dateTime):value.date||'':'';
  const reminders=object(event.reminders)?{useDefault:event.reminders.useDefault===true,overrides:Array.isArray(event.reminders.overrides)?event.reminders.overrides:[]}:{useDefault:true,overrides:[]};
  return sha256({summary:event.summary||'',description:event.description||'',location:event.location||'',start:time(event.start),end:time(event.end),status:event.status||'confirmed',transparency:event.transparency||'opaque',reminders,recurrence:event.recurrence||[],attendees:event.attendees||[],attachments:event.attachments||[]});
}
export async function buildCalendarPublishPreview(input:{ownerEmail:string;fromDate:string;preferences:CalendarPreferences;settings:Settings;overrides:Record<string,DayOverride>;extras:ExtraEvent[];occurrences:Record<string,CalendarEventOccurrence>}):Promise<CalendarPublishItem[]> {
  if(!isCalendarDate(input.fromDate))throw new Error('Fecha de publicación inválida.');
  const result:CalendarPublishItem[]=[];
  const sources=new Set(input.preferences.sourceCalendarIds.filter(id=>id!==input.preferences.destinationId));
  const occurrences=Object.values(input.occurrences).filter(event=>event.date>=input.fromDate&&sources.has(event.calendarId));
  for(let offset=0;offset<14;offset++) {
    const date=calendarDayOffset(input.fromDate,offset),plan=buildDay(date,input.settings,input.overrides,input.extras,occurrences);
    for(const event of plan.events) {
      if(event.source==='google'||event.id.startsWith('google-')||!input.preferences.publishKinds.includes(event.kind)||['school','family','sleep','meal','travel'].includes(event.kind)||event.kind==='personal'&&!event.id.startsWith('extra-')||event.conflict||event.tentative&&!input.preferences.includeTentative||event.end<=event.start)continue;
      const id=`a${await sha256(['mi-vida-v1',input.ownerEmail.trim().toLowerCase(),date,event.id])}`;
      const title=`${event.title}${event.tentative?' · Por confirmar':''}`.slice(0,300);
      const body:RawEvent={id,summary:title,start:eventMoment(date,event.start),end:eventMoment(date,event.end),status:'confirmed',transparency:'opaque',reminders:{useDefault:false,overrides:[]}};
      const hash=await remoteContentHash(body);body.extendedProperties={private:{miVida:'v1',mvContentHash:hash}};
      result.push({id,date,title,startMin:event.start,endMin:event.end,tentative:event.tentative,hash,body});
    }
  }
  return result;
}
export function getObsoleteCalendarLinks(items:CalendarPublishItem[],links:Record<string,CalendarExportLink>,calendarId:string,fromDate:string):CalendarExportLink[] {
  const ids=new Set(items.map(item=>item.id)),throughDate=calendarDayOffset(fromDate,13);
  return Object.values(links).filter(link=>link.calendarId===calendarId&&link.date>=fromDate&&link.date<=throughDate&&link.remoteHash!==APP_DELETED&&!ids.has(link.id));
}
export async function publishMiVidaBlocks(token:string,calendarId:string,items:CalendarPublishItem[],links:Record<string,CalendarExportLink>,fromDate:string,signal?:AbortSignal,onProgress?:(links:Record<string,CalendarExportLink>)=>void):Promise<CalendarPublishResult> {
  const result:CalendarPublishResult={links:{...links},created:0,updated:0,removed:0,unchanged:0,conflicts:[]};
  const base=`/calendars/${encodeURIComponent(calendarId)}/events`;
  const load=async(id:string):Promise<RawEvent|null>=>{try{return await request<RawEvent>(token,`${base}/${encodeURIComponent(id)}`,{signal});}catch(error){if(error instanceof CalendarApiError&&(error.status===404||error.status===410))return null;throw error;}};
  const protectedRemote=async(remote:RawEvent)=>remote.extendedProperties?.private?.miVida!=='v1'||remote.status==='cancelled'||await remoteContentHash(remote)!==remote.extendedProperties.private.mvContentHash;
  for(const item of items) {
    if(item.date<calendarToday())continue;
    const link=links[item.id];let eventId=link?.calendarId===calendarId?link.eventId:item.id;
    let remote=await load(eventId),created=false,restoring=false;
    if(link?.remoteHash===APP_DELETED&&(!remote||remote.status==='cancelled')) {
      // Deleted Calendar IDs cannot reliably be reused. A deterministic successor survives concurrent PC/phone restores.
      eventId=`a${await sha256(['mi-vida-restore-v1',eventId])}`;restoring=true;remote=await load(eventId);
    }
    if(!remote) {
      if(link&&!restoring){result.conflicts.push(`${item.date}: ${item.title} fue eliminado en Google.`);continue;}
      try {remote=await request<RawEvent>(token,`${base}?sendUpdates=none`,{method:'POST',body:{...item.body,id:eventId},signal});created=true;}
      catch(error){if(error instanceof CalendarApiError&&error.status===409)remote=await load(eventId);else throw error;}
    }
    if(!remote||await protectedRemote(remote)){result.conflicts.push(`${item.date}: ${item.title} cambió en Google.`);continue;}
    let remoteHash=await remoteContentHash(remote);
    if(!created&&remoteHash!==item.hash) {
      if(!remote.etag){result.conflicts.push(`${item.date}: ${item.title} no pudo verificarse.`);continue;}
      const {id:_id,...patch}=item.body;
      try {remote=await request<RawEvent>(token,`${base}/${encodeURIComponent(eventId)}?sendUpdates=none`,{method:'PATCH',body:patch,etag:remote.etag,signal});remoteHash=await remoteContentHash(remote);result.updated++;}
      catch(error){if(error instanceof CalendarApiError&&error.status===412){result.conflicts.push(`${item.date}: ${item.title} cambió durante la publicación.`);continue;}throw error;}
    }else if(created)result.created++;else result.unchanged++;
    result.links[item.id]={id:item.id,date:item.date,calendarId,eventId,localHash:item.hash,remoteHash};onProgress?.({...result.links});
  }
  for(const link of getObsoleteCalendarLinks(items,links,calendarId,fromDate)) {
    if(link.date<calendarToday())continue;
    const remote=await load(link.eventId);
    if(remote) {
      if(await protectedRemote(remote)||!remote.etag){result.conflicts.push(`${link.date}: conservamos un bloque modificado en Google.`);continue;}
      try {await request<void>(token,`${base}/${encodeURIComponent(link.eventId)}?sendUpdates=none`,{method:'DELETE',etag:remote.etag,signal});result.removed++;}
      catch(error){if(error instanceof CalendarApiError&&error.status===412){result.conflicts.push(`${link.date}: un bloque cambió durante la publicación.`);continue;}throw error;}
    }
    // Keep an app-deletion tombstone, so a later reappearance can safely restore the same Google ID.
    result.links[link.id]={...link,remoteHash:APP_DELETED};onProgress?.({...result.links});
  }
  return result;
}
