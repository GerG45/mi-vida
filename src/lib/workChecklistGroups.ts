import type { PlanEvent } from './planner';
import { getWorkChecklistBlockId, isWorkChecklistEvent, type WorkItems } from './workChecklist';

export interface WorkChecklistGroup {
  id:string;
  block:PlanEvent;
  events:PlanEvent[];
  availableMinutes:number;
}

const fallbackTitle=(id:string)=>id==='cordoba-work'?'Trabajo':id==='flex-work'?'Trabajo / proyectos':'Lista de trabajo guardada';

/** A lunch break or a changed slot must not split or erase the day's logical checklist. */
export function getWorkChecklistGroups(events:PlanEvent[],items:WorkItems,date:string):WorkChecklistGroup[]{
  const groups=new Map<string,WorkChecklistGroup>();
  for(const event of events.filter(isWorkChecklistEvent).sort((a,b)=>a.start-b.start)){
    const id=getWorkChecklistBlockId(event);
    const existing=groups.get(id);
    if(existing){
      existing.events.push(event);existing.availableMinutes+=Math.max(0,event.end-event.start);
      existing.block.end=Math.max(existing.block.end,event.end);
    }else groups.set(id,{id,block:{...event,id},events:[event],availableMinutes:Math.max(0,event.end-event.start)});
  }
  for(const item of Object.values(items)){
    const id=getWorkChecklistBlockId({id:item.blockId});
    if(item.date!==date||groups.has(id))continue;
    groups.set(id,{id,events:[],availableMinutes:0,
      block:{id,title:fallbackTitle(id),start:0,end:0,kind:'work',detail:'Lista conservada para esta fecha, sin un bloque reservado en la agenda actual.',fixed:false,tentative:false}});
  }
  return [...groups.values()];
}
