import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { isoDate, type DayOverride, type ExtraEvent, type Settings } from '../lib/planner';
import { alarmCategories, alarmEpoch, buildAlarmBatch, defaultAlarmPreferences, invalidateAlarmSchedule, isAndroidAlarms, LifeReminders, loadAlarmPreferences, queueAlarmSchedule, saveAlarmPreferences, type AlarmPermissionStatus, type AlarmPreferences, type AlarmPreview } from '../lib/alarms';
import './alarms.css';
import type {CalendarEventOccurrence} from '../lib/calendarModel';

export type AlarmSettingsProps = {settings:Settings;overrides:Record<string,DayOverride>;extras:ExtraEvent[];done:Record<string,boolean>;externalOccurrences?:CalendarEventOccurrence[];scope:string|null;cloudReady:boolean;hidden?:boolean};
const dateTime = (epoch:number) => new Date(epoch).toLocaleString('es-AR',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const dateLabel = (date:string) => new Date(date+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:'long'});
const errorText = (error:unknown) => error instanceof Error ? error.message : 'Android no pudo completar la operación. Volvé a abrir Mi Vida y revisá los permisos.';
const alarmLabel = (alarm:AlarmPreview) => alarm.source === 'bedtime-prepare' ? 'Preparación para dormir · 45 min antes' : alarm.source === 'bedtime' ? 'Hora de acostarte' : alarm.kind === 'wake' ? 'Alarma para despertar' : 'Recordatorio';

