import type { LifeBackup } from './lifeStore';
import { addDays, buildDay, defaults, formatTime, type DayOverride, type ExtraEvent, type Settings } from './planner';
import { getNightPlan } from './sleep';
import { trainingReport } from './trainingReport';

export type ReportWeek = { start: string; end: string; dates: string[] };
export type WeeklyReportOptions = {
  includeName?: boolean;
  includeTasks?: boolean;
  includePlanDetails?: boolean;
};
export type WeeklyReport = {
  filename: string;
  markdown: string;
  week: ReportWeek;
  journalDays: number;
  habitMarks: number;
  blockMarks: number;
  trainingSessions: number;
};

type Data = Record<string, unknown>;
const object = (value: unknown): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const values = (value: unknown): Data[] => Object.values(object(value)).map(object);
const dateObject = (date: string): Date => new Date(`${date}T12:00:00`);
const validDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(dateObject(value).getTime())
  && `${dateObject(value).getFullYear()}-${String(dateObject(value).getMonth() + 1).padStart(2, '0')}-${String(dateObject(value).getDate()).padStart(2, '0')}` === value;
const label = (date: string): string => dateObject(date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Calendar dates stay local: UTC conversion would move an Argentine evening to another day. */
export function getReportWeek(date: string): ReportWeek {
  if (!validDate(date)) throw new Error('Elegí una fecha válida para el reporte.');
  const start = addDays(date, -((dateObject(date).getDay() + 6) % 7));
  return { start, end: addDays(start, 6), dates: Array.from({ length: 7 }, (_, index) => addDays(start, index)) };
}

/** On Monday offer the week just finished; on Sunday offer the week being closed. */
export function getDefaultReportWeek(selected: string): ReportWeek {
  const week = getReportWeek(selected);
  return dateObject(selected).getDay() === 1 ? getReportWeek(addDays(week.start, -7)) : week;
}

// Only selected personal records are rendered. Configuration, account IDs and location
// fields are never serialized. Location links pasted into writing are also omitted.
const withoutMapLinks = (value: string): string => value.replace(
  /https?:\/\/(?:share\.google\/|maps\.app\.goo\.gl\/|goo\.gl\/maps\/?|(?:www\.)?google\.[^\s/]+\/maps(?:\/|\?|$)|maps\.google\.[^\s/]+\/)[^\s<>\])}]*/gi,
  '[enlace de ubicación omitido]',
);
const inline = (value: unknown): string => withoutMapLinks(string(value)).replace(/[\r\n]+/g, ' ').replace(/([\\`*_[\]<>|])/g, '\\$1');
const quote = (value: unknown): string => withoutMapLinks(string(value)).split(/\r?\n/).map(line => `> ${line}`).join('\n');
const journalFields = [
  ['intention', 'Mi intención'], ['gratitude', 'Agradezco'], ['smallStep', 'Un paso pequeño'],
  ['win', 'Algo que salió bien'], ['learned', 'Algo que aprendí'], ['letGo', 'Algo que puedo soltar'],
  ['freeText', 'Escritura libre'],
] as const;
const journalHasContent = (entry: Data): boolean => [...journalFields.map(([key]) => key), 'mood'].some(key => string(entry[key]).trim())
  || (typeof entry.energy === 'number' && entry.energy >= 1 && entry.energy <= 5);

export function buildWeeklyReport(backup: LifeBackup, date: string, options: WeeklyReportOptions = {}): WeeklyReport {
  const week = getReportWeek(date);
  const sections = object(backup.sections);
  const journal = object(sections.journal), habits = values(sections.habits).filter(habit => string(habit.id) && string(habit.name));
  const checks = object(sections.habitChecks), done = object(sections.done);
  const journalDays = week.dates.filter(day => journalHasContent(object(journal[day]))).length;
  const habitMarks = habits.reduce((count, habit) => count + week.dates.filter(day => checks[`${day}:${habit.id}`] === true).length, 0);
  const blockMarks = Object.entries(done).filter(([key, value]) => value === true && week.dates.some(day => key.startsWith(`${day}:`))).length;
  const created = new Date(backup.exportedAt);
  const generatedAt = Number.isNaN(created.getTime()) ? 'fecha de exportación no disponible' : created.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hourCycle: 'h23' });
  const lines = [
    '# Mi Vida · Reporte semanal', '',
    `**Semana:** ${label(week.start)} — ${label(week.end)}.`,
    `**Exportado:** ${generatedAt} (hora argentina).`,
  ];
  const name = string(object(sections.profile).name).trim();
  if (options.includeName && name) lines.push(`**Nombre:** ${inline(name)}.`);
  lines.push('',
    'Este archivo reúne mis registros para conversar sobre mi semana y mejorar mi organización. Contiene escritura personal; lo comparto manualmente cuando lo decido.', '',
    '## Cómo leer este reporte', '',
    '- El diario y las marcas por fecha son registros guardados. Sin marca significa “sin registro”, no que algo no haya sucedido.',
    '- La agenda se reconstruye con los ajustes y excepciones actuales: no es una fotografía histórica ni una medición de lo que hice. Un cambio posterior de horario también puede cambiar esta reconstrucción.',
    '- Despertar y acostarse son horarios propuestos. No son horas reales de sueño ni permiten calcular cuánto dormí.',
    '- Las marcas de bloques no guardan la hora real ni la duración de ejecución. Marcar el desayuno no confirma por separado haber tomado creatina.',
    '- Los hábitos y el estado de GTD corresponden a lo que existe al exportar. No hay historial de altas, cambios de estado o fechas de finalización.',
    '- No se agregan domicilios, enlaces de ubicación ni configuración de acceso. Mi escritura puede contener otros datos personales y conviene revisarla antes de compartir.', '',
    '## Registros disponibles', '',
    `- Días con escritura, ánimo o energía registrados: **${journalDays} de 7**.`,
    `- Marcas de hábitos existentes en el rango: **${habitMarks}**.`,
    `- Marcas de bloques guardadas para estas fechas: **${blockMarks}** (pueden incluir bloques que ya no aparecen en la agenda actual).`,
    '- No se estiman valores para los días sin registro.', '',
    '## Mi diario, día por día', '',
  );
  for (const day of week.dates) {
    const entry = object(journal[day]);
    lines.push(`### ${label(day)}`, '');
    if (!journalHasContent(entry)) { lines.push('Sin entrada registrada.', ''); continue; }
    lines.push(`- Ánimo registrado: ${inline(entry.mood) || 'Sin registrar'}.`);
    lines.push(`- Energía elegida: ${typeof entry.energy === 'number' && entry.energy >= 1 && entry.energy <= 5 ? `${entry.energy}/5` : 'Sin registrar'}.`, '');
    for (const [key, title] of journalFields) {
      if (!string(entry[key]).trim()) continue;
      lines.push(`**${title}**`, '', quote(entry[key]), '');
    }
  }

  lines.push('## Hábitos · marcas guardadas por fecha', '',
    'Se muestran los hábitos que existen ahora. “—” significa sin marca guardada. No hay registro de cuándo se creó cada hábito; no se calcula una tasa de cumplimiento.', '');
  if (!habits.length) lines.push('No hay hábitos guardados al exportar.', '');
  else {
    lines.push(`| Hábito actual | ${week.dates.map(day => dateObject(day).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })).join(' | ')} |`,
      `| --- | ${week.dates.map(() => '---').join(' | ')} |`);
    for (const habit of habits) lines.push(`| ${inline(habit.name)} | ${week.dates.map(day => checks[`${day}:${habit.id}`] === true ? '✓' : '—').join(' | ')} |`);
    lines.push('');
    for (const habit of habits) {
      lines.push(`- **${inline(habit.name)}**${string(habit.cue) ? ` · Señal: ${inline(habit.cue)}` : ''}${string(habit.tinyStep) ? ` · Paso pequeño: ${inline(habit.tinyStep)}` : ''}.`);
    }
    lines.push('');
  }

  lines.push('## Agenda reconstruida · propuesta y marcas', '',
    'Los horarios siguientes son del plan actual. “Marcado hecho” es la marca guardada para ese bloque en esa fecha; “sin marca” no permite saber si se realizó. Los bloques de referencia no se cuentan como tareas.', '');
  // Keep place names/addresses out even if someone used a street address as a destination label.
  const settings = { ...defaults, ...object(sections.settings), workLocation: 'lugar de trabajo', rehearsalPlace: 'lugar del ensayo', homeMapsUrl: '', gymMapsUrl: '', workMapsUrl: '', mondayRehearsalMapsUrl: '' } as Settings;
  const overrides = object(sections.overrides) as Record<string, DayOverride>;
  const extras = Array.isArray(sections.extras) ? sections.extras as ExtraEvent[] : [];
  for (const day of week.dates) {
    const plan = buildDay(day, settings, overrides, extras);
    const night = getNightPlan(day, settings, overrides, extras);
    lines.push(`### ${label(day)} · Semana ${plan.week}`, '');
    lines.push(`- Despertar propuesto: **${formatTime(plan.wakeTime)}**.`, `- Acostarse propuesto para la noche anterior: **${formatTime(plan.bedtimePrevious)}**.`);
    if (night.enabled) lines.push(`- Acostarse para el próximo día: **${night.bedtimeDate} a las ${formatTime(night.bedtime)}** (propuesto para ${night.sleepHours} h de sueño).`, `- Despertar propuesto del día siguiente (${night.wakeDate}): **${formatTime(night.wakeTime)}**.`);
    lines.push('');
    if (!plan.events.length) lines.push('No hay agenda activada para reconstruir.', '');
    else {
      for (const event of plan.events) {
        const state = done[`${day}:${event.id}`] === true ? 'Marcado hecho' : ['family', 'sleep'].includes(event.kind) ? 'Referencia del plan' : 'Sin marca';
        const flags = [event.tentative && 'estimado', event.conflict && 'cruce de horario'].filter(Boolean);
        lines.push(`- **${formatTime(event.start)}–${formatTime(event.end)} · ${inline(event.title)}** — ${state}${flags.length ? ` · ${flags.join(' · ')}` : ''}.`);
        if (options.includePlanDetails && event.detail) lines.push(`  ${inline(event.detail)}`);
      }
      lines.push('');
    }
    if (object(overrides[day]).skipPewen === true && dateObject(day).getDay() === 1) lines.push('**Excepción guardada:** este lunes no voy a Pewen; no se traslada la jornada a otro día.', '');
    if (plan.warnings.length) { lines.push('**Avisos del plan:**'); plan.warnings.forEach(warning => lines.push(`- ${inline(warning)}`)); lines.push(''); }
    if (night.enabled && night.conflicts.length) { lines.push('**Cruces con el descanso propuesto para el próximo día:**'); night.conflicts.forEach(conflict => lines.push(`- ${inline(conflict)}`)); lines.push(''); }
    if (plan.pending.length) { lines.push('**Por definir en el sistema:**'); plan.pending.forEach(pending => lines.push(`- ${inline(pending)}`)); lines.push(''); }
  }

  const training=trainingReport(sections.gymSessions,week.dates,created.getTime(),inline,quote);
  lines.push(...training.lines);

  if (options.includeTasks !== false) {
    lines.push('## GTD · estado actual al exportar', '',
      'Esta sección muestra el estado actual de mis pendientes y proyectos, aunque hayan sido creados antes o después de la semana elegida. “Hecho” no significa “terminado durante esta semana”: no hay fecha de finalización guardada. La papelera queda fuera del reporte.', '');
    const knownStatuses = ['inbox', 'next', 'waiting', 'someday', 'reference', 'done', 'trash'];
    const tasks = values(sections.tasks).filter(task => string(task.title) && task.status !== 'trash')
      .map(task => ({ ...task, status: knownStatuses.includes(string(task.status)) ? task.status : 'inbox' } as Data));
    const projects = values(sections.projects).filter(project => string(project.title));
    const statuses = [['inbox', 'Entrada'], ['next', 'Próximas acciones'], ['waiting', 'En espera'], ['someday', 'Algún día'], ['reference', 'Referencia'], ['done', 'Hecho · estado actual']] as const;
    if (!tasks.length) lines.push('No hay acciones GTD guardadas fuera de la papelera.', '');
    for (const [status, title] of statuses) {
      const group = tasks.filter(task => task.status === status);
      if (!group.length) continue;
      lines.push(`### ${title} (${group.length})`, '');
      for (const task of group) {
        const project = projects.find(item => item.id === task.projectId);
        lines.push(`- **${inline(task.title)}**${string(task.context) ? ` · ${inline(task.context)}` : ''}${validDate(string(task.due)) ? ` · Fecha objetivo: ${inline(task.due)}` : ''}${project ? ` · Proyecto actual: ${inline(project.title)}` : ''}.`);
        const energy = ({ low: 'baja', medium: 'media', high: 'alta' } as Record<string, string>)[string(task.energy)];
        const minutes = typeof task.minutes === 'number' && Number.isFinite(task.minutes) && task.minutes > 0 ? task.minutes : undefined;
        if (minutes !== undefined || energy) lines.push(`  ${[minutes !== undefined && `Duración estimada actual: ${minutes} min`, energy && `Energía requerida elegida: ${energy}`].filter(Boolean).join(' · ')}.`);
        if (string(task.waitingFor)) lines.push(`  Espero de: ${inline(task.waitingFor)}.`);
        if (string(task.notes)) lines.push('', quote(task.notes), '');
      }
      lines.push('');
    }
    const activeProjects = projects.filter(project => project.archived !== true);
    lines.push('### Proyectos activos al exportar', '');
    if (!activeProjects.length) lines.push('Sin proyectos activos guardados.', '');
    for (const project of activeProjects) {
      lines.push(`- **${inline(project.title)}**${string(project.outcome) ? ` · Resultado buscado: ${inline(project.outcome)}` : ''}.`);
    }
    lines.push('');
  }
  lines.push('## Para conversar y ajustar la próxima semana', '',
    '1. ¿Qué cosas del diario me dieron calma, energía o satisfacción? ¿Qué situaciones se repitieron?',
    '2. ¿Qué bloques del plan quedaron demasiado ajustados, se superpusieron o dependían de tiempos todavía estimados?',
    '3. ¿Qué hábito fue fácil de empezar y qué señal o paso pequeño convendría adaptar?',
    '4. ¿Qué pendientes necesitan una próxima acción más concreta, una espera explícita o dejar de ser prioridad?',
    '5. ¿Qué único cambio pequeño quiero probar la próxima semana y qué voy a registrar para saber si me ayudó?', '',
    'Al analizar, separar hechos registrados, hipótesis y datos que faltan. Proponer ajustes concretos sin convertir los espacios vacíos en fallas ni inferir diagnósticos.', '',
  );
  return { filename: `Mi-Vida-reporte-${week.start}-al-${week.end}.md`, markdown: lines.join('\n'), week, journalDays, habitMarks, blockMarks, trainingSessions:training.trainingSessions };
}
