import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { getDateAccess } from '../lib/datePolicy';
import { useDateAccess } from '../lib/useDateAccess';
import { useDialogFocus } from '../lib/useDialogFocus';
import { isMeditationComplete, setMeditationComplete } from '../lib/meditation';
import { meditationContent } from '../lib/meditationContent';
import './meditation.css';

export type MeditationCardProps={date:string;checks:Record<string,boolean>;setChecks:Dispatch<SetStateAction<Record<string,boolean>>>;scope?:string|null;onOpenJournal?:()=>void;onToday?:()=>void};
type Session={date:string;step:number;canRegisterAtStart:boolean};
function PeaceGlyph({size=30}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1" opacity=".3"/><circle cx="20" cy="20" r="9" stroke="currentColor" strokeWidth="1" opacity=".6"/><path d="M13 21c4 0 6 3 7 7 1-7 4-12 10-15-1 8-5 14-10 15-4 0-7-3-7-7Z" fill="currentColor"/><circle cx="14" cy="14" r="2.4" fill="currentColor" opacity=".65"/></svg>;
}
function Arrow({back=false}:{back?:boolean}) {return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back?'M19 12H5m6-6-6 6 6 6':'M5 12h14m-6-6 6 6-6 6'}/></svg>;}

export function MeditationCard({date,checks,setChecks,scope,onOpenJournal,onToday}:MeditationCardProps) {
  const [session,setSession]=useState<Session|null>(null),[notice,setNotice]=useState('');
  const access=useDateAccess(date),sessionAccess=useDateAccess(session?.date||date);
  const complete=isMeditationComplete(checks,date),identity=useId(),stepHeading=useRef<HTMLHeadingElement>(null);
  const close=()=>setSession(null),dialogRef=useDialogFocus(session!==null,close);
  const step=session?meditationContent.steps[session.step]:null;
  const lastStep=!!session&&session.step===meditationContent.steps.length-1;
  const sessionCanRegister=!!session&&session.canRegisterAtStart&&sessionAccess.canExecute;
  const crossedMidnight=!!session&&session.canRegisterAtStart&&!sessionAccess.canExecute;
  useEffect(()=>{setSession(null);setNotice('');},[scope]);
  useEffect(()=>{if(session)stepHeading.current?.focus({preventScroll:true});},[session?.step,session?.date]);

  function open() {setNotice('');setSession({date,step:0,canRegisterAtStart:getDateAccess(date).canExecute});}
  function mark(checked:boolean) {
    if(!getDateAccess(date).canExecute){setNotice('El registro se habilita sólo en el día de hoy.');return;}
    setChecks(current=>setMeditationComplete(current,date,checked));
    setNotice(checked?'Tu práctica de hoy quedó registrada.':'Se deshizo el registro de hoy.');
  }
  function finish() {
    if(!session)return;
    // Never transfer a practice to a different date when midnight passes during the guide.
    if(!session.canRegisterAtStart||!getDateAccess(session.date).canExecute){setNotice('Cambió el día o estás consultando otra fecha. Esta práctica no se registró.');return;}
    setChecks(current=>setMeditationComplete(current,session.date,true));setSession(null);setNotice('Tu práctica de hoy quedó registrada.');
  }
  function journal() {setSession(null);onOpenJournal?.();}
  const stateLabel=complete?(access.kind==='today'?meditationContent.completedTodayLabel:'Registrada ese día'):(access.kind==='past'?'Sin registro':meditationContent.pendingTodayLabel);

  return <>
    <section className={'panel meditation-card '+(complete?'is-complete':'')} aria-labelledby={`${identity}-card-heading`}>
      <div className="meditation-card-top"><span className="meditation-glyph"><PeaceGlyph/></span><div><p className="eyebrow">MEDITACIÓN</p><h2 id={`${identity}-card-heading`}>Un momento de paz</h2></div><span className="meditation-state">{complete&&<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}{stateLabel}</span></div>
      <p className="meditation-card-description">{meditationContent.subtitle}</p><div className="meditation-suggestion"><span aria-hidden="true">◷</span><p>{meditationContent.suggestedMinutes[0]}–{meditationContent.suggestedMinutes[1]} minutos, si te viene bien.<small>Sin horario fijo. Hacé lugar cuando tenga sentido para vos.</small></p></div>
      <div className="meditation-card-actions"><button type="button" className="button primary" onClick={open}>{access.canExecute?'Meditar ahora':'Leer la práctica'}<Arrow/></button>{complete?<button type="button" className="text-button" disabled={!access.canExecute} onClick={()=>mark(false)}>Deshacer registro</button>:<button type="button" className="button secondary" disabled={!access.canExecute} onClick={()=>mark(true)}>Ya medité</button>}</div>
      {!access.canExecute&&<p className="meditation-date-note">Podés leer la guía. Los registros se hacen sólo en el día de hoy.</p>}{notice&&<p className="meditation-notice" role="status">{notice}</p>}{complete&&onOpenJournal&&<button type="button" className="text-button meditation-journal-link" onClick={journal}>{access.canExecute?'Si querés, llevá algo de este momento a tu diario':'Ver el diario de ese día'}<Arrow/></button>}
    </section>
    {session&&step&&createPortal(<div className="meditation-backdrop" onClick={event=>{if(event.target===event.currentTarget)close();}}><section className="meditation-dialog" role="dialog" aria-modal="true" aria-labelledby={`${identity}-guide-heading`} ref={dialogRef} tabIndex={-1}>
      <header className="meditation-dialog-header"><div><p className="eyebrow">UN MOMENTO PARA VOS</p><h2 id={`${identity}-guide-heading`}>{meditationContent.title}</h2></div><button type="button" className="icon-button meditation-close" aria-label="Cerrar práctica" onClick={close}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>
      <div className="meditation-guide-body"><div className="meditation-step-marker"><span>Paso {session.step+1} de {meditationContent.steps.length}</span><div aria-hidden="true">{meditationContent.steps.map((item,index)=><i key={item.id} className={index<=session.step?'is-active':''}/>)}</div></div>
        <div className="meditation-orbit" aria-hidden="true"><span/><span/><PeaceGlyph size={66}/></div>
        {session.step===0&&<p className="meditation-intro">{meditationContent.intro}</p>}
        <div className="meditation-step-content" key={step.id}><h3 ref={stepHeading} tabIndex={-1}>{step.title}</h3><p>{step.guidance}</p></div>
        {lastStep&&<aside className="meditation-reflection"><p className="eyebrow">{meditationContent.optionalReflection.title}</p><p>{meditationContent.optionalReflection.prompt}</p><small>Es opcional. No tenés que escribir ni responder para terminar.</small>{onOpenJournal&&<button type="button" className="text-button" onClick={journal}>{sessionAccess.canExecute?'Abrir mi diario':'Ver mi diario'}<Arrow/></button>}</aside>}
        {crossedMidnight?<div className="meditation-session-note" role="status"><p>Cambió el día mientras hacías la práctica. No la pasamos a otra fecha ni la registramos automáticamente.</p>{onToday&&<button type="button" className="button secondary" onClick={()=>{close();onToday();}}>Volver a hoy</button>}</div>:!sessionCanRegister&&<p className="meditation-session-note">Estás leyendo la práctica. Para registrar una meditación, abrila desde el día de hoy.</p>}
      </div>
      <footer className="meditation-dialog-footer"><div className="meditation-guide-actions"><button type="button" className="button secondary" disabled={session.step===0} onClick={()=>setSession(current=>current?{...current,step:Math.max(0,current.step-1)}:null)}><Arrow back/>Volver</button>{lastStep?<button type="button" className="button primary" disabled={!sessionCanRegister} onClick={finish}>Finalizar y registrar<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>:<button type="button" className="button primary" onClick={()=>setSession(current=>current?{...current,step:Math.min(meditationContent.steps.length-1,current.step+1)}:null)}>Continuar<Arrow/></button>}</div><button type="button" className="text-button meditation-exit" onClick={close}>Salir de la práctica</button><small className="meditation-attribution">{meditationContent.attribution}<span>{meditationContent.source.label}</span></small></footer>
    </section></div>,document.body)}
  </>;
}
export default MeditationCard;
