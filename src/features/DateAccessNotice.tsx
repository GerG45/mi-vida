import type {DateAccess} from '../lib/datePolicy';
import './dateAccess.css';

export function DateAccessNotice({access,onToday}:{access:DateAccess;onToday:()=>void}){
  if(access.kind==='today')return null;
  const planning=access.kind==='future';
  return <section className={'date-access-notice '+(planning?'planning':'locked')} aria-label="Acceso a este día">
    <span className="date-access-symbol" aria-hidden="true">{planning?'◷':'▣'}</span>
    <div><strong>{planning?'Un día para preparar':'Día cerrado · Sólo lectura'}</strong><p>{planning?'Podés organizar compromisos y preparar listas. Los checks, el diario y los contadores se habilitan cuando llegue esta fecha.':'Podés consultar lo que quedó registrado y descargar reportes. Este día ya no admite cambios.'}</p></div>
    <button className="button secondary" onClick={onToday}>Volver a hoy</button>
  </section>;
}
