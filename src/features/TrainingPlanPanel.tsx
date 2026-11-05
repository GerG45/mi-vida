import type {Settings} from '../lib/planner';
import {monthlyTrainingPlan} from '../lib/trainingPlan';
import {getTrainingPlanReview} from '../lib/trainingPlanReview';
import './trainingPlanPanel.css';

export function TrainingPlanPanel({settings,today,onActivate,onReview,patch}:{settings:Settings;today:string;onActivate:()=>void;onReview:()=>void;patch:<K extends keyof Settings>(key:K,value:Settings[K])=>void}) {
  const active=settings.trainingPlanId===monthlyTrainingPlan.id&&!!settings.trainingPlanStartedOn;
  const review=getTrainingPlanReview(settings,today);
  return <section className="panel training-plan-panel" aria-label="Plan del mes">
    <p className="eyebrow">UNA ETAPA POSIBLE</p><h2>{monthlyTrainingPlan.title}</h2><p>{monthlyTrainingPlan.description}</p>
    <div className="training-plan-days"><strong>Martes · jueves · sábado</strong><span>90 min para cada sesión principal</span><span>Un cuarto día opcional · práctica corta de 35 min</span></div>
    <p>Los martes y jueves se buscan por la mañana. El sábado se acomoda antes de Navegantes. El cuarto día se agrega sólo para la fecha que elijas desde «Mi día». Se conservan comidas, traslados, ducha y cuidados.</p>
    <div className="training-plan-routines">{monthlyTrainingPlan.routines.map(routine=><div key={routine.id}><strong>{routine.name}</strong><span>{routine.focus}</span></div>)}</div>
    <p>{monthlyTrainingPlan.effort}</p><p>{monthlyTrainingPlan.optionalCue}</p>
    {!active?<button className="button primary" onClick={onActivate}>Activar este plan y sus tres días</button>:<p className="training-plan-active">Plan activo desde {settings.trainingPlanStartedOn}. Las sesiones y cargas anteriores siguen en su historial.</p>}
    <div className="training-plan-review"><h3>Una revisión cada mes</h3><p>La alerta invita a revisar el reporte y preparar la siguiente etapa. No reemplaza rutinas ni cambia cargas por su cuenta.</p>
      <label className="toggleline"><input type="checkbox" checked={settings.trainingPlanReviewEnabled!==false} onChange={event=>patch('trainingPlanReviewEnabled',event.target.checked)}/><span>Avisarme que toca renovar el plan</span></label>
      <label className="field"><span>Hora del aviso mensual</span><input type="time" value={settings.trainingPlanReviewTime||'09:00'} onChange={event=>{if(event.target.value)patch('trainingPlanReviewTime',event.target.value);}}/></label>
      {active&&review&&<p role="status">{review.overdue?`Revisión pendiente desde ${review.dueOn}.`:`Primera revisión pendiente: ${review.dueOn}.`} Próximo aviso: {review.nextOn}, a las {settings.trainingPlanReviewTime||'09:00'}.</p>}
      {active&&<button className="button secondary" disabled={!review?.overdue||settings.trainingPlanReviewedOn===today} onClick={onReview}>Ya revisé el plan hoy</button>}
      {!active&&<p>El primer aviso se prepara al activar el plan. En Android usa el tono de recordatorio; en la web aparece el aviso dentro de Mi Vida.</p>}
    </div>
    <details><summary>Progresión y fuentes del plan</summary>{monthlyTrainingPlan.weeks.map(week=><p key={week.week}><strong>Semana {week.week} · {week.focus}.</strong> {week.guidance}</p>)}<p>{monthlyTrainingPlan.assistanceCue}</p>{monthlyTrainingPlan.sources.map(source=><p key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a></p>)}</details>
  </section>;
}
