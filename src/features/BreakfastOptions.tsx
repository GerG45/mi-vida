import type { Settings } from '../lib/planner';
import { breakfastOptions, menu } from '../lib/content';
import './breakfast.css';

type BreakfastSettings = Pick<Settings, 'breakfastCreatine' | 'hasBlender' | 'hasHandBlender'>;

/** Kitchen companion: receives the selected JavaScript weekday (Sunday = 0). */
export function BreakfastOptions({ settings, selectedDay }: { settings: BreakfastSettings; selectedDay: number }) {
  const day = Number.isInteger(selectedDay) && selectedDay >= 0 && selectedDay <= 6 ? selectedDay : 0;
  const alternatives = breakfastOptions.filter(option => option.appliances.some(appliance =>
    appliance === 'blender' ? settings.hasBlender : settings.hasHandBlender,
  ));
  const appliances = [settings.hasBlender && 'licuadora', settings.hasHandBlender && 'minipimer'].filter(Boolean).join(' y ');

  return <section className="panel breakfast-panel" aria-labelledby="breakfast-title">
    <div className="section-title">
      <div><p className="eyebrow">UN COMIENZO SENCILLO</p><h2 id="breakfast-title">Tu desayuno, con opciones</h2></div>
      {appliances && <span className="breakfast-equipment">Tenés {appliances}</span>}
    </div>
    <div className="breakfast-base"><small>MENÚ BASE DEL DÍA</small><p>{menu[day].breakfast}</p></div>
    {settings.breakfastCreatine && <p className="breakfast-routine"><span aria-hidden="true">✓</span><span><strong>Creatina junto al desayuno.</strong> Un recordatorio para tu rutina de cada mañana.</span></p>}
    {alternatives.length > 0 ? <>
      <p className="muted">Elegí una alternativa en lugar del desayuno base. Usan ingredientes de tu lista de compras; no se suman como otra comida. Revisá lo que queda antes de cambiar el menú de varios días.</p>
      <div className="breakfast-grid">{alternatives.map(option => <details className="breakfast-option" key={option.id}>
        <summary><span><strong>{option.title}</strong><small>{option.duration}</small></span><span className="breakfast-expand" aria-hidden="true">+</span></summary>
        <div className="breakfast-recipe"><p>{option.ingredients}</p><ol>{option.steps.map(step => <li key={step}>{step}</li>)}</ol></div>
      </details>)}</div>
      <p className="source-note">Ideas para usar tus electrodomésticos, además del menú de tu plan. En mañanas con viaje, la opción de 5 minutos deja más margen para prepararte.</p>
    </> : <p className="muted">En Ajustes podés indicar si tenés licuadora o minipimer para ver más alternativas con los ingredientes del menú.</p>}
  </section>;
}
