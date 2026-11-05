import type {LifeBackup} from './lifeStore';
import {normalizeTrainingSession,type TrainingSession} from './training';
import {normalizeWorkItem} from './workChecklist';

export type UsageSummary={
  start:string;end:string;days:number;registeredDays:number;blockMarks:number;
  journalDays:number;habitMarks:number;meditationDays:number;workItems:number;
  workItemMarks:number;trainingSessions:number;trainingDays:number;
  closedTrainingSessions:number;unclosedTrainingSessions:number;
};
export type UsageReport={filename:string;markdown:string;summary:UsageSummary};
type Data=Record<string,unknown>;
const object=(value:unknown):Data=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Data:{};
const validDate=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
// These UTC noon values are calendar-key arithmetic, never conversions of recorded instants.
const shift=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
const weekday=(date:string)=>new Date(`${date}T12:00:00Z`).getUTCDay();
const monday=(date:string)=>shift(date,-((weekday(date)+6)%7));
const inline=(value:unknown)=>String(typeof value==='string'?value:'').slice(0,300)
  .replace(/https?:\/\/[^\s<>]+/gi,'[enlace omitido]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[correo omitido]')
  .replace(/[\r\n]+/g,' ').replace(/([\\`*_[\]<>|])/g,'\\$1');
const number=(value:number)=>value.toLocaleString('es-AR',{maximumFractionDigits:2});
const journalFields=['intention','gratitude','smallStep','win','learned','letGo','freeText','mood'];
const journalHasContent=(entry:Data)=>journalFields.some(field=>typeof entry[field]==='string'&&(entry[field] as string).trim())
  ||(typeof entry.energy==='number'&&Number.isInteger(entry.energy)&&entry.energy>=1&&entry.energy<=5);
const datedMark=(key:string)=>{const match=/^(\d{4}-\d{2}-\d{2}):(.+)$/.exec(key);return match&&validDate(match[1])?{date:match[1],id:match[2]}:null;};
const confirmedWorking=(session:TrainingSession)=>session.exercises.flatMap(exercise=>exercise.sets).filter(set=>set.kind==='working'&&set.completedAt!==null).length;
const closed=(session:TrainingSession)=>session.status==='completed'||session.status==='abandoned';
const validClosedClock=(session:TrainingSession)=>closed(session)&&session.completedAt!==null&&session.completedAt>=session.startedAt;

/** A read-only account snapshot: dated records are evidence, unmarked dates are unknown. */
export function buildUsageReport(backup:LifeBackup,endDate:string,days=28):UsageReport {
  if(!validDate(endDate))throw new Error('Elegí una fecha válida para el reporte de uso.');
  if(!Number.isInteger(days)||days<1||days>90)throw new Error('El período del reporte debe tener entre 1 y 90 días.');
  const start=shift(endDate,1-days),dates=Array.from({length:days},(_,index)=>shift(start,index));
  const inRange=(date:string)=>validDate(date)&&date>=start&&date<=endDate;
  const sections=object(backup.sections),registered=new Set<string>();
  const blockEntries=Object.entries(object(sections.done)).filter(([key,value])=>value===true&&!!datedMark(key)&&inRange(datedMark(key)!.date));
  blockEntries.forEach(([key])=>registered.add(datedMark(key)!.date));
  const journalDates=Object.entries(object(sections.journal)).filter(([date,entry])=>inRange(date)&&journalHasContent(object(entry))).map(([date])=>date);
  journalDates.forEach(date=>registered.add(date));
  const currentHabits=new Set(Object.entries(object(sections.habits)).filter(([id,value])=>{
    const habit=object(value);return habit.id===id&&typeof habit.name==='string'&&habit.name.trim();
  }).map(([id])=>id));
  let habitMarks=0,meditationDays=0;
  for(const [key,value] of Object.entries(object(sections.habitChecks))){
    const mark=datedMark(key);
    if(value!==true||!mark||!inRange(mark.date))continue;
    if(mark.id==='meditation'){meditationDays++;registered.add(mark.date);}
    else if(currentHabits.has(mark.id)){habitMarks++;registered.add(mark.date);}
  }
  const work=Object.entries(object(sections.workItems)).flatMap(([key,value])=>{const item=normalizeWorkItem(value,key);return item&&inRange(item.date)?[item]:[];});
  work.forEach(item=>registered.add(item.date));
  const allSessions=Object.entries(object(sections.gymSessions)).flatMap(([key,value])=>{
    const session=normalizeTrainingSession(value,key);return session&&inRange(session.date)&&session.status!=='imported'&&!session.legacyDateUnknown?[session]:[];
  }).sort((a,b)=>a.date.localeCompare(b.date)||a.startedAt-b.startedAt||a.id.localeCompare(b.id));
  allSessions.forEach(session=>registered.add(session.date));
  const sessions=allSessions.filter(session=>confirmedWorking(session)>0),trainingDates=new Set(sessions.map(session=>session.date));
  const closedSessions=sessions.filter(validClosedClock),unclosedSessions=sessions.filter(session=>!closed(session));
  const warmupOnly=allSessions.filter(session=>!confirmedWorking(session)&&session.exercises.some(exercise=>exercise.sets.some(set=>set.completedAt!==null)));
  const drafts=allSessions.filter(session=>!session.exercises.some(exercise=>exercise.sets.some(set=>set.completedAt!==null)));
  const summary:UsageSummary={start,end:endDate,days,registeredDays:registered.size,blockMarks:blockEntries.length,
    journalDays:journalDates.length,habitMarks,meditationDays,workItems:work.length,workItemMarks:work.filter(item=>item.done).length,
    trainingSessions:sessions.length,trainingDays:trainingDates.size,closedTrainingSessions:closedSessions.length,unclosedTrainingSessions:unclosedSessions.length};
  const lines=[
    '# Mi Vida · Reporte de uso y entrenamiento','',`**Período:** ${start} al ${endDate} (${days} días, inclusive).`,'',
    '## Qué muestran los datos','',
    '- Este reporte reúne registros fechados guardados; no mide aperturas de la app, pantallas visitadas, avisos recibidos ni asistencia al gimnasio.',
    '- Sin registro significa que falta información, no que una actividad no haya sucedido. Una fecha asignada a una lista o sesión tampoco prueba el momento exacto en que se usó la aplicación.',
    '- Las marcas y listas reflejan el estado guardado al exportar. No se comparan con una agenda reconstruida para calcular cumplimiento.',
    '- Los descansos guardados son tiempos configurados, no descansos reales medidos entre series. No se puede calcular un promedio de espera real con estos datos.',
    '- El cronómetro de una sesión incluye descansos y distracciones mientras sigue activo. Las sesiones sin cierre quedan fuera de los minutos; no se prolongan artificialmente hasta medianoche.',
    '- No se incluyen textos del diario, notas personales, ubicaciones, perfil ni configuración de acceso. Las cargas y el detalle de las series pueden revisarse en el reporte semanal.','',
    '## Registros disponibles','',
    `- Fechas con contenido, marcas o registros fechados: **${summary.registeredDays} de ${days}**. No es una tasa de uso ni de cumplimiento.`,
    `- Marcas de bloques guardadas: **${summary.blockMarks}**.`,
    `- Días con escritura, ánimo o energía: **${summary.journalDays}**.`,
    `- Marcas de hábitos que existen al exportar: **${summary.habitMarks}**. Las marcas de hábitos eliminados no permiten identificar una práctica actual.`,
    `- Días con meditación registrada: **${summary.meditationDays}**.`,
    `- Ítems en listas de trabajo fechadas: **${summary.workItems}**; con check al exportar: **${summary.workItemMarks}**. Planificar una lista no equivale a haber trabajado esos minutos.`,
    '- Las compras y los ajustes son estados actuales sin historial suficiente para fechar su uso; no se les atribuyen días de actividad.','',
    '## Entrenamientos con series confirmadas','',
    `- Sesiones con al menos una serie efectiva confirmada: **${summary.trainingSessions}**, en **${summary.trainingDays}** fechas distintas.`,
    `- Con cierre y cronómetro guardado interpretable como registro: **${summary.closedTrainingSessions}**. Sin cierre explícito: **${summary.unclosedTrainingSessions}**.`,
    `- Registros con sólo aproximaciones: **${warmupOnly.length}**. Borradores o cierres sin series confirmadas: **${drafts.length}**. Se conservan, pero no cuentan como sesiones con series efectivas.`,
    '- El historial importado de la antigua app queda fuera de estos totales, porque no permite confirmar series reales comparables.','',
    '### Distribución por día de la semana','',
    '| Día | Sesiones con series efectivas | Fechas distintas |','| --- | ---: | ---: |',
  ];
  for(const [day,label] of [[1,'Lunes'],[2,'Martes'],[3,'Miércoles'],[4,'Jueves'],[5,'Viernes'],[6,'Sábado'],[0,'Domingo']] as const){
    const matching=sessions.filter(session=>weekday(session.date)===day);
    lines.push(`| ${label} | ${matching.length} | ${new Set(matching.map(session=>session.date)).size} |`);
  }
  lines.push('','### Distribución por semana','',
    'Las semanas que cortan el período muestran sólo las fechas incluidas. Una semana vacía no demuestra ausencia de entrenamiento.','',
    '| Semana desde el lunes | Sesiones con series efectivas | Fechas distintas |','| --- | ---: | ---: |');
  for(const week of [...new Set(dates.map(monday))]){
    const matching=sessions.filter(session=>monday(session.date)===week);
    lines.push(`| ${week} | ${matching.length} | ${new Set(matching.map(session=>session.date)).size} |`);
  }
  lines.push('','### Sesiones del período','');
  if(!sessions.length)lines.push('No hay sesiones con series efectivas confirmadas en este período.','');
  else {
    lines.push('| Fecha | Rutina guardada | Series efectivas | Aproximaciones | Estado | Cronómetro guardado |','| --- | --- | ---: | ---: | --- | --- |');
    for(const session of sessions){
      const sets=session.exercises.flatMap(exercise=>exercise.sets),effective=sets.filter(set=>set.kind==='working');
      const count=effective.filter(set=>set.completedAt!==null).length,warmups=sets.filter(set=>set.kind==='warmup'&&set.completedAt!==null).length;
      const status=session.status==='completed'?'Finalizada':session.status==='abandoned'?'Cerrada parcial':'Sin cierre registrado';
      let clock='Sin cierre: no se suman minutos';
      if(validClosedClock(session))clock=`${number(session.elapsedSeconds/60)} min${session.elapsedSeconds<600?' · menor a 10 min: revisar si fue carga retrospectiva o sesión breve':''}`;
      else if(closed(session))clock='Cierre temporal incoherente: no se suman minutos';
      lines.push(`| ${session.date} | ${inline(session.title)} | ${count}/${effective.length} | ${warmups} | ${status} | ${clock} |`);
    }
    lines.push('','Las proporciones de series usan la copia guardada de cada sesión. No presuponen que todas las series pendientes debían completarse. No se calcula un promedio de duración con cierres incompletos o registros muy breves.','');
  }
  lines.push('## Para ajustar el sistema','',
    '1. ¿Qué distribución de días aparece en las sesiones con series, y qué parte puede sostenerse en las próximas semanas?',
    '2. ¿Qué sesiones necesitan un cierre más fácil para distinguir el registro real de un contador que quedó abierto?',
    '3. Si se usan descansos de dos minutos, ¿entra la sesión completa junto a traslados, ducha, cocina y cuidados?',
    '4. ¿Qué herramienta conviene simplificar según lo que sí se está registrando, sin convertir los espacios vacíos en fallas?','',
    'Este archivo no modifica datos ni reescribe sesiones, cargas, series, notas o días anteriores. Los ajustes del próximo plan se deciden por separado.','');
  return {filename:`Mi-Vida-uso-${start}-al-${endDate}.md`,markdown:lines.join('\n'),summary};
}