export function AlarmSettings({settings,overrides,extras,done,externalOccurrences,scope,cloudReady,hidden=false}:AlarmSettingsProps) {
  const native = isAndroidAlarms();
  const [saved,setSaved] = useState(() => ({scope,prefs:loadAlarmPreferences(scope)}));
  const prefs = useMemo(() => saved.scope === scope ? saved.prefs : defaultAlarmPreferences(),[saved,scope]);
  const [status,setStatus] = useState<AlarmPermissionStatus|null>(null);
  const [error,setError] = useState(''), [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false), [programming,setProgramming] = useState(false);
  const [now,setNow] = useState(Date.now()), [refresh,setRefresh] = useState(0);
  const [programmed,setProgrammed] = useState<{signature:string;at:number}|null>(null);
  const scheduleScope = useRef<string|null|undefined>(undefined);
  const mounted = useRef(true);
  const batch = useMemo(() => buildAlarmBatch({settings,overrides,extras,done,externalOccurrences,preferences:prefs,now}),[settings,overrides,extras,done,externalOccurrences,prefs,now]);
  const signature = JSON.stringify(cloudReady ? batch.notifications : []);
  const hasPreferences = prefs.wake || prefs.bedtime || prefs.agenda || prefs.creatine || prefs.custom.some(alarm => alarmEpoch(alarm.date,alarm.time)>now);

  useEffect(() => {mounted.current=true;return () => {mounted.current=false;};},[]);
  useEffect(() => {setSaved({scope,prefs:loadAlarmPreferences(scope)});setProgrammed(null);setMessage('');setError('');},[scope]);
  useEffect(() => {
    if (!native) return;
    let active=true;
    const update = () => {setNow(Date.now());setRefresh(value => value+1);void LifeReminders.permissionStatus().then(value => {if(active)setStatus(value);}).catch(caught => {if(active)setError(errorText(caught));});};
    const visible = () => {if(document.visibilityState === 'visible')update();};
    update();
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',visible);
    const timer=window.setInterval(() => {if(document.visibilityState === 'visible')setNow(Date.now());},60000);
    return () => {active=false;window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',visible);window.clearInterval(timer);};
  },[native]);
  useEffect(() => {
    if (!native) return;
    if (!cloudReady) {invalidateAlarmSchedule();setProgramming(false);setProgrammed(null);return;}
    const revision=invalidateAlarmSchedule(), changedScope=scheduleScope.current !== scope;
    let active=true;
    setProgramming(true);setProgrammed(null);
    const timer=window.setTimeout(() => {
      void queueAlarmSchedule(revision,batch.notifications,changedScope).then(value => {
        if (!active || !value) return;
        scheduleScope.current=scope;
        setStatus(value);setError('');setProgramming(false);
        if (cloudReady && value.granted) setProgrammed({signature,at:Date.now()});
      }).catch(caught => {if(active){setError(errorText(caught));setProgramming(false);}});
    },changedScope ? 0 : 550);
    return () => {active=false;window.clearTimeout(timer);invalidateAlarmSchedule();};
  // The serialized payload is the scheduling identity; preview-only changes do not call Android.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[native,scope,cloudReady,signature,refresh,status?.granted]);

  function changePrefs(update:(current:AlarmPreferences)=>AlarmPreferences) {
    const next=update(prefs);
    try {saveAlarmPreferences(scope,next);setSaved({scope,prefs:next});setMessage('');setError('');}
    catch {setError('No se pudieron guardar los ajustes en este celular. No se cambió la programación.');}
  }
  async function run(action:()=>Promise<unknown>,success='',reprogram=true) {
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try {await action();const next=await LifeReminders.permissionStatus();if(mounted.current){setStatus(next);setMessage(success);if(reprogram){setNow(Date.now());setRefresh(value=>value+1);}}}
    catch(caught){if(mounted.current)setError(errorText(caught));}
    finally {if(mounted.current)setBusy(false);}
  }
  function addPunctual(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget,data=new FormData(form),title=String(data.get('title')||'').trim(),date=String(data.get('date')||''),time=String(data.get('time')||'');
    if (!title || title.length>100 || !Number.isFinite(alarmEpoch(date,time)) || alarmEpoch(date,time)<=Date.now()) {setError('Elegí un título y una fecha y hora futuras.');return;}
    const future=prefs.custom.filter(alarm=>alarmEpoch(alarm.date,alarm.time)>Date.now());
    if(future.length>=30){setError('Podés guardar hasta 30 alarmas puntuales. Eliminá una antes de agregar otra.');return;}
    changePrefs(current=>({...current,custom:[...future,{id:crypto.randomUUID(),title,date,time,kind:data.get('kind')==='wake'?'wake':'reminder'}]}));
    form.reset();
  }
  const confirmed = !!programmed && programmed.signature===signature && !!status?.granted && !status?.lastError && cloudReady && !programming;
  const nextCustom=prefs.custom.filter(alarm=>alarmEpoch(alarm.date,alarm.time)>now).sort((a,b)=>alarmEpoch(a.date,a.time)-alarmEpoch(b.date,b.time));
  const nextSleep=batch.preview.filter(alarm=>alarm.source==='bedtime-prepare'||alarm.source==='bedtime').slice(0,2);
  return <section className="panel alarm-settings" hidden={hidden} aria-labelledby="alarms-heading">
    <div className="section-title"><h2 id="alarms-heading">Alarmas en tu celular</h2><span className={'alarm-badge '+(confirmed && batch.notifications.length?'alarm-ready':'')}>{!native?'Versión Android':!cloudReady?'Esperando tu agenda':programming?'Actualizando…':!hasPreferences?'Desactivadas':!status?.granted?'Faltan permisos':confirmed?`${status.pending} programadas`:'Por confirmar'}</span></div>
    {!native ? <><p className="muted">La APK de Mi Vida puede despertarte y avisarte con la pantalla bloqueada. Instalá la versión Android y abrí esta sección desde la app para activar las alarmas. La web conserva tu agenda y tu diario.</p><p className="alarm-note">Para cerrar el día, «Prepararme y acostarme» reúne dos avisos diarios: 45 minutos antes y a la hora propuesta para dormir, según el despertar del día siguiente. Suenan como recordatorios en la APK; el despertador mantiene su sonido habitual.</p></> : <>
      <p className="muted">Las alarmas que programes quedan en Android y pueden sonar con la app cerrada y sin conexión. Tus elecciones de alarmas y avisos se guardan sólo en este celular, por cuenta.</p>
      {!cloudReady && <p className="alarm-note">Esperando confirmar tu cuenta para revisar su agenda. Las alarmas ya programadas en Android se conservan durante la carga.</p>}
      <div className="alarm-permissions">
        <h3>Preparar Android</h3>
        <dl><div><dt>Notificaciones</dt><dd>{status ? status.notifications?'Permitidas':'Falta permitir':'Comprobando…'}</dd></div><div><dt>Alarmas exactas</dt><dd>{status ? status.exactAlarms?'Permitidas':'Falta permitir':'Comprobando…'}</dd></div><div><dt>Pantalla de alarma</dt><dd>{status ? status.fullScreen?'Permitida':'Aviso sin pantalla completa':'Comprobando…'}</dd></div><div><dt>Volumen de alarmas</dt><dd>{status ? `${status.alarmVolume} de ${status.alarmMaxVolume}`:'Comprobando…'}</dd></div></dl>
        <div className="alarm-actions">{!status?.notifications && <button type="button" className="button primary" disabled={busy} onClick={()=>void run(()=>LifeReminders.requestPermission())}>Permitir notificaciones</button>}{status && !status.notifications && <button type="button" className="button secondary" disabled={busy} onClick={()=>void run(()=>LifeReminders.openNotificationSettings())}>Ajustes de notificaciones</button>}{!status?.exactAlarms && <button type="button" className="button secondary" disabled={busy} onClick={()=>void run(()=>LifeReminders.openExactAlarmSettings())}>Permitir alarmas exactas</button>}{status && !status.fullScreen && <button type="button" className="button secondary" disabled={busy} onClick={()=>void run(()=>LifeReminders.openFullScreenSettings())}>Permitir pantalla de alarma</button>}<button type="button" className="button secondary" disabled={busy} onClick={()=>void run(()=>LifeReminders.openAlarmSettings())}>Sonido y volumen</button></div>
        {status?.alarmVolume===0 && <p className="alarm-warning">El volumen de alarmas está en cero. Subilo antes de hacer la prueba.</p>}
        <div className="alarm-actions"><button type="button" className="button primary" disabled={busy || !status?.granted || !cloudReady} onClick={()=>void run(()=>LifeReminders.testAlarm(),'Prueba programada para dentro de 30 segundos. Bloqueá la pantalla y comprobá el sonido.',false)}>Probar alarma en 30 segundos</button><button type="button" className="button secondary" disabled={busy} onClick={()=>void run(async()=>{},'Permisos revisados; la programación se actualizará.')}>Revisar permisos</button></div>
        <p className="alarm-help">En tu POCO, si los avisos fallan, revisá que Mi Vida tenga inicio automático y batería sin restricciones. Hacé primero la prueba de 30 segundos con la pantalla bloqueada. Mi Vida no puede comprobar esos ajustes por vos.</p>
      </div>
      <fieldset disabled={!cloudReady} className="alarm-choices"><legend>Qué querés escuchar</legend>
        <label className="toggleline"><input type="checkbox" checked={prefs.wake} onChange={e=>changePrefs(current=>({...current,wake:e.target.checked}))}/><span><strong>Despertarme según mi agenda</strong><small>Usa la hora calculada para cada día, con tus traslados y preparación.</small></span></label>
        <label className="toggleline"><input type="checkbox" checked={prefs.bedtime} onChange={e=>changePrefs(current=>({...current,bedtime:e.target.checked}))}/><span><strong>Prepararme y acostarme</strong><small>Dos avisos diarios: 45 minutos antes y a la hora propuesta para acostarte, según el despertar del día siguiente y tus horas de descanso. Usan el sonido de recordatorio; tu despertador mantiene su sonido habitual.</small></span></label>
        <label className="toggleline"><input type="checkbox" checked={prefs.agenda} onChange={e=>changePrefs(current=>({...current,agenda:e.target.checked}))}/><span><strong>Recordarme los compromisos</strong><small>Los bloques marcados como listos no generan avisos.</small></span></label>
        <label className="toggleline"><input type="checkbox" checked={prefs.creatine} onChange={e=>changePrefs(current=>({...current,creatine:e.target.checked}))}/><span><strong>Creatina con el desayuno</strong><small>Un aviso al empezar el desayuno, incluso los días de descanso. Si ya lo marcaste como listo, no vuelve a avisar.</small></span></label>
        {(prefs.wake || prefs.bedtime || prefs.agenda || prefs.creatine) && !settings.scheduleEnabled && <p className="alarm-warning">Tu agenda todavía está desactivada. Activala o importá tus horarios en Ajustes para generar estas alarmas.</p>}
        {prefs.creatine && !settings.breakfastCreatine && <p className="alarm-note">Activá la creatina de la rutina matinal en Ajustes para generar este aviso.</p>}
        {prefs.agenda && <><label className="field alarm-before"><span>Avisar antes · minutos</span><input type="number" min="0" max="60" value={prefs.beforeMin} onChange={e=>changePrefs(current=>({...current,beforeMin:Math.max(0,Math.min(60,Number(e.target.value)||0))}))}/></label><div className="alarm-categories">{alarmCategories.map(category=><label className="toggleline" key={category.value}><input type="checkbox" checked={prefs.categories.includes(category.value)} onChange={e=>changePrefs(current=>({...current,categories:e.target.checked?[...current.categories,category.value]:current.categories.filter(value=>value!==category.value)}))}/>{category.label}</label>)}</div></>}
      </fieldset>
      {prefs.bedtime && settings.scheduleEnabled && <div className="alarm-preview alarm-bedtime-preview" aria-labelledby="sleep-alarms-heading"><h3 id="sleep-alarms-heading">Próximos avisos para dormir</h3>{nextSleep.length ? <ol>{nextSleep.map(alarm=><li key={alarm.key}><time dateTime={new Date(alarm.at).toISOString()}>{dateTime(alarm.at)}</time><span>{alarmLabel(alarm)}<small>{confirmed?'Recordatorio programado':'Pendiente de programar en Android'}</small></span></li>)}</ol> : <p className="muted">No hay avisos futuros para dormir en esta programación. Revisá los horarios de descanso y renová la agenda.</p>}<p className="alarm-help">Se muestran sólo los avisos que todavía no pasaron. Los dos usan el sonido breve de recordatorio.</p></div>}
      <div className="alarm-punctual"><h3>Una alarma puntual</h3><p className="muted">Para despertarte un día especial o recordar algo a una hora exacta, sin modificar la agenda.</p><form onSubmit={addPunctual}><fieldset disabled={!cloudReady}><label className="field"><span>Qué querés recordar</span><input name="title" required maxLength={100} placeholder="Ej. Salir para un turno"/></label><div className="form-grid"><label className="field"><span>Fecha</span><input type="date" name="date" min={isoDate(new Date(now))} defaultValue={isoDate(new Date(now))} required/></label><label className="field"><span>Hora</span><input type="time" name="time" required/></label><label className="field"><span>Tipo de aviso</span><select name="kind" defaultValue="reminder"><option value="reminder">Recordatorio</option><option value="wake">Alarma para despertar</option></select></label></div><button className="button secondary">Agregar alarma puntual</button></fieldset></form>{nextCustom.length>0 && <ul className="alarm-custom-list">{nextCustom.map(alarm=><li key={alarm.id}><span><strong>{alarm.title}</strong><small>{dateTime(alarmEpoch(alarm.date,alarm.time))} · {alarm.kind==='wake'?'Alarma':'Recordatorio'}</small></span><button type="button" className="text-button" aria-label={`Eliminar alarma: ${alarm.title}`} onClick={()=>changePrefs(current=>({...current,custom:current.custom.filter(item=>item.id!==alarm.id)}))}>Eliminar</button></li>)}</ul>}</div>
      <div className="alarm-preview"><div className="section-title"><h3>Próximos avisos</h3><span>{batch.notifications.length} en la programación</span></div>{batch.preview.length ? <ol>{batch.preview.slice(0,8).map(alarm=><li key={alarm.key}><time dateTime={new Date(alarm.at).toISOString()}>{dateTime(alarm.at)}</time><span>{alarm.title}<small>{alarmLabel(alarm)}{!confirmed?' · Pendiente de programar':''}</small></span></li>)}</ol>:<p className="muted">Activá el despertar, algún recordatorio o agregá una alarma puntual para revisar acá los próximos avisos.</p>}{batch.preview.length>8 && <p className="muted">Y {batch.preview.length-8} avisos más.</p>}{batch.omitted>0 && <p className="alarm-warning">Android admite hasta 200 avisos en esta programación. Quedaron {batch.omitted} posteriores fuera; se incorporan al volver a abrir Mi Vida.</p>}
      <p className="alarm-help">La agenda se programa hasta el {dateLabel(batch.through)}. Volvé a abrir Mi Vida antes de esa fecha para renovar los próximos 14 días. Si editás desde la PC, abrí la app con conexión para que el celular reciba los cambios. Las alarmas puntuales se conservan hasta su fecha.</p>
      {confirmed && <p className="alarm-saved" role="status">Programación confirmada por Android a las {new Date(programmed.at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}.{status?.nextAt ? ` Próxima: ${dateTime(status.nextAt)}.`:''}</p>}</div>
      {status?.lastError && <p className="alarm-warning" role="alert">Android informó: {status.lastError}</p>}
      {error && <p className="alarm-error" role="alert">{error}</p>}{message && <p className="alarm-note" role="status">{message}</p>}
      <p className="alarm-help">Si apagás el celular o forzás la detención de Mi Vida desde los ajustes de Android, las alarmas pueden quedar suspendidas. Después de volver a encenderlo, abrí Mi Vida y revisá la próxima alarma.</p>
    </>}
  </section>;
}
export default AlarmSettings;
