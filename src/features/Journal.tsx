import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { addDays } from '../lib/planner';
import { books, getDailyInspiration, getDailyQuote, inspirations } from '../lib/inspiration';
import {getDateAccess} from '../lib/datePolicy';
import {useDateAccess} from '../lib/useDateAccess';
import './journal.css';

export type JournalEntry = {
  intention: string;
  gratitude: string;
  smallStep: string;
  win: string;
  learned: string;
  letGo: string;
  freeText: string;
  mood: string;
  /** 0 = sin registrar; 1 a 5 = registro elegido por la persona. */
  energy: number;
};

export type Habit = { id: string; name: string; cue: string; tinyStep: string };

export type JournalViewProps = {
  selected: string;
  onDateChange: (date: string) => void;
  entries: Record<string, JournalEntry>;
  setEntries: Dispatch<SetStateAction<Record<string, JournalEntry>>>;
};

export type HabitsViewProps = {
  selected: string;
  habits: Record<string, Habit>;
  setHabits: Dispatch<SetStateAction<Record<string, Habit>>>;
  checks: Record<string, boolean>;
  setChecks: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export const emptyJournalEntry = (): JournalEntry => ({
  intention: '', gratitude: '', smallStep: '', win: '', learned: '', letGo: '', freeText: '', mood: '', energy: 0,
});

const entryFields = ['intention', 'gratitude', 'smallStep', 'win', 'learned', 'letGo', 'freeText', 'mood'] as const;
const hasContent = (entry: JournalEntry | undefined) => Boolean(entry && (
  entryFields.some(key => typeof entry[key] === 'string' && entry[key].trim()) || entry.energy > 0
));
const folded = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-AR');
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

type WritingFieldProps = { label: string; hint: string; value: string; onChange: (value: string) => void; rows?: number; readOnly?:boolean };
function WritingField({ label, hint, value, onChange, rows = 3, readOnly = false }: WritingFieldProps) {
  return <label className="field journal-field"><span>{label}</span><small>{hint}</small>
    <textarea rows={rows} value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} maxLength={10000} />
  </label>;
}

