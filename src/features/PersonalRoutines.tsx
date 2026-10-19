import { useEffect, useState } from 'react';
import { normalizeMapsUrl, type DayOverride, type Settings } from '../lib/planner';
import {getDateAccess} from '../lib/datePolicy';
import './routines.css';

const places = [
  {field:'homeMapsUrl',label:'Mi hogar'},
  {field:'gymMapsUrl',label:'Entrenamiento'},
  {field:'workMapsUrl',label:'Trabajo'},
  {field:'mondayRehearsalMapsUrl',label:'Ensayo del lunes'},
] as const;

function PlaceField({value,label,onSave}:{value:string;label:string;onSave:(url:string)=>void}) {
  const [draft,setDraft]=useState(value);
  const [error,setError]=useState('');
  useEffect(()=>{setDraft(value);setError('');},[value]);
  function save() {
    const clean=draft.trim();
    const normalized=normalizeMapsUrl(clean);
    if(clean && !normalized) {setError('Pegá un enlace completo que empiece con https://.');return;}
    setError('');setDraft(normalized);onSave(normalized);
  }
  return <div className="place-item">
    <label className="field"><span>{label}</span><input type="url" maxLength={2000} placeholder="https://…" value={draft} aria-invalid={!!error} onChange={e=>setDraft(e.target.value)} onBlur={save}/><small>{error||'Se guarda al salir del campo.'}</small></label>
    {normalizeMapsUrl(value)&&<a className="text-button" href={normalizeMapsUrl(value)} target="_blank" rel="noopener noreferrer">Abrir ubicación ↗</a>}
  </div>;
}

export function PersonalPlaces({settings,patch}:{settings:Settings;patch:<K extends keyof Settings>(key:K,value:Settings[K])=>void}) {
  return <section className="panel places-panel">
    <p className="eyebrow">LOS LUGARES DE TU DÍA</p><h2>Tus lugares, a mano</h2>
    <p className="muted">Guardá el enlace de cada lugar para abrirlo cuando lo necesites. La agenda usa los minutos de traslado que configuraste.</p>
    <div className="places-grid">{places.map(({field,label})=><PlaceField key={field} value={settings[field]} label={label} onSave={url=>patch(field,url)}/>)}</div>
  </section>;
}

export function PewenException({date,settings,override,onChange,readOnly=false}:{date:string;settings:Settings;override?:DayOverride;onChange:(skip:boolean)=>void;readOnly?:boolean}) {
  if (!settings.scheduleEnabled || new Date(date+'T12:00:00').getDay() !== 1) return null;
  return <section className="panel pewen-exception" aria-label="Trabajo de este lunes">
    <div><p className="eyebrow">SÓLO PARA ESTE LUNES</p><h2>{override?.skipPewen?'Una mañana para vos':'Tu lunes de trabajo'}</h2>
      <p className="muted">{override?.skipPewen?'Se libera el viaje de trabajo y se busca entrenamiento desde las 08:15. Si el jardín se cruza, se acomoda después del regreso y la agenda te avisa.':'Si esta vez no vas, podés liberar la mañana sin recuperar la jornada otro día.'}</p>
      {settings.mondayEveningEnabled&&<p className="muted">{settings.mondayEveningName} y el regreso se mantienen.</p>}
    </div>
    <label className="toggleline"><input type="checkbox" checked={override?.skipPewen===true} disabled={readOnly} onChange={e=>{if(getDateAccess(date).canPlan)onChange(e.target.checked)}}/><span>Este lunes no voy a {settings.workLocation || 'trabajar'}</span></label>
  </section>;
}
