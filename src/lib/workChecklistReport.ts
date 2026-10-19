import { getWorkChecklistBlockId, getWorkItemElapsed, normalizeWorkItem, type WorkItem } from './workChecklist';

const minutes = (seconds: number): string => (seconds / 60).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const blockLabel = (id: string): string => id === 'flex-work' || id.startsWith('flex-work-') ? 'Trabajo / proyectos'
  : id.startsWith('cordoba-work') ? 'Trabajo fijo'
  : id === 'recording' ? 'Grabación'
  : id === 'monday-rehearsal' || id === 'saturday-rehearsal' ? 'Ensayo'
  : 'Bloque de trabajo';

/** Checklist assignments and saved marks remain separate from the reconstructed agenda. */
export function workChecklistReport(raw: unknown, dates: string[], exportedAt: number, inline: (value: unknown) => string) {
  const items: WorkItem[] = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw)) {
      const item = normalizeWorkItem(value, id);
      if (item && dates.includes(item.date)) items.push({ ...item, blockId: getWorkChecklistBlockId({ id: item.blockId }) });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.blockId.localeCompare(b.blockId) || a.order - b.order || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const marked = items.filter(item => item.done).length;
  const estimates = items.filter(item => item.estimatedMinutes !== null);
  const elapsed = (item: WorkItem): number => Number.isFinite(exportedAt) ? getWorkItemElapsed(item, exportedAt) : item.elapsedSeconds;
  const timed = items.filter(item => elapsed(item) > 0 || item.timerStartedAt !== null);
  const lines = ['## Trabajo / proyectos · listas guardadas por fecha', '',
    `- Ítems asignados a estas fechas: **${items.length}**. Con check al exportar: **${marked}**.`,
    '- Cada lista corresponde a su fecha y bloque asignados. El check muestra el estado guardado al exportar; no demuestra que se haya terminado durante esa fecha ni mide cuánto se trabajó.',
    '- Los minutos estimados son una intención. El cronómetro acumula sólo el tiempo iniciado por mí, incluidas las distracciones mientras sigue encendido; no verifica actividad ni productividad. Un check o una estimación no generan tiempo registrado.', ''];
  if (!items.length) lines.push('No hay ítems de trabajo guardados para estas fechas. Las marcas de agenda y los pendientes GTD se muestran por separado.', '');
  else {
    if (estimates.length) lines.push(`- Estimación guardada para **${estimates.length} de ${items.length}** ítems: **${estimates.reduce((total, item) => total + item.estimatedMinutes!, 0).toLocaleString('es-AR')} min**.`);
    if (timed.length) lines.push(`- Cronómetro acumulado en estas listas${items.some(item => item.timerStartedAt !== null) ? ' hasta el momento de exportar' : ''}: **${minutes(timed.reduce((total, item) => total + elapsed(item), 0))} min**.`);
    lines.push('');
    for (const date of dates) {
      const dayItems = items.filter(item => item.date === date);
      if (!dayItems.length) continue;
      lines.push(`### ${date}`, '');
      const blocks = [...new Set(dayItems.map(item => item.blockId))];
      for (const [index, block] of blocks.entries()) {
        lines.push(`**${blockLabel(block)}${blocks.length > 1 ? ` · bloque ${index + 1}` : ''}**`, '');
        for (const item of dayItems.filter(entry => entry.blockId === block)) {
          const details = [item.estimatedMinutes === null ? 'Sin estimación' : `Estimación: ${item.estimatedMinutes.toLocaleString('es-AR')} min`];
          const seconds = elapsed(item);
          details.push(seconds > 0 || item.timerStartedAt !== null ? `Cronómetro: ${minutes(seconds)} min${item.timerStartedAt !== null ? ' · en marcha al exportar' : ''}` : 'Sin tiempo acumulado');
          lines.push(`- [${item.done ? 'x' : ' '}] ${inline(item.title)} · ${details.join(' · ')}.`);
        }
        lines.push('');
      }
    }
  }
  return { lines, workItems: items.length, workItemMarks: marked };
}