export function JournalView({ selected, onDateChange, entries, setEntries }: JournalViewProps) {
  const access=useDateAccess(selected);
  const lockReason=access.kind==='past'?'Este día ya terminó. Tu diario se conserva para volver a leerlo.':'Podés explorar esta fecha. El diario se habilita para escribir cuando llegue ese día.';
  const [search, setSearch] = useState('');
  const [promptNote, setPromptNote] = useState('');
  const [inspirationId, setInspirationId] = useState(() => getDailyInspiration(selected).id);
  const [activeSection, setActiveSection] = useState<'morning' | 'evening' | 'free'>('morning');
  useEffect(() => { setInspirationId(getDailyInspiration(selected).id); setPromptNote(''); }, [selected]);
  const entry = { ...emptyJournalEntry(), ...entries[selected] };
  const inspiration = inspirations.find(item => item.id === inspirationId) ?? getDailyInspiration(selected);
  const source = books.find(book => book.id === inspiration.book)!;
  const dailyQuote = getDailyQuote(selected);
  const quoteBook = books.find(book => book.id === dailyQuote.book)!;
  const history = useMemo(() => Object.entries(entries ?? {})
    .filter(([date, item]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && hasContent(item))
    .filter(([date, item]) => !search.trim() || folded(`${date} ${entryFields.map(key => item[key] ?? '').join(' ')}`).includes(folded(search.trim())))
    .sort(([a], [b]) => b.localeCompare(a)), [entries, search]);

  function update<K extends keyof JournalEntry>(key: K, value: JournalEntry[K]) {
    if(!getDateAccess(selected).canExecute)return;
    setEntries(current => getDateAccess(selected).canExecute?({ ...current, [selected]: { ...emptyJournalEntry(), ...current[selected], [key]: value } }):current);
  }
  function changeInspiration(direction: number) {
    const current = inspirations.findIndex(item => item.id === inspiration.id);
    setInspirationId(inspirations[(current + direction + inspirations.length) % inspirations.length].id);
  }
  function usePrompt() {
    if(!getDateAccess(selected).canExecute)return;
    const text = `${inspiration.prompt}\n\n`;
    const next = entry.freeText ? `${entry.freeText}\n\n${text}` : text;
    if (!entry.freeText.includes(inspiration.prompt)) {
      if (next.length <= 10000) { update('freeText', next); setPromptNote(''); }
      else setPromptNote('Esta página llegó al límite de espacio. La pregunta queda arriba para que puedas retomarla cuando quieras.');
    }
    setActiveSection('free');
    requestAnimationFrame(() => document.getElementById('journal-free-text')?.focus());
  }

  return <div className="journal-view">
    <div className="page-title"><div><p className="eyebrow">ESCUCHARTE TAMBIÉN ES AVANZAR</p>
      <h1>Un rato para vos<span>.</span></h1><p className="subtitle">Tu día por dentro. Podés escribir una línea o quedarte un poco más.</p></div>
      <span className="journal-save-label">{access.canExecute?'Se guarda mientras escribís':'Página de solo lectura'}</span>
    </div>
    {!access.canExecute&&<p className="journal-date-lock" role="status"><span aria-hidden="true">◷</span>{lockReason}</p>}
    <div className="journal-datebar">
      <div><p className="eyebrow">LA PÁGINA DE</p><strong>{dateLabel(selected)}</strong></div>
      <div className="journal-date-actions"><button type="button" className="icon-button" aria-label="Día anterior del diario" onClick={() => onDateChange(addDays(selected, -1))}>‹</button>
        <input type="date" aria-label="Elegir fecha del diario" value={selected} onChange={event => event.target.value && onDateChange(event.target.value)} />
        <button type="button" className="icon-button" aria-label="Día siguiente del diario" onClick={() => onDateChange(addDays(selected, 1))}>›</button></div>
    </div>

    <section className="journal-inspiration" aria-label="Inspiración para escribir">
      <div className="journal-inspiration-top"><span className="eyebrow">UNA REFLEXIÓN ORIGINAL · {inspiration.theme.toUpperCase()}</span><span className="journal-spark" aria-hidden="true">✳</span></div>
      <p className="journal-reflection">{inspiration.reflection}</p>
      <p className="journal-attribution">Reflexión inspirada en <em>{source.title}</em>, de {source.author}.</p>
      <div className="journal-idea"><strong>{inspiration.title}</strong><p>{inspiration.idea}</p><p className="journal-prompt">{inspiration.prompt}</p></div>
      <div className="journal-inspiration-actions"><button type="button" className="button lime" onClick={usePrompt} disabled={!access.canExecute} title={!access.canExecute?lockReason:undefined}>Escribir sobre esto <span aria-hidden="true">↗</span></button>
        <div><button type="button" className="icon-button" aria-label="Reflexión anterior" onClick={() => changeInspiration(-1)}>‹</button>
          <button type="button" className="icon-button" aria-label="Otra reflexión" onClick={() => changeInspiration(1)}>›</button></div></div>
      {promptNote && <p className="journal-attribution" role="status">{promptNote}</p>}
      <details className="journal-source"><summary>Elegir otra idea y ver su fuente</summary>
        <label className="field"><span>Elegí lo que te acompañe hoy</span><select value={inspiration.id} onChange={event => setInspirationId(event.target.value)}>
          {inspirations.map(item => <option key={item.id} value={item.id}>{item.title} · {books.find(book => book.id === item.book)?.title}</option>)}
        </select></label>
        <p>Concepto parafraseado a partir de las páginas {inspiration.pages.join(', ')} del PDF adjunto ({source.pdfPages} páginas). Los números corresponden al archivo, no a la numeración impresa.</p>
        <p>La reflexión y la pregunta fueron escritas para esta app. No son citas textuales del libro. Podés adaptar estas ideas a tus horarios y a tu descanso.</p>
      </details>
    </section>

    <section className="journal-book-quote" aria-label="Cita textual del día">
      <p className="eyebrow">Del libro · cita textual</p>
      <blockquote>“{dailyQuote.quote}”</blockquote>
      <div className="journal-quote-source"><cite>{quoteBook.title} · {quoteBook.author}</cite><span>Página {dailyQuote.pages.join(', ')} del archivo de lectura</span></div>
    </section>

    <div className="journal-grid"><section className="panel journal-writing">
      <div className="section-title"><div><p className="eyebrow">SIN HACERLO PERFECTO</p><h2>¿Cómo estás hoy?</h2></div></div>
      <div className="journal-state-grid"><label className="field"><span>Mi ánimo</span><select value={entry.mood} disabled={!access.canExecute} onChange={event => update('mood', event.target.value)}>
        <option value="">Sin registrar</option>{['En calma', 'Con alegría', 'Con ganas', 'Cansado', 'Preocupado', 'Triste', 'Una mezcla'].map(mood => <option key={mood}>{mood}</option>)}
      </select></label><label className="field"><span>Mi energía</span><select value={entry.energy} disabled={!access.canExecute} onChange={event => update('energy', Number(event.target.value))}>
        <option value={0}>Sin registrar</option><option value={1}>1 · Muy poquita</option><option value={2}>2 · Baja</option><option value={3}>3 · Media</option><option value={4}>4 · Buena</option><option value={5}>5 · Mucha</option>
      </select></label></div>
      <div className="journal-section-tabs" aria-label="Momento de escritura">
        <button type="button" className={activeSection === 'morning' ? 'active' : ''} aria-pressed={activeSection === 'morning'} onClick={() => setActiveSection('morning')}>Para empezar</button>
        <button type="button" className={activeSection === 'evening' ? 'active' : ''} aria-pressed={activeSection === 'evening'} onClick={() => setActiveSection('evening')}>Para cerrar</button>
        <button type="button" className={activeSection === 'free' ? 'active' : ''} aria-pressed={activeSection === 'free'} onClick={() => setActiveSection('free')}>Escritura libre</button>
      </div>
      {activeSection === 'morning' && <div className="journal-fields">
        <WritingField label="Mi intención para hoy" hint="¿Cómo querés vivir este día? Una intención que puedas llevar con vos." value={entry.intention} readOnly={!access.canExecute} onChange={value => update('intention', value)} />
        <WritingField label="Algo que agradezco" hint="Puede ser una persona, un detalle o algo chiquito de tu vida cotidiana." value={entry.gratitude} readOnly={!access.canExecute} onChange={value => update('gratitude', value)} />
        <WritingField label="Un paso pequeño que sí puedo dar" hint="¿Qué acción concreta haría de hoy un día un poco más tuyo?" value={entry.smallStep} readOnly={!access.canExecute} onChange={value => update('smallStep', value)} />
      </div>}
      {activeSection === 'evening' && <div className="journal-fields">
        <WritingField label="Algo que hoy salió bien" hint="También cuentan el esfuerzo, haber pedido ayuda o haber podido descansar." value={entry.win} readOnly={!access.canExecute} onChange={value => update('win', value)} />
        <WritingField label="Algo que aprendí" hint="¿Qué descubriste sobre vos, tus tiempos o lo que necesitás?" value={entry.learned} readOnly={!access.canExecute} onChange={value => update('learned', value)} />
        <WritingField label="Algo que puedo soltar por hoy" hint="Lo que quedó pendiente puede esperar una nueva decisión. ¿Qué querés dejar acá?" value={entry.letGo} readOnly={!access.canExecute} onChange={value => update('letGo', value)} />
      </div>}
      {activeSection === 'free' && <label className="field journal-field journal-free"><span>Tu espacio, sin consigna</span><small>Escribí lo que necesites. Si usaste una pregunta de inspiración, podés seguir desde ahí.</small>
        <textarea id="journal-free-text" rows={13} value={entry.freeText} readOnly={!access.canExecute} maxLength={10000} onChange={event => update('freeText', event.target.value)} />
        <small>{entry.freeText.length.toLocaleString('es-AR')} / 10.000 caracteres</small>
      </label>}
      <p className="journal-gentle-note">No hace falta completar todos los campos. Este espacio sigue siendo tuyo cuando volvés.</p>
    </section>

    <aside className="panel journal-history"><div className="section-title"><div><p className="eyebrow">LO QUE VAS DEJANDO ESCRITO</p><h2>Tus páginas</h2></div><span className="count-badge">{history.length}</span></div>
      <label className="field"><span>Buscar en tu diario</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Una palabra, una idea o una fecha" /></label>
      {history.length === 0 ? <div className="journal-empty"><span aria-hidden="true">✳</span><h3>{search ? 'No encontramos esa palabra.' : 'Tu primera página puede empezar hoy.'}</h3><p>{search ? 'Probá con otra palabra o limpiá la búsqueda.' : 'Lo que escribas va a aparecer acá, para volver cuando quieras.'}</p></div>
        : <div className="journal-history-list">{history.map(([date, item]) => <button type="button" key={date} className={date === selected ? 'active' : ''} onClick={() => onDateChange(date)}>
          <strong>{dateLabel(date)}</strong>{item.mood && <span className="journal-mood-label">{item.mood}</span>}
          <p>{(item.intention || item.gratitude || item.smallStep || item.win || item.learned || item.letGo || item.freeText || 'Un registro de cómo me sentí.').slice(0, 135)}</p>
          <span className="journal-history-open">Abrir esta página ↗</span></button>)}</div>}
    </aside></div>
    <p className="source-note journal-books-note">Biblioteca de inspiración: {books.map(book => `${book.title}, de ${book.author}`).join(' · ')}. Ideas para reflexionar, con redacción original, que podés adaptar a tus horarios y a tu descanso.</p>
  </div>;
}

export function HabitsView({ selected, habits, setHabits, checks, setChecks }: HabitsViewProps) {
  const access=useDateAccess(selected);
  const lockReason=access.kind==='past'?'Este día ya terminó. Sus hábitos quedan guardados para consultar.':'Podés explorar los hábitos; las marcas se habilitan cuando llegue esa fecha.';
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [cue, setCue] = useState('');
  const [tinyStep, setTinyStep] = useState('');
  const [error, setError] = useState('');
  const habitList = Object.values(habits ?? {});
  const practiced = habitList.filter(habit => checks[`${selected}:${habit.id}`]).length;

  function createHabit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !cue.trim() || !tinyStep.trim()) { setError('Completá el nombre, la señal y el paso pequeño para guardar tu hábito.'); return; }
    const habit: Habit = { id: `habit-${crypto.randomUUID()}`, name: name.trim(), cue: cue.trim(), tinyStep: tinyStep.trim() };
    setHabits(current => ({ ...current, [habit.id]: habit }));
    setName(''); setCue(''); setTinyStep(''); setError(''); setShowForm(false);
  }
  function removeHabit(habit: Habit) {
    // A definition with dated marks must remain available to read those dates.
    if(Object.keys(checks).some(key=>key.endsWith(`:${habit.id}`)&&!getDateAccess(key.slice(0,10)).canExecute)){
      setError('Este hábito tiene registros de otras fechas. Lo conservamos para que puedas seguir consultando esos días sin cambiarlos.');
      return;
    }
    if (!window.confirm(`¿Eliminar el hábito «${habit.name}» y sus marcas guardadas?`)) return;
    if(Object.keys(checks).some(key=>key.endsWith(`:${habit.id}`)&&!getDateAccess(key.slice(0,10)).canExecute))return;
    setHabits(current => { const next = { ...current }; delete next[habit.id]; return next; });
    setChecks(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(`:${habit.id}`))));
  }

  return <div className="habits-view"><div className="page-title"><div><p className="eyebrow">PEQUEÑO, POSIBLE, TUYO</p><h1>Volver a lo que te hace bien<span>.</span></h1><p className="subtitle">Una señal clara. Un paso que entre en tu día. Otra oportunidad cada vez.</p></div>
    <button type="button" className="button primary" onClick={() => setShowForm(value => !value)}>{showForm ? 'Cerrar formulario' : '+ Crear un hábito'}</button></div>
    <div className="habits-intro"><span aria-hidden="true">✳</span><div><h2>Hacelo fácil para poder volver.</h2><p>Elegí algo que ya suceda como señal y una versión de hasta dos minutos para empezar. Si un día no sale, podés retomar en la próxima oportunidad.</p></div></div>
    <div className="habits-date"><div><p className="eyebrow">{access.canExecute?'ESTÁS REGISTRANDO':'ESTÁS CONSULTANDO'}</p><strong>{dateLabel(selected)}</strong></div><span className="count-badge">{practiced} de {habitList.length} practicados</span></div>
    {!access.canExecute&&<p className="journal-date-lock" role="status"><span aria-hidden="true">◷</span>{lockReason}</p>}
    {error&&!showForm&&<p className="habit-form-error" role="status">{error}</p>}
    {showForm && <form className="panel habit-form" onSubmit={createHabit}><div className="section-title"><div><p className="eyebrow">DISEÑÁ UN COMIENZO AMABLE</p><h2>Tu próximo hábito</h2></div></div>
      <label className="field"><span>¿Qué querés cultivar?</span><input value={name} maxLength={100} required onChange={event => setName(event.target.value)} placeholder="Ej. Leer un poco" /></label>
      <div className="form-grid"><label className="field"><span>Mi señal: cuando...</span><input value={cue} maxLength={180} required onChange={event => setCue(event.target.value)} placeholder="Ej. termino de preparar el mate" /><small>Algo concreto que ya forme parte de tu día. Esta señal es tu recordatorio.</small></label>
        <label className="field"><span>Mi versión de hasta 2 minutos</span><input value={tinyStep} maxLength={180} required onChange={event => setTinyStep(event.target.value)} placeholder="Ej. abro el libro y leo una página" /><small>Un comienzo sencillo que puedas hacer incluso en un día lleno.</small></label></div>
      {error && <p className="habit-form-error" role="alert">{error}</p>}
      <button className="button primary" type="submit">Guardar mi hábito</button>
    </form>}
    {habitList.length === 0 ? <section className="panel journal-empty habit-empty"><span aria-hidden="true">✳</span><h2>¿Qué te gustaría hacer un poquito más seguido?</h2><p>Empezá con uno. Tu lista se arma con lo que vos elijas.</p><button type="button" className="button secondary" onClick={() => setShowForm(true)}>Crear mi primer hábito</button></section>
      : <div className="habits-grid">{habitList.map(habit => { const key = `${selected}:${habit.id}`; const checked = Boolean(checks[key]); return <section key={habit.id} className={`panel habit-card ${checked ? 'practiced' : ''}`}>
        <div className="habit-card-top"><span className="eyebrow">UNA PEQUEÑA PRÁCTICA</span><button type="button" className="text-button" onClick={() => removeHabit(habit)} aria-label={`Eliminar hábito ${habit.name}`}>Eliminar</button></div>
        <h2>{habit.name}</h2><div className="habit-signal"><small>CUANDO...</small><p>{habit.cue}</p></div><div className="habit-minimum"><small>MI COMIENZO DE 2 MINUTOS</small><p>{habit.tinyStep}</p></div>
        <button type="button" aria-pressed={checked} className={`button ${checked ? 'lime' : 'secondary'} habit-check`} disabled={!access.canExecute} title={!access.canExecute?lockReason:undefined} onClick={() => {if(!getDateAccess(selected).canExecute)return;setChecks(current => getDateAccess(selected).canExecute?({ ...current, [key]: !current[key] }):current);}}><span className="habit-check-dot" aria-hidden="true">{checked ? '✓' : '○'}</span>{checked ? 'Lo practiqué en esta fecha' : 'Marcar que lo practiqué'}</button>
        <p className="habit-footer">El paso pequeño ya cuenta. Cada fecha empieza con una nueva oportunidad.</p>
      </section>; })}</div>}
    <p className="source-note">Señales, hábitos encadenados y comienzos pequeños: ideas parafraseadas de <em>Hábitos atómicos</em>, de James Clear. Tus marcas se guardan por fecha; podés cambiar la fecha desde Mi día o Diario.</p>
  </div>;
}
