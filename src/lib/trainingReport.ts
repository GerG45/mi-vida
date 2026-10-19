import { getTrainingElapsed, getTrainingSummary, normalizeTrainingSession, type TrainingExerciseLog, type TrainingSession } from './training';

const number = (value:number) => value.toLocaleString('es-AR',{maximumFractionDigits:2});
const workingLoads = (exercise:TrainingExerciseLog):number[] => exercise.sets.filter(set=>set.kind==='working'&&set.completedAt!==null&&set.loadKg!==null).map(set=>set.loadKg!);
const statusLabel = {active:'En curso',paused:'En pausa',completed:'Finalizada',abandoned:'Cerrada parcial',imported:'Historial importado'};

/** Factual training records stay separate from reconstructed calendar blocks. */
export function trainingReport(raw:unknown,dates:string[],exportedAt:number,inline:(value:unknown)=>string,quote:(value:unknown)=>string) {
  const all:TrainingSession[]=[];
  if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const [id,value] of Object.entries(raw)){
    const session=normalizeTrainingSession(value,id);if(session)all.push(session);
  }
  all.sort((a,b)=>a.startedAt-b.startedAt||a.id.localeCompare(b.id));
  const sessions=all.filter(session=>!session.legacyDateUnknown&&dates.includes(session.date));
  const undated=all.filter(session=>session.status==='imported'&&session.legacyDateUnknown);
  const actual=sessions.filter(session=>session.status!=='imported'&&session.exercises.some(exercise=>exercise.sets.some(set=>set.completedAt!==null)));
  const sums=actual.map(getTrainingSummary);
  const lines=['## Entrenamiento · registros guardados','',
    `- Sesiones con alguna serie registrada: **${actual.length}**.`,
    `- Series efectivas completadas: **${sums.reduce((n,s)=>n+s.completedSets,0)}**. Aproximaciones completadas: **${sums.reduce((n,s)=>n+s.warmupSets,0)}**.`,
    '- Sólo se cuentan las series confirmadas. Una carga recordada, un borrador o una marca de agenda no equivale a una serie realizada.',
    '- El tiempo es el cronómetro de la sesión, incluidas sus pausas entre series y excluida la pausa manual de la sesión. No mide tiempo bajo tensión ni intensidad.',
    '- Las cargas se comparan sólo dentro del mismo ejercicio y variante; no permiten inferir fuerza ni equivalencias entre máquinas. “Sin carga registrada” tampoco significa 0 kg.',''];
  if(!sessions.length)lines.push('No hay sesiones de gimnasio registradas para estas fechas. Los entrenamientos del calendario siguen siendo propuestas.','');
  if(undated.length)lines.push(`Hay **${undated.length}** registros importados sin fecha de entrenamiento verificable. Se conservan en el historial del gimnasio y quedan fuera de esta semana y de sus totales.`, '');
  for(const session of sessions){
    const summary=getTrainingSummary(session);
    const imported=session.status==='imported';
    const dayEnd=new Date(`${session.date}T00:00:00`);dayEnd.setDate(dayEnd.getDate()+1);
    const dayClosed=Number.isFinite(exportedAt)&&exportedAt>=dayEnd.getTime();
    lines.push(`### ${session.date} · ${inline(session.title)} · Semana ${session.week}`, '',
      `**Estado:** ${dayClosed&&(session.status==='active'||session.status==='paused')?'Sin cierre registrado · día cerrado':statusLabel[session.status]}.`);
    if(imported){
      lines.push('Registro del gym anterior: conserva las cargas y estados originales. No tenía repeticiones reales ni duración de sesión; no se incluye en los totales de series realizadas.','');
    }else{
      const elapsed=getTrainingElapsed(session,Number.isFinite(exportedAt)?exportedAt:session.startedAt);
      lines.push(`- Cronómetro guardado${session.status==='active'?(dayClosed?' hasta el final de su fecha':' al exportar'):''}: **${number(elapsed/60)} min**.`,
        `- Series efectivas: **${summary.completedSets}** registradas / ${summary.targetSets} preparadas en la sesión. Aproximaciones: **${summary.warmupSets}** registradas.`,
        `- Ejercicios marcados hechos: **${summary.completedExercises}/${summary.totalExercises}**.`,
        `- RPE promedio registrado: **${summary.averageRpe===null?'Sin registrar':number(summary.averageRpe)+'/10'}**. Molestia promedio registrada: **${summary.averageDiscomfort===null?'Sin registrar':number(summary.averageDiscomfort)+'/10'}**.`,'');
    }
    for(const exercise of session.exercises){
      const completed=exercise.sets.filter(set=>set.completedAt!==null);
      const sets=imported?exercise.sets.filter(set=>set.loadKg!==null):completed;
      const hasDetail=sets.length||exercise.notes.trim()||exercise.rpe!==null||exercise.discomfort!==null||exercise.status!=='pending';
      if(!hasDetail)continue;
      lines.push(`**${inline(exercise.name)}** · ${({pending:'Pendiente',done:'Hecho',adjust:'Ajustar',skipped:'Saltado'})[exercise.status]}`,'');
      for(const set of sets){
        const load=set.loadKg===null?'Sin carga registrada':`${number(set.loadKg)} kg`;
        const done=imported?'repeticiones y segundos sin registro':set.durationSeconds!==null?`${number(set.durationSeconds)} s`:set.reps!==null?`${number(set.reps)} repeticiones`:'Sin repeticiones ni segundos';
        lines.push(`- ${set.id.toUpperCase()} · ${set.kind==='warmup'?'Aproximación':'Serie efectiva'}: **${load}** · ${done}${imported?' · carga del archivo anterior':''}.`);
      }
      if(!imported){
        const current=workingLoads(exercise);
        const previous=all.filter(item=>item.id!==session.id&&item.status!=='imported'&&item.startedAt<session.startedAt)
          .reverse().map(item=>({session:item,exercise:item.exercises.find(value=>value.exerciseId===exercise.exerciseId&&value.variantId===exercise.variantId&&workingLoads(value).length)})).find(item=>item.exercise);
        if(current.length&&previous?.exercise){
          const before=Math.max(...workingLoads(previous.exercise)),after=Math.max(...current),delta=after-before;
          lines.push(`- Mayor carga efectiva registrada en esta sesión: **${number(after)} kg**. Registro anterior de la misma variante (${previous.session.date}): **${number(before)} kg**. Diferencia: **${delta>0?'+':''}${number(delta)} kg**; revisar junto a las repeticiones y sensaciones.`);
        }
      }
      if(exercise.rpe!==null)lines.push(`- RPE elegido: ${number(exercise.rpe)}/10.`);
      if(exercise.discomfort!==null)lines.push(`- Molestia elegida: ${number(exercise.discomfort)}/10.`);
      if(exercise.notes.trim())lines.push('',quote(exercise.notes));
      lines.push('');
    }
    if(session.notes.trim())lines.push('**Notas de la sesión**','',quote(session.notes),'');
  }
  return {lines,trainingSessions:actual.length};
}
