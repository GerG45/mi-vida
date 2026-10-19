import {useEffect, useId, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction} from 'react';
import {formatTime, type PlanEvent} from '../lib/planner';
import {getDateAccess} from '../lib/datePolicy';
import {useDateAccess} from '../lib/useDateAccess';
import {
  createWorkItem, getWorkItemsForBlock, getWorkChecklistSummary, getWorkItemElapsed,
  getWorkChecklistBlockId, pauseWorkItem, startWorkItemTimer, toggleWorkItem, type WorkItem, type WorkItems,
} from '../lib/workChecklist';
import './workChecklist.css';

export type WorkChecklistProps = {
  date: string;
  block: PlanEvent;
  items: WorkItems;
  setItems: Dispatch<SetStateAction<WorkItems>>;
  onClose: () => void;
  availableMinutes?: number;
  timeLabel?: string;
};

type WorkIconName = 'check'|'plus'|'close'|'play'|'pause'|'clock'|'edit'|'trash'|'up'|'down'|'list';
function WorkIcon({name, size=18}:{name:WorkIconName;size?:number}) {
  const paths: Record<WorkIconName, ReactNode> = {
    check:<path d="m5 12 4 4L19 6"/>, plus:<path d="M12 5v14M5 12h14"/>, close:<path d="m6 6 12 12M6 18 18 6"/>,
    play:<path d="m9 5 11 7-11 7z"/>, pause:<path d="M8 5v14M16 5v14"/>,
    clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, edit:<><path d="m16 3 5 5L8 21H3v-5zM14 5l5 5"/></>,
    trash:<><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
    up:<path d="m6 15 6-6 6 6"/>, down:<path d="m6 9 6 6 6-6"/>,
    list:<><path d="m3 6 1 1 2-2M9 6h12M3 12h3M9 12h12M3 18h3M9 18h12"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const dateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
const elapsedLabel=(seconds:number)=>{
  const total=Math.floor(Math.max(0,seconds));
  const hours=Math.floor(total/3600);
  return `${hours?`${hours}:`:''}${String(Math.floor(total/60)%60).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};
const minutesLabel=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)} h${minutes%60?` ${minutes%60} min`:''}`:`${minutes} min`;
const optionalMinutes=(value:string)=>value.trim()===''?null:Math.min(1440,Math.max(1,Math.round(Number(value)||1)));
const newItemId=()=>`work-${crypto.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function WorkChecklist({date,block,items,setItems,onClose,availableMinutes,timeLabel}:WorkChecklistProps) {
  const headingId=useId();
  const descriptionId=useId();
  const titleInputId=useId();
  const minutesInputId=useId();
  const dialogRef=useRef<HTMLElement>(null);
  const captureRef=useRef<HTMLInputElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const [title,setTitle]=useState('');
  const [minutes,setMinutes]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [editTitle,setEditTitle]=useState('');
  const [editMinutes,setEditMinutes]=useState('');
  const [removed,setRemoved]=useState<WorkItem|null>(null);
  const [message,setMessage]=useState('');
  const [now,setNow]=useState(Date.now());
  const access=useDateAccess(date);
  const lockReason=access.kind==='past'?'Este día ya terminó. Tu lista queda guardada para consultar.':'Podés preparar la lista para este día. Los checks y el contador se habilitan cuando llegue la fecha.';
  const list=getWorkItemsForBlock(items,date,block.id);
  const summary=getWorkChecklistSummary(items,date,block.id,now);
  const activeItem=Object.values(items).find(item=>item.timerStartedAt!==null&&!item.done&&getDateAccess(item.date).canExecute);
  const activeOutside=activeItem&&(activeItem.date!==date||getWorkChecklistBlockId({id:activeItem.blockId})!==getWorkChecklistBlockId(block))?activeItem:undefined;
  const blockMinutes=Math.max(0,availableMinutes??block.end-block.start);
  const overBy=summary.estimatedMinutes-blockMinutes;
  const progress=summary.total?Math.round(summary.completed/summary.total*100):0;

  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialogRef.current?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}
      if(event.key!=='Tab'||!dialogRef.current)return;
      const controls=Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]')).filter(control=>control.getClientRects().length>0);
      if(!controls.length){event.preventDefault();dialogRef.current.focus();return;}
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialogRef.current)){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=oldOverflow;if(previousFocus?.isConnected)previousFocus.focus();};
  },[]);

  useEffect(()=>{
    if(!activeItem)return;
    setNow(Date.now());
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    const refresh=()=>setNow(Date.now());
    document.addEventListener('visibilitychange',refresh);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[activeItem?.id,activeItem?.timerStartedAt]);

  function updateItem(id:string,change:(item:WorkItem)=>WorkItem,intent:'plan'|'execute'='plan') {
    setItems(all=>{
      const item=all[id];
      const contextAccess=getDateAccess(date),itemAccess=getDateAccess(item?.date??'');
      if(!item||!(intent==='execute'?contextAccess.canExecute&&itemAccess.canExecute:contextAccess.canPlan&&itemAccess.canPlan))return all;
      return {...all,[id]:change(item)};
    });
    setNow(Date.now());
  }

  function addItem(event:FormEvent) {
    event.preventDefault();
    if(!getDateAccess(date).canPlan||!title.trim())return;
    const id=newItemId();
    const next=createWorkItem({id,date,blockId:block.id,title:title.trim(),estimatedMinutes:optionalMinutes(minutes),order:Math.min(1_000_000,Math.max(-1,...list.map(item=>item.order))+1),now:Date.now()});
    setItems(all=>getDateAccess(date).canPlan?{...all,[id]:next}:all);
    setTitle('');setMinutes('');setMessage('Paso agregado a este bloque.');
    captureRef.current?.focus();
  }

  function editItem(item:WorkItem) {
    if(!getDateAccess(date).canPlan||!getDateAccess(item.date).canPlan)return;
    setEditing(item.id);setEditTitle(item.title);setEditMinutes(item.estimatedMinutes===null?'':String(item.estimatedMinutes));
  }

  function saveEdit(event:FormEvent) {
    event.preventDefault();
    if(!getDateAccess(date).canPlan||!editing||!editTitle.trim())return;
    updateItem(editing,item=>({...item,title:editTitle.trim(),estimatedMinutes:optionalMinutes(editMinutes)}));
    setEditing(null);setMessage('Cambios guardados.');
  }

  function removeItem(item:WorkItem) {
    if(!getDateAccess(date).canPlan||!getDateAccess(item.date).canPlan)return;
    setRemoved(pauseWorkItem(item,Date.now()));
    setItems(all=>{if(!getDateAccess(date).canPlan||!getDateAccess(all[item.id]?.date??'').canPlan)return all;const next={...all};delete next[item.id];return next;});
    if(editing===item.id)setEditing(null);
    setMessage('Paso eliminado. Podés deshacerlo.');
  }

  function undoRemove() {
    if(!removed||!getDateAccess(date).canPlan||!getDateAccess(removed.date).canPlan)return;
    setItems(all=>all[removed.id]||!getDateAccess(date).canPlan||!getDateAccess(removed.date).canPlan?all:{...all,[removed.id]:removed});
    setRemoved(null);setMessage('Paso restaurado.');
  }

  function moveItem(id:string,direction:-1|1) {
    if(!getDateAccess(date).canPlan)return;
    const index=list.findIndex(item=>item.id===id);
    const other=index+direction;
    if(index<0||other<0||other>=list.length)return;
    const ordered=[...list];
    [ordered[index],ordered[other]]=[ordered[other],ordered[index]];
    setItems(all=>{if(!getDateAccess(date).canPlan)return all;const next={...all};ordered.forEach((item,order)=>{if(next[item.id]&&getDateAccess(next[item.id].date).canPlan)next[item.id]={...next[item.id],order};});return next;});
  }

  return <div className="work-checklist-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="work-checklist" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={headingId} aria-describedby={descriptionId}>
      <header className="work-checklist-header">
        <div className="work-checklist-heading"><span className="work-checklist-symbol"><WorkIcon name="list" size={25}/></span><div><p className="eyebrow">UN RATO PARA AVANZAR</p><p className="work-checklist-date">{dateLabel(date)} · {timeLabel??`${formatTime(block.start)}–${formatTime(block.end)}`}</p></div></div>
        <button className="work-checklist-icon" onClick={onClose} aria-label="Cerrar lista de trabajo"><WorkIcon name="close" size={21}/></button>
      </header>
      <div className="work-checklist-intro"><h2 id={headingId}>{block.title}</h2><p id={descriptionId}>{access.canPlan?'Elegí los pasos de este rato. Podés dejarlos escritos con días de anticipación.':'Los pasos de este bloque se conservan como registro de ese día.'}</p></div>
      {!access.canExecute&&<p className="work-checklist-date-lock" role="status"><span aria-hidden="true">◷</span>{lockReason}</p>}

      <div className="work-checklist-summary" aria-label="Progreso de este bloque">
        <div className="work-checklist-progress-copy"><strong>{summary.completed}<span>/{summary.total}</span></strong><span>{summary.total&&summary.completed===summary.total?'Todo listo. Bien por vos.':'pasos completados'}</span><span className="work-checklist-total-time"><WorkIcon name="clock" size={15}/>{summary.estimatedMinutes?`${minutesLabel(summary.estimatedMinutes)} estimados`:'A tu ritmo'}</span></div>
        <div className="work-checklist-progress" role="progressbar" aria-label="Pasos completados" aria-valuemin={0} aria-valuemax={summary.total||1} aria-valuenow={summary.completed}><span style={{width:`${progress}%`}}/></div>
        {overBy>0&&<p className="work-checklist-capacity">{blockMinutes?`Tu lista suma ${minutesLabel(overBy)} más que este bloque. Podés ajustar los tiempos o elegir qué priorizar.`:'Esta lista sigue guardada, aunque hoy no haya un bloque de trabajo reservado.'}</p>}
      </div>

      {access.canPlan&&<form className="work-checklist-capture" onSubmit={addItem}>
        <label className="work-checklist-title-field" htmlFor={titleInputId}><span>¿Qué querés hacer?</span><input id={titleInputId} ref={captureRef} value={title} onChange={event=>setTitle(event.target.value)} maxLength={300} placeholder="Por ejemplo, preparar la propuesta" autoComplete="off"/></label>
        <label className="work-checklist-minutes-field" htmlFor={minutesInputId}><span>Minutos <small>opcional</small></span><input id={minutesInputId} type="number" min={1} max={1440} step={1} inputMode="numeric" value={minutes} onChange={event=>setMinutes(event.target.value)} placeholder="—"/></label>
        <button className="button primary" type="submit" disabled={!title.trim()}><WorkIcon name="plus" size={18}/><span>Agregar</span></button>
      </form>}

      {activeOutside&&<div className="work-checklist-other-timer"><WorkIcon name="clock" size={17}/><p>Hay un contador en otro bloque: <strong>{activeOutside.title}</strong>. {access.canExecute&&getDateAccess(activeOutside.date).canExecute?'Al empezar uno acá, el anterior queda en pausa.':'Esta vista no modifica los contadores de otros días.'}</p>{access.canExecute&&getDateAccess(activeOutside.date).canExecute&&<button onClick={()=>updateItem(activeOutside.id,item=>pauseWorkItem(item,Date.now()),'execute')}>Pausarlo</button>}</div>}

      {list.length?<ol className="work-checklist-items" aria-label="Pasos de este bloque">{list.map((item,index)=>{
        const isRunning=item.timerStartedAt!==null&&!item.done&&access.canExecute;
        const elapsed=getWorkItemElapsed(item,Math.max(now,Date.now()));
        const estimateReached=item.estimatedMinutes!==null&&elapsed>=item.estimatedMinutes*60;
        return <li key={item.id} className={`work-checklist-item${item.done?' is-done':''}${isRunning?' is-running':''}`}>
          <button className="work-checklist-check" role="checkbox" aria-checked={item.done} aria-label={`${item.done?'Reabrir':'Completar'}: ${item.title}`} disabled={!access.canExecute} title={!access.canExecute?lockReason:undefined} onClick={()=>{if(!getDateAccess(date).canExecute)return;updateItem(item.id,current=>toggleWorkItem(current,Date.now()),'execute');setMessage(item.done?'Paso reabierto.':'Un paso más, listo.');}}>{item.done&&<WorkIcon name="check" size={18}/>}</button>
          {editing===item.id&&access.canPlan?<form className="work-checklist-edit" onSubmit={saveEdit}><label><span>Editar paso</span><input autoFocus value={editTitle} onChange={event=>setEditTitle(event.target.value)} maxLength={300}/></label><div><label className="work-checklist-edit-minutes"><span>Minutos opcionales</span><input type="number" min={1} max={1440} step={1} inputMode="numeric" value={editMinutes} onChange={event=>setEditMinutes(event.target.value)} placeholder="Sin tiempo"/></label><button type="button" className="button secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary" disabled={!editTitle.trim()}>Guardar</button></div></form>:<>
            <div className="work-checklist-item-body"><div className="work-checklist-item-title"><span>{item.title}</span>{access.canPlan&&<button className="work-checklist-icon work-checklist-edit-button" onClick={()=>editItem(item)} aria-label={`Editar: ${item.title}`}><WorkIcon name="edit" size={15}/></button>}</div>
              <div className="work-checklist-item-meta">{item.estimatedMinutes!==null&&<span><WorkIcon name="clock" size={13}/>{minutesLabel(item.estimatedMinutes)} estimados</span>}{elapsed>0||isRunning?<span className={isRunning?'work-checklist-clock is-running':'work-checklist-clock'}><i aria-hidden="true"/><time role="timer" aria-live="off">{elapsedLabel(elapsed)}</time>{isRunning?'en curso':'registrados'}</span>:item.estimatedMinutes===null?<span>Sin tiempo definido</span>:null}</div>
              {isRunning&&estimateReached&&<p className="work-checklist-estimate-note">Llegaste al tiempo estimado. Podés continuar o hacer una pausa.</p>}
            </div>
            <div className="work-checklist-item-controls">{!item.done&&<button className={`work-checklist-timer-button${isRunning?' is-running':''}`} aria-label={`${isRunning?'Pausar':'Iniciar contador para'}: ${item.title}`} disabled={!access.canExecute} title={!access.canExecute?lockReason:undefined} onClick={()=>{if(!getDateAccess(date).canExecute)return;if(isRunning)updateItem(item.id,current=>pauseWorkItem(current,Date.now()),'execute');else{setItems(all=>getDateAccess(date).canExecute&&getDateAccess(all[item.id]?.date??'').canExecute?startWorkItemTimer(all,item.id,Date.now()):all);setNow(Date.now());}}}><WorkIcon name={isRunning?'pause':'play'} size={15}/><span>{isRunning?'Pausar':elapsed>0?'Seguir':'Empezar'}</span></button>}
              {access.canPlan&&<details className="work-checklist-menu"><summary aria-label={`Más opciones para: ${item.title}`}><span aria-hidden="true">···</span></summary><div><button type="button" disabled={index===0} onClick={()=>moveItem(item.id,-1)}><WorkIcon name="up" size={15}/>Subir</button><button type="button" disabled={index===list.length-1} onClick={()=>moveItem(item.id,1)}><WorkIcon name="down" size={15}/>Bajar</button><button type="button" className="work-checklist-delete" onClick={()=>removeItem(item)}><WorkIcon name="trash" size={15}/>Eliminar</button></div></details>}
            </div>
          </>}
        </li>;
      })}</ol>:<div className="work-checklist-empty"><span><WorkIcon name="list" size={29}/></span><h3>{access.canPlan?'Hagamos lugar a lo importante.':'No hay pasos guardados para este bloque.'}</h3><p>{access.canPlan?'Escribí un primer paso. Lo demás puede venir después.':'Este día se conserva tal como quedó.'}</p></div>}

      <div className="work-checklist-feedback" role="status">{message&&<span>{message}</span>}{removed&&access.canPlan&&<button onClick={undoRemove}>Deshacer eliminación</button>}</div>
      <footer className="work-checklist-footer"><p><strong>Esta lista pertenece a esta fecha y a este bloque.</strong> {access.canExecute?'Los tiempos son opcionales. Un contador en curso sigue al cerrar; pausalo cuando termines.':access.canPlan?'Podés planificar los pasos y los tiempos; completar tareas y registrar trabajo queda reservado para esa fecha.':'Se conserva el registro de este día. Podés leerlo sin modificarlo.'}</p><button className="button secondary" onClick={onClose}>Volver a mi día</button></footer>
    </section>
  </div>;
}
