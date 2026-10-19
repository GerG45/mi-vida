import type { WorkChecklistGroup } from '../lib/workChecklistGroups';
import { getWorkItemsForBlock, type WorkItems } from '../lib/workChecklist';
import { formatTime } from '../lib/planner';
import './workChecklistEntries.css';

export function workGroupTimeLabel(group:WorkChecklistGroup):string{
  return group.events.length?group.events.map(event=>`${formatTime(event.start)}–${formatTime(event.end)}`).join(' · '):'Sin bloque reservado hoy';
}

export function WorkChecklistEntries({groups,items,date,onOpen}:{groups:WorkChecklistGroup[];items:WorkItems;date:string;onOpen:(id:string)=>void}){
  if(!groups.length)return null;
  return <section className="work-checklist-entries" aria-label="Tus listas de trabajo">
    <div className="work-entries-heading"><div><p className="eyebrow">UN PASO CONCRETO A LA VEZ</p><h2>Lo que querés avanzar.</h2></div><p>Prepará la lista de hoy o elegí un día futuro en el calendario.</p></div>
    <div className="work-entry-grid">{groups.map(group=>{
      const list=getWorkItemsForBlock(items,date,group.id);
      const completed=list.filter(item=>item.done).length;
      const estimates=list.filter(item=>item.estimatedMinutes!==null);
      const estimated=estimates.reduce((sum,item)=>sum+(item.estimatedMinutes??0),0);
      return <button key={group.id} className="work-checklist-entry" onClick={()=>onOpen(group.id)} aria-label={`Abrir lista: ${group.block.title}`}>
        <span className="work-entry-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="16" height="17" rx="3"/><path d="m2 9 2 2 4-4m2 2h7m-7 5h7m-7 4h5"/></svg></span>
        <span className="work-entry-copy"><small>{workGroupTimeLabel(group)}</small><strong>{group.block.title}</strong><span>{list.length?`${completed}/${list.length} tareas hechas${estimates.length?` · ${estimated} min previstos`:''}`:'Tu lista de pasos, con tiempos opcionales.'}</span></span>
        <span className="work-entry-cta">{list.length?'Mi lista':'Armar lista'}<span aria-hidden="true">↗</span></span>
      </button>;
    })}</div>
  </section>;
}
