import { useEffect, useState } from 'react';
import type { LifeBackup } from '../lib/lifeStore';
import { addDays } from '../lib/planner';
import { exportTextFile } from '../lib/textExport';
import { buildWeeklyReport, getDefaultReportWeek, getReportWeek } from '../lib/weeklyReport';
import './weeklyReport.css';

export type WeeklyReportProps = { selected: string; snapshot: () => LifeBackup };
const shortDate = (date: string): string => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

export function WeeklyReport({ selected, snapshot }: WeeklyReportProps) {
  const [anchor, setAnchor] = useState(() => getDefaultReportWeek(selected).start);
  const [includeName, setIncludeName] = useState(false);
  const [includePlanDetails, setIncludePlanDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setAnchor(getDefaultReportWeek(selected).start); setMessage(''); }, [selected]);
  const week = getReportWeek(anchor);
  const weekday = new Date(`${selected}T12:00:00`).getDay();
  const closing = weekday === 0 || weekday === 1;

  async function exportReport() {
    if (exporting) return;
    setExporting(true);
    try {
      // Read once at the click: writes made just before exporting belong in the report.
      const report = buildWeeklyReport(snapshot(), week.start, { includeName, includePlanDetails });
      const exported = await exportTextFile(report.filename, '\uFEFF' + report.markdown, 'text/markdown;charset=utf-8');
      if (!exported) { setMessage('Guardado cancelado. Tus registros siguen guardados en Mi Vida.'); return; }
      setMessage(`Reporte preparado: ${report.journalDays} días con registros de diario, ${report.habitMarks} marcas de hábitos, ${report.blockMarks} marcas de bloques, ${report.workItemMarks} de ${report.workItems} ítems de trabajo con check y ${report.trainingSessions} sesiones con series de entrenamiento registradas. Abrí el archivo descargado para revisarlo antes de compartirlo.`);
    } catch {
      setMessage('No pudimos guardar el archivo. Tus registros siguen guardados; volvé a intentarlo.');
    } finally {
      setExporting(false);
    }
  }

  return <section className={`panel weekly-report${closing ? ' weekly-report-closing' : ''}`} aria-label="Tu reporte semanal">
    <div className="weekly-report-heading"><div><p className="eyebrow">UN MOMENTO PARA MIRAR TU SEMANA</p>
      <h2>Lo vivido también te guía.</h2><p>{closing ? 'Es un buen momento para cerrar la semana y pensar el próximo paso.' : 'Podés volver el domingo o el lunes, o descargar una semana cuando quieras.'}</p></div>
      <span className="weekly-report-spark" aria-hidden="true">✳</span></div>
    <p className="weekly-report-description">Reuní tu diario, tus hábitos, la agenda, tus listas de trabajo y tus entrenamientos en un reporte para conversar acá con Codex. Incluye tus escritos personales: revisalo antes de adjuntarlo al chat.</p>
    <div className="weekly-report-period"><div><span>SEMANA DEL REPORTE</span><strong>{shortDate(week.start)} — {shortDate(week.end)}</strong><small>Lunes a domingo · {week.start.slice(0, 4)}</small></div>
      <div className="weekly-report-dates"><button className="icon-button" type="button" aria-label="Semana anterior del reporte" onClick={() => { setAnchor(addDays(week.start, -7)); setMessage(''); }}>‹</button>
        <label className="field"><span>Elegir una fecha de esa semana</span><input type="date" value={anchor} onChange={event => { if (event.target.value) { try { setAnchor(getReportWeek(event.target.value).start); setMessage(''); } catch { /* Keep the last valid calendar date. */ } } }} /></label>
        <button className="icon-button" type="button" aria-label="Semana siguiente del reporte" onClick={() => { setAnchor(addDays(week.start, 7)); setMessage(''); }}>›</button></div></div>
    <details className="weekly-report-options"><summary>Qué contiene y opciones del archivo</summary>
      <p>Incluye las siete páginas del diario, ánimo y energía registrados, hábitos, agenda, listas de trabajo por fecha y entrenamientos: series reales, cargas, aproximaciones, tiempos, RPE, molestias y notas. Las listas separan checks, minutos estimados y cronómetro. Distingue lo registrado de los horarios propuestos.</p>
      <label className="toggleline"><input type="checkbox" checked={includePlanDetails} onChange={event => setIncludePlanDetails(event.target.checked)} />Agregar las explicaciones de cada bloque de la agenda</label>
      <label className="toggleline"><input type="checkbox" checked={includeName} onChange={event => setIncludeName(event.target.checked)} />Incluir mi nombre</label>
      <p>La agenda refleja los ajustes actuales. No hay historial de cambios que permita reconstruir con certeza cómo estaba en esa semana.</p>
    </details>
    <div className="weekly-report-actions"><button className="button primary" type="button" onClick={exportReport} disabled={exporting}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" /></svg>{exporting ? 'Preparando reporte…' : 'Descargar reporte semanal'}</button>
      <span>Archivo de texto .md · se prepara en este dispositivo</span></div>
    <p className="weekly-report-privacy">La descarga no lo publica ni lo envía a Codex. Vos elegís si lo compartís. No agrega enlaces de ubicación ni datos de acceso.</p>
    {message && <p className="weekly-report-status" role="status">{message}</p>}
  </section>;
}
