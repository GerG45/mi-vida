import {useState} from 'react';
import type {LifeBackup} from '../lib/lifeStore';
import {buildUsageReport} from '../lib/usageReport';
import {useDateAccess} from '../lib/useDateAccess';
import {exportTextFile} from '../lib/textExport';
import './usageReport.css';

export function UsageReport({selected,snapshot}:{selected:string;snapshot:()=>LifeBackup}) {
  const [days,setDays]=useState(28),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const {today}=useDateAccess(selected);
  const end=selected>today?today:selected;
  // The parent rerenders with the account's records. Read that current snapshot, not a cached report.
  const {summary}=buildUsageReport(snapshot(),end,days);
  async function exportReport(){
    if(busy)return;
    setBusy(true);setMessage('');
    try{
      const report=buildUsageReport(snapshot(),end,days);
      const saved=await exportTextFile(report.filename,'\uFEFF'+report.markdown,'text/markdown;charset=utf-8');
      setMessage(saved?'Reporte de uso preparado. Podés traerlo a este chat para revisar tus tiempos y la próxima etapa.':'Descarga cancelada. Tus registros siguen guardados.');
    }catch{setMessage('No pudimos preparar el archivo. Tus registros siguen guardados; volvé a intentarlo.');}
    finally{setBusy(false);}
  }
  return <section className="panel usage-report" aria-label="Cómo vengo usando Mi Vida">
    <div className="section-title"><div><p className="eyebrow">MIRAR LO QUE YA CONSTRUÍSTE</p><h2>Tu ritmo, a la vista.</h2></div><span className="usage-spark" aria-hidden="true">✳</span></div>
    <p>Un resumen de tus registros para ajustar la semana con lo que viene pasando.</p>
    <div className="usage-period"><label className="field"><span>Período del reporte de uso</span><select value={days} onChange={event=>{setDays(Number(event.target.value));setMessage('');}}>{[7,28,90].map(value=><option value={value} key={value}>Últimos {value} días</option>)}</select></label><span>{summary.start} — {summary.end}</span></div>
    <div className="usage-metrics"><div><strong>{summary.trainingSessions}</strong><span>entrenamientos con series</span></div><div><strong>{summary.registeredDays}</strong><span>días con algún registro</span></div><div><strong>{summary.journalDays}</strong><span>días de diario</span></div><div><strong>{summary.unclosedTrainingSessions}</strong><span>sesiones sin cierre</span></div></div>
    <p className="usage-explanation">Son registros guardados, sin medir cuántas veces abriste la app. Un día sin marcas no significa que no hayas hecho nada. Los entrenamientos sin cierre se muestran sin inventar su duración.</p>
    <button className="button secondary" disabled={busy} onClick={exportReport}>{busy?'Preparando…':'Descargar reporte de uso'}</button>
    <p className="usage-privacy">El archivo resume fechas y cantidades. No incluye tu escritura personal, notas, ubicaciones ni datos de acceso. No se envía automáticamente.</p>
    {message&&<p className="usage-message" role="status">{message}</p>}
  </section>;
}
