import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTime, type DayOverride, type ExtraEvent, type Settings, type EventKind } from '../lib/planner';
import { type CalendarEventOccurrence, type CalendarExportLink, type CalendarPreferences } from '../lib/calendarModel';
import { authorizeCalendarAccess, disconnectCalendarAccess, getCalendarAccessToken, subscribeCalendarAuth } from '../lib/calendarAuth';
import { withCalendarDestination } from '../lib/cloud';
import { buildCalendarPublishPreview, CalendarApiError, calendarDayOffset, calendarToday, findOrCreateMiVidaCalendar, getObsoleteCalendarLinks, listGoogleCalendars, mergeCalendarSnapshot, publishMiVidaBlocks, readGoogleCalendarOccurrences, type CalendarPublishItem, type GoogleCalendarChoice } from '../lib/googleCalendarClient';
import './googleCalendar.css';

export type GoogleCalendarPanelProps={preferences:CalendarPreferences;onPreferencesChange:(next:CalendarPreferences)=>void;occurrences:Record<string,CalendarEventOccurrence>;onOccurrencesChange:(next:Record<string,CalendarEventOccurrence>)=>void;links:Record<string,CalendarExportLink>;onLinksChange:(next:Record<string,CalendarExportLink>)=>void;settings:Settings;overrides:Record<string,DayOverride>;extras:ExtraEvent[];userEmail?:string;cloudConnected:boolean;hidden?:boolean};
const kindChoices:{kind:EventKind;label:string}[]=[{kind:'work',label:'Trabajo y proyectos'},{kind:'recording',label:'Grabaciones'},{kind:'gym',label:'Entrenamiento'},{kind:'cooking',label:'Tandas de cocina'},{kind:'personal',label:'Compromisos personales'}];
const stamp=(value:number|null)=>value?new Date(value).toLocaleString('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Todavía no';
const dateLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('es-AR',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'});
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'No se pudo completar la conexión con Google.';

export function GoogleCalendarPanel(props:GoogleCalendarPanelProps) {
  const {preferences,userEmail,cloudConnected,hidden=false}=props;
  const latest=useRef(props);latest.current=props;
  const [authRevision,setAuthRevision]=useState(0),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [calendars,setCalendars]=useState<GoogleCalendarChoice[]>([]),[preview,setPreview]=useState<CalendarPublishItem[]|null>(null);
  const [conflicts,setConflicts]=useState<string[]>([]);
  const active=useRef<AbortController|null>(null),lastRefresh=useRef(0),generation=useRef(0),lastIdentity=useRef('');
  const token=useMemo(()=>getCalendarAccessToken(),[authRevision,userEmail,cloudConnected]);
  const connected=cloudConnected&&!!userEmail&&!!token;
  const selectedCount=preferences.sourceCalendarIds.filter(id=>id!==preferences.destinationId).length;
  const previewSignature=JSON.stringify([props.settings,props.overrides,props.extras,props.occurrences,preferences.publishKinds,preferences.includeTentative,preferences.sourceCalendarIds,preferences.destinationId]);
  const previewIdentity=useRef('');
  const obsolete=preview?getObsoleteCalendarLinks(preview,props.links,preferences.destinationId,calendarToday()):[];

  useEffect(()=>subscribeCalendarAuth(()=>setAuthRevision(value=>value+1)),[]);
  useEffect(()=> {
    const identity=cloudConnected&&userEmail?userEmail.toLowerCase():'';
    if(lastIdentity.current!==identity){lastIdentity.current=identity;generation.current++;active.current?.abort();active.current=null;lastRefresh.current=0;setCalendars([]);setPreview(null);setConflicts([]);setError('');setMessage('');setBusy('');disconnectCalendarAccess();}
  },[userEmail,cloudConnected]);
  useEffect(()=> {if(preview&&previewIdentity.current!==previewSignature)setPreview(null);},[previewSignature,preview]);
  useEffect(()=>()=>{generation.current++;active.current?.abort();},[]);

  const run=async(label:string,action:(accessToken:string,signal:AbortSignal,current:()=>boolean)=>Promise<void>,needsToken=true)=> {
    if(active.current)return;
    const controller=new AbortController(),revision=generation.current,identity=lastIdentity.current;
    active.current=controller;setBusy(label);setError('');setMessage('');
    const current=()=>!controller.signal.aborted&&revision===generation.current&&identity===lastIdentity.current;
    try {const accessToken=getCalendarAccessToken();if(needsToken&&!accessToken)throw new CalendarApiError(401,'expired');await action(accessToken||'',controller.signal,current);}
    catch(caught){if(current()){if(caught instanceof CalendarApiError&&caught.status===401)disconnectCalendarAccess();setError(errorMessage(caught));}}
    finally {if(current())setBusy('');if(active.current===controller)active.current=null;setAuthRevision(value=>value+1);}
  };
  const refresh=async(accessToken:string,signal:AbortSignal,current:()=>boolean)=> {
    const values=latest.current,from=calendarToday(),through=calendarDayOffset(from,13);
    const incoming=await readGoogleCalendarOccurrences(accessToken,values.preferences.sourceCalendarIds,values.preferences.destinationId,from,through,signal);
    if(!current())return;
    const now=Date.now();lastRefresh.current=now;
    const present=latest.current;
    // Reading all pages succeeded before replacing any saved occurrences.
    present.onOccurrencesChange(mergeCalendarSnapshot(present.occurrences,incoming,values.preferences.sourceCalendarIds,values.preferences.destinationId,from,through));
    present.onPreferencesChange({...present.preferences,lastReadAt:now});
    setMessage(Object.keys(incoming).length?`${Object.keys(incoming).length} compromisos actualizados para las próximas dos semanas.`:'Lectura lista. No hay compromisos en los calendarios elegidos para estas dos semanas.');
  };
  useEffect(()=> {
    if(!connected)return;
    const update=()=>{if(document.visibilityState==='visible'&&!active.current&&Date.now()-lastRefresh.current>120000&&getCalendarAccessToken())void run('Actualizando compromisos…',refresh);};
    update();window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    const timer=window.setInterval(update,120000);
    return()=>{window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);window.clearInterval(timer);};
    // The mutable ref provides current account data without restarting the foreground listener on each snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[connected,preferences.sourceCalendarIds.join('|'),preferences.destinationId]);

  function changePreferences(next:CalendarPreferences) {props.onPreferencesChange(next);setPreview(null);setConflicts([]);}
  function toggleSource(id:string,checked:boolean) {
    const next={...preferences,sourceCalendarIds:checked?[...new Set([...preferences.sourceCalendarIds,id])]:preferences.sourceCalendarIds.filter(value=>value!==id)};
    changePreferences(next);lastRefresh.current=0;
    // Deselected calendars disappear from today/future, while historical snapshots remain closed.
    props.onOccurrencesChange(Object.fromEntries(Object.entries(props.occurrences).filter(([,event])=>event.date<calendarToday()||next.sourceCalendarIds.includes(event.calendarId)&&event.calendarId!==next.destinationId)));
  }
  const connect=()=>void run('Conectando con Google…',async(_token,signal,current)=> {
    await authorizeCalendarAccess(latest.current.userEmail);if(!current())return;
    const authorized=getCalendarAccessToken();if(!authorized)throw new CalendarApiError(401,'missingToken');
    const choices=await listGoogleCalendars(authorized,signal);if(current()){setCalendars(choices);if(latest.current.preferences.sourceCalendarIds.length)await refresh(authorized,signal,current);else setMessage('Conexión lista. Elegí qué calendarios querés ver en tu día.');}
  },false);
  const prepare=()=>void run('Preparando vista previa…',async(_token,_signal,current)=> {
    const values=latest.current;if(!values.userEmail)return;
    const items=await buildCalendarPublishPreview({ownerEmail:values.userEmail,fromDate:calendarToday(),preferences:values.preferences,settings:values.settings,overrides:values.overrides,extras:values.extras,occurrences:values.occurrences});
    if(current()){previewIdentity.current=previewSignature;setPreview(items);setConflicts([]);}
  });
  const publish=()=>void run('Publicando tus bloques…',async(accessToken,signal,current)=> {
    const values=latest.current;if(!preview||previewIdentity.current!==previewSignature)throw new Error('Tu agenda cambió. Prepará una vista previa nueva.');
    const destinationId=await withCalendarDestination(canonicalId=>findOrCreateMiVidaCalendar(accessToken,canonicalId||values.preferences.destinationId,signal));if(!current())return;
    values.onPreferencesChange({...latest.current.preferences,destinationId,sourceCalendarIds:latest.current.preferences.sourceCalendarIds.filter(id=>id!==destinationId)});
    const result=await publishMiVidaBlocks(accessToken,destinationId,preview,values.links,calendarToday(),signal,next=>{if(current())latest.current.onLinksChange(next);});
    if(!current())return;
    latest.current.onLinksChange(result.links);latest.current.onPreferencesChange({...latest.current.preferences,destinationId,lastPublishAt:Date.now()});
    setConflicts(result.conflicts);setPreview(null);setMessage(`Calendar actualizado: ${result.created} nuevos, ${result.updated} ajustados, ${result.removed} retirados y ${result.unchanged} sin cambios.${result.conflicts.length?' Conservamos los bloques que editaste en Google.':''}`);
  });
  const disconnect=()=>{generation.current++;active.current?.abort();active.current=null;disconnectCalendarAccess();setCalendars([]);setPreview(null);setBusy('');setError('');setMessage('Conexión cerrada en este dispositivo. Tus calendarios y las últimas lecturas guardadas se conservan.');};

  return <section id="google-calendar-panel" className="panel google-calendar-panel" hidden={hidden} aria-labelledby="google-calendar-heading" aria-busy={!!busy}>
    <div className="section-title"><div><p className="eyebrow">TUS TIEMPOS, EN UN MISMO LUGAR</p><h2 id="google-calendar-heading">Google Calendar</h2></div><span className={'calendar-connection '+(connected?'is-connected':'')}>{connected?'Conectado en este dispositivo':'Conexión opcional'}</span></div>
    <p className="muted">Traé tus compromisos de Google a tu agenda y publicá tus bloques en un calendario separado, «Mi Vida.». Se actualiza mientras usás la aplicación.</p>
    {!cloudConnected||!userEmail?<p className="calendar-note">Primero ingresá a Mi Vida con Google y esperá que termine de cargar tu cuenta.</p>:<div className="calendar-account"><span>{userEmail}</span><div className="calendar-actions">{!connected?<button type="button" className="button primary" disabled={!!busy} onClick={connect}>Conectar Google Calendar</button>:<><button type="button" className="button secondary" disabled={!!busy} onClick={()=>void run('Buscando calendarios…',async(accessToken,signal,current)=>{const choices=await listGoogleCalendars(accessToken,signal);if(current())setCalendars(choices);})}>Ver mis calendarios</button><button type="button" className="text-button" disabled={!!busy} onClick={disconnect}>Desconectar aquí</button></>}</div></div>}
    <div className="calendar-columns">
      <div className="calendar-section"><p className="eyebrow">DE GOOGLE A TU DÍA</p><h3>Compromisos que querés ver</h3><p className="muted">Los horarios ocupados ayudan a ubicar el trabajo y el entrenamiento. Los eventos de todo el día quedan como una nota.</p>
        {calendars.length>0?<fieldset className="calendar-choices" disabled={!!busy||!connected}><legend className="sr-only">Calendarios para leer</legend>{calendars.filter(calendar=>calendar.id!==preferences.destinationId&&!calendar.managed).map(calendar=><label key={calendar.id}><input type="checkbox" checked={preferences.sourceCalendarIds.includes(calendar.id)} onChange={event=>toggleSource(calendar.id,event.target.checked)} disabled={!preferences.sourceCalendarIds.includes(calendar.id)&&selectedCount>=30}/><span>{calendar.title}{calendar.primary&&<small>Principal</small>}</span></label>)}</fieldset>:<p className="calendar-note">{selectedCount?`${selectedCount} calendario${selectedCount===1?'':'s'} elegido${selectedCount===1?'':'s'}. Conectá o tocá «Ver mis calendarios» para revisarlos.`:'Elegí tus calendarios después de conectar.'}</p>}
        <div className="calendar-actions"><button type="button" className="button secondary" disabled={!connected||!!busy} onClick={()=>void run('Actualizando compromisos…',refresh)}>Actualizar compromisos</button></div><small className="calendar-last">Última lectura: {stamp(preferences.lastReadAt)}</small>
      </div>
      <div className="calendar-section"><p className="eyebrow">DE MI VIDA A GOOGLE</p><h3>Bloques para tu calendario</h3><p className="muted">Publicamos hoy y los próximos 13 días. Elegí qué incluir y revisá la vista previa antes de confirmar.</p><fieldset className="calendar-choices calendar-kinds" disabled={!!busy}><legend className="sr-only">Tipos de bloques para publicar</legend>{kindChoices.map(({kind,label})=><label key={kind}><input type="checkbox" checked={preferences.publishKinds.includes(kind)} onChange={event=>changePreferences({...preferences,publishKinds:event.target.checked?[...preferences.publishKinds,kind]:preferences.publishKinds.filter(value=>value!==kind)})}/><span>{label}</span></label>)}</fieldset>
        <label className="calendar-tentative"><input type="checkbox" disabled={!!busy} checked={preferences.includeTentative} onChange={event=>changePreferences({...preferences,includeTentative:event.target.checked})}/><span>Incluir horarios «por confirmar»<small>Aparecerán señalados en Google.</small></span></label>
        <div className="calendar-actions"><button type="button" className="button primary" disabled={!connected||!!busy||!props.settings.scheduleEnabled} onClick={prepare}>Revisar antes de publicar</button></div>{!props.settings.scheduleEnabled&&<small className="calendar-last">Activá tu agenda para publicar sus bloques.</small>}<small className="calendar-last">Última publicación: {stamp(preferences.lastPublishAt)}</small>
      </div>
    </div>
    {preview&&<div className="calendar-preview"><div className="section-title"><h3>Así irá a Google</h3><span>{preview.length} bloques · 14 días</span></div><p className="muted">{preferences.destinationId?'Actualizaremos tu calendario «Mi Vida.».':'Crearemos un calendario privado «Mi Vida.» para estos bloques.'} Los bloques con cruces quedan fuera.{obsolete.length>0&&` También retiraremos ${obsolete.length} bloque${obsolete.length===1?'':'s'} que ya no están en esta planificación, si no los editaste en Google.`}</p>{preview.length>0?<ul>{preview.map(item=><li key={item.id}><span>{dateLabel(item.date)}<small>{formatTime(item.startMin)}–{formatTime(item.endMin)}</small></span><strong>{item.title}</strong></li>)}</ul>:<p className="calendar-note">No hay bloques para publicar con esta selección.</p>}<div className="calendar-actions"><button type="button" className="button primary" disabled={!!busy||!preview.length&&!obsolete.length} onClick={publish}>Confirmar publicación</button><button type="button" className="button secondary" disabled={!!busy} onClick={()=>setPreview(null)}>Cancelar</button></div></div>}
    {busy&&<p className="calendar-note" role="status">{busy}</p>}{error&&<p className="calendar-error" role="alert">{error}</p>}{message&&<p className="calendar-success" role="status">{message}</p>}{conflicts.length>0&&<details className="calendar-conflicts"><summary>{conflicts.length} cambios de Google conservados</summary><ul>{conflicts.map((conflict,index)=><li key={index}>{conflict}</li>)}</ul><p className="muted">Revisalos en Google Calendar. Esta versión conserva las ediciones hechas allí; no las copia sobre tu planificación de Mi Vida.</p></details>}
    <p className="calendar-privacy">Tu diario, checks, cargas de entrenamiento y listas personales siguen en Firebase. Calendar recibe sólo título y horario de los bloques elegidos, sin invitados ni alarmas duplicadas. Al cerrar la app no se sincroniza; al vencer la autorización, Google puede pedirte conectar nuevamente.</p>
  </section>;
}
export default GoogleCalendarPanel;
