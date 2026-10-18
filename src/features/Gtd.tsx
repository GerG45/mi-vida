import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { addDays, isoDate } from '../lib/planner';
import './gtd.css';

export type GtdTask = {
  id: string;
  title: string;
  notes: string;
  status: 'inbox' | 'next' | 'waiting' | 'someday' | 'reference' | 'done' | 'trash';
  context: string;
  minutes: number;
  energy: 'low' | 'medium' | 'high';
  projectId: string;
  waitingFor: string;
  due: string;
  createdAt: string;
  updatedAt: string;
};

export type GtdProject = { id: string; title: string; outcome: string; archived: boolean };
export type GtdViewProps = {
  tasks: Record<string, GtdTask>;
  setTasks: Dispatch<SetStateAction<Record<string, GtdTask>>>;
  projects: Record<string, GtdProject>;
  setProjects: Dispatch<SetStateAction<Record<string, GtdProject>>>;
  review: Record<string, boolean>;
  setReview: Dispatch<SetStateAction<Record<string, boolean>>>;
  onSchedule: (task: GtdTask) => void;
};

type View = GtdTask['status'] | 'projects' | 'review';
type IconName = 'inbox' | 'next' | 'waiting' | 'project' | 'review' | 'plus' | 'check' | 'close' | 'edit' | 'calendar' | 'arrow' | 'restore' | 'search' | 'leaf';
const labels: Record<GtdTask['status'], string> = { inbox: 'Entrada', next: 'Próximas acciones', waiting: 'En espera', someday: 'Algún día', reference: 'Referencia', done: 'Hecho', trash: 'Papelera' };
const descriptions: Record<GtdTask['status'], string> = {
  inbox: 'Revisá cada captura y decidí qué significa para vos.',
  next: 'Acciones concretas que podés hacer cuando tengas el contexto, el tiempo y la energía.',
  waiting: 'Lo que depende de otra persona, con una fecha para volver a mirarlo.',
  someday: 'Ideas que querés conservar sin comprometerte ahora.',
  reference: 'Información para consultar cuando la necesites.',
  done: 'Lo que ya terminaste. Podés recuperar cualquier acción.',
  trash: 'Lo que decidiste soltar. Todo se puede recuperar.',
};
const energies = { low: 'Baja', medium: 'Media', high: 'Alta' };
const energyRank = { low: 1, medium: 2, high: 3 };
const contextSuggestions = ['@Casa', '@Computadora', '@Teléfono', '@Fuera', '@Estudio'];
const reviewSteps = [
  { id: 'capture', title: 'Reunir lo que quedó suelto', detail: 'Anotá ideas, mensajes, papeles y asuntos que todavía te ocupan la cabeza.' },
  { id: 'inbox', title: 'Aclarar la entrada', detail: 'Decidí la próxima acción, la espera o el destino de cada captura.' },
  { id: 'calendar', title: 'Mirar el calendario', detail: 'Revisá lo que pasó y lo que viene. Capturá preparativos y compromisos pendientes.' },
  { id: 'waiting', title: 'Revisar lo que esperás', detail: 'Actualizá respuestas, personas y fechas de seguimiento.' },
  { id: 'projects', title: 'Revisar proyectos y acciones', detail: 'Chequeá el resultado que buscás y qué acción concreta hace avanzar cada proyecto.' },
  { id: 'someday', title: 'Volver a mirar algún día', detail: 'Activá lo que tenga sentido ahora y soltá lo que ya no quieras conservar.' },
] as const;

function Glyph({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    inbox: <><path d="M4 4h16l2 12v4H2v-4L4 4Z"/><path d="M3 14h5l2 3h4l2-3h5"/></>,
    next: <><circle cx="12" cy="12" r="9"/><path d="m10 8 5 4-5 4"/></>,
    waiting: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    project: <><path d="M3 6h7l2 3h9v11H3zM3 6V3h7l2 3h9v3"/></>,
    review: <><path d="M5 5h14v16H5zM9 3h6v4H9zM8 12l2 2 5-4m-7 8h8"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
    edit: <><path d="m4 16-1 5 5-1L21 7l-4-4zM14 6l4 4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m3 0h1m3 0h1"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>, restore: <><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    leaf: <><path d="M20 3C8 2 2 9 6 16s16 3 14-13Z"/><path d="M4 21 15 9"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function uid() { return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
function taskTemplate(projectId = '', status: GtdTask['status'] = 'inbox'): GtdTask {
  const now = new Date().toISOString();
  return { id: uid(), title: '', notes: '', status, context: '', minutes: 15, energy: 'medium', projectId, waitingFor: '', due: '', createdAt: now, updatedAt: now };
}
function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
function minutesValue(value: number) { return Number.isFinite(value) ? Math.max(1, Math.min(1440, Math.round(value))) : 15; }
function validDue(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function lengthError(fields: { label: string; value: string; max: number }[]) {
  const invalid = fields.find(field => field.value.length > field.max);
  return invalid ? `${invalid.label}: usá hasta ${invalid.max.toLocaleString('es-AR')} caracteres. El texto sigue acá para que puedas ajustarlo.` : '';
}

function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (dialogRef.current?.querySelector<HTMLElement>('input, textarea, select') || dialogRef.current?.querySelector<HTMLElement>('button'))?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [])].filter(el => el.getClientRects().length);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop gtd-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal gtd-modal" role="dialog" aria-modal="true" aria-labelledby="gtd-dialog-title" ref={dialogRef}><button className="icon-button modal-close" aria-label="Cerrar" onClick={close}><Glyph name="close"/></button><h2 id="gtd-dialog-title">{title}</h2>{children}</div></div>;
}

export function GtdView({ tasks, setTasks, projects, setProjects, review, setReview, onSchedule }: GtdViewProps) {
  const [view, setView] = useState<View>('inbox');
  const [capture, setCapture] = useState('');
  const [search, setSearch] = useState('');
  const [context, setContext] = useState('');
  const [time, setTime] = useState('');
  const [energy, setEnergy] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [draft, setDraft] = useState<GtdTask | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineOutcome, setInlineOutcome] = useState('');
  const [projectDraft, setProjectDraft] = useState<GtdProject | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formError, setFormError] = useState('');
  const [projectError, setProjectError] = useState('');
  const [notice, setNoticeText] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const list = useMemo(() => Object.values(tasks || {}).filter(t => t && typeof t.title === 'string'), [tasks]);
  const allProjects = useMemo(() => Object.values(projects || {}).filter(p => p && typeof p.title === 'string'), [projects]);
  const activeProjects = allProjects.filter(p => !p.archived);
  const counts = Object.fromEntries(Object.keys(labels).map(status => [status, list.filter(t => t.status === status).length])) as Record<GtdTask['status'], number>;
  const today = isoDate(new Date());
  const monday = addDays(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const completedReviewKeys = Object.keys(review || {}).filter(key => review[key] && /:completed:\d+$/.test(key)).sort((a, b) => Number(b.split(':').at(-1)) - Number(a.split(':').at(-1)));
  const currentCompletion = completedReviewKeys.find(key => key.startsWith(`${monday}:completed:`));
  const lastCompletion = completedReviewKeys[0];
  const reviewCount = reviewSteps.filter(step => review?.[`${monday}:${step.id}`]).length;
  const projectsWithoutNext = activeProjects.filter(p => !list.some(t => t.projectId === p.id && t.status === 'next'));
  const contexts = [...new Set([...contextSuggestions, ...list.map(t => t.context).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es'));
  const shownTasks = list.filter(t => t.status === view)
    .filter(t => !search || `${t.title} ${t.notes} ${t.waitingFor}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .filter(t => view !== 'next' || ((!context || t.context === context) && (!time || minutesValue(t.minutes) <= Number(time)) && (!energy || energyRank[t.energy] <= Number(energy)) && (!projectFilter || t.projectId === projectFilter)))
    .sort((a, b) => view === 'waiting' ? (a.due || '9999').localeCompare(b.due || '9999') : (a.createdAt || '').localeCompare(b.createdAt || ''));

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);

  function setNotice(message: string, error = false) { setNoticeError(error); setNoticeText(message); }

  function captureTask(event: FormEvent) {
    event.preventDefault();
    if (!capture.trim()) return;
    const error = lengthError([{ label: 'La captura', value: capture.trim(), max: 300 }]);
    if (error) { setNotice(error, true); return; }
    const task = { ...taskTemplate(), title: capture.trim() };
    try { setTasks(previous => ({ ...previous, [task.id]: task })); }
    catch { setNotice('No se pudo guardar la captura. El texto sigue en la entrada para volver a intentarlo.', true); return; }
    setCapture(''); document.getElementById('gtd-capture')?.focus(); setNotice('Guardado en Entrada. Podés seguir con lo tuyo.');
  }
  function editTask(task: GtdTask) { setDraft({ ...task }); setNewProject(false); setInlineTitle(''); setInlineOutcome(''); setFormError(''); }
  function updateTask(task: GtdTask, status: GtdTask['status']) {
    try { setTasks(previous => ({ ...previous, [task.id]: { ...(previous[task.id] || task), status, updatedAt: new Date().toISOString() } })); }
    catch { setNotice('No se pudo actualizar la acción. Conservamos su estado anterior.', true); return; }
    setNotice(status === 'done' ? 'Acción terminada.' : status === 'inbox' ? 'Recuperada en Entrada para volver a aclararla.' : `Movida a ${labels[status]}.`);
  }
  function saveTask(status?: GtdTask['status']): GtdTask | null {
    if (!draft) return null;
    const title = draft.title.trim();
    const destination = status || draft.status;
    if (!title) { setFormError('Escribí qué querés guardar o cuál es la acción concreta.'); return null; }
    const textError = lengthError([
      { label: 'El título', value: title, max: 300 }, { label: 'Las notas', value: draft.notes, max: 10000 },
      { label: 'El contexto', value: draft.context, max: 300 }, { label: 'La persona en espera', value: draft.waitingFor, max: 1000 },
    ]);
    if (textError) { setFormError(textError); return null; }
    if (!Number.isFinite(draft.minutes) || draft.minutes < 1 || draft.minutes > 1440) { setFormError('La duración debe ser entre 1 y 1.440 minutos.'); return null; }
    if (draft.due && !validDue(draft.due)) { setFormError('Elegí una fecha válida.'); return null; }
    if (destination === 'waiting' && (!draft.waitingFor.trim() || !draft.due)) { setFormError('Indicá a quién esperás y cuándo vas a revisarlo.'); return null; }
    let projectId = draft.projectId;
    let createdProject: GtdProject | null = null;
    if (newProject && ['inbox', 'next', 'waiting'].includes(destination)) {
      if (!inlineTitle.trim() || !inlineOutcome.trim()) { setFormError('El proyecto necesita un nombre y el resultado que querés conseguir.'); return null; }
      const projectTextError = lengthError([{ label: 'El nombre del proyecto', value: inlineTitle.trim(), max: 300 }, { label: 'El resultado', value: inlineOutcome, max: 10000 }]);
      if (projectTextError) { setFormError(projectTextError); return null; }
      createdProject = { id: uid(), title: inlineTitle.trim(), outcome: inlineOutcome.trim(), archived: false };
      projectId = createdProject.id;
    }
    const task: GtdTask = { ...draft, title, projectId, status: destination, notes: draft.notes.trim(), waitingFor: draft.waitingFor.trim(), context: draft.context.trim(), minutes: minutesValue(draft.minutes), updatedAt: new Date().toISOString() };
    let projectSaved = false;
    try {
      if (createdProject) { const project = createdProject; setProjects(previous => ({ ...previous, [project.id]: project })); projectSaved = true; }
      setTasks(previous => ({ ...previous, [task.id]: task }));
    } catch {
      if (projectSaved) { setDraft({ ...draft, projectId }); setNewProject(false); }
      setFormError('No se pudo guardar la acción. Conservamos el formulario para que puedas revisar los datos y volver a intentarlo.');
      return null;
    }
    setDraft(null); setNotice(destination === 'done' ? 'Acción terminada.' : 'Guardado. Ya sabés dónde volver a encontrarlo.');
    return task;
  }
  function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!projectDraft?.title.trim() || !projectDraft.outcome.trim()) return;
    const error = lengthError([{ label: 'El nombre del proyecto', value: projectDraft.title.trim(), max: 300 }, { label: 'El resultado', value: projectDraft.outcome, max: 10000 }]);
    if (error) { setProjectError(error); return; }
    const project = { ...projectDraft, title: projectDraft.title.trim(), outcome: projectDraft.outcome.trim() };
    try { setProjects(previous => ({ ...previous, [project.id]: project })); }
    catch { setProjectError('No se pudo guardar el proyecto. El formulario conserva lo que escribiste.'); return; }
    setProjectDraft(null); setProjectError(''); setNotice('Proyecto guardado.');
  }
  function switchView(next: View) { setView(next); setSearch(''); }
  function completeReview() {
    if (reviewCount !== reviewSteps.length) return;
    setReview(previous => {
      const next = Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(`${monday}:completed:`)));
      next[`${monday}:completed:${Date.now()}`] = true; return next;
    });
    setNotice('Revisión semanal terminada.');
  }
  const nav: { view: View; label: string; icon?: IconName; count?: number }[] = [
    { view: 'inbox', label: 'Entrada', icon: 'inbox', count: counts.inbox }, { view: 'next', label: 'Próximas', icon: 'next', count: counts.next },
    { view: 'waiting', label: 'En espera', icon: 'waiting', count: counts.waiting }, { view: 'projects', label: 'Proyectos', icon: 'project', count: activeProjects.length },
    { view: 'review', label: 'Revisión', icon: 'review' }, { view: 'someday', label: 'Algún día' }, { view: 'reference', label: 'Referencia' }, { view: 'done', label: 'Hecho' }, { view: 'trash', label: 'Papelera' },
  ];

  return <div className="gtd-view">
    <div className="page-title"><div><p className="eyebrow">UN LUGAR PARA LO QUE TENÉS EN LA CABEZA</p><h1>Dejá espacio<span>.</span></h1><p className="subtitle">Capturá, aclaralo y elegí tu próximo paso con GTD.</p></div><span className="gtd-method-badge"><Glyph name="leaf"/>Getting Things Done®</span></div>
    <section className="gtd-capture-card" aria-labelledby="gtd-capture-title"><div className="gtd-capture-copy"><span className="gtd-step-label">01 / CAPTURAR</span><h2 id="gtd-capture-title">Sacalo de tu cabeza.</h2><p>Una idea, algo pendiente, eso que no querés olvidarte.</p></div><form onSubmit={captureTask} className="gtd-capture-form"><label className="gtd-sr-only" htmlFor="gtd-capture">¿Qué tenés en mente?</label><input id="gtd-capture" value={capture} onChange={e => setCapture(e.target.value)} placeholder="¿Qué tenés en mente?" autoComplete="off" maxLength={300}/><button className="button primary" disabled={!capture.trim()} type="submit"><Glyph name="plus"/>Capturar</button></form><div className="gtd-capture-foot"><span>{counts.inbox ? `${counts.inbox} ${counts.inbox === 1 ? 'entrada por aclarar' : 'entradas por aclarar'}` : 'Tu entrada está despejada'}</span><span>Primero anotalo. Después decidís.</span></div></section>
    <nav className="gtd-tabs" aria-label="Listas GTD">{nav.map(item => <button key={item.view} className={view === item.view ? 'active' : ''} onClick={() => switchView(item.view)} aria-current={view === item.view ? 'page' : undefined}>{item.icon && <Glyph name={item.icon} size={16}/>}<span>{item.label}</span>{item.count !== undefined && <b>{item.count}</b>}</button>)}</nav>

    {view !== 'projects' && view !== 'review' && <section className="panel gtd-list-panel"><div className="gtd-list-heading"><div><p className="eyebrow">{view === 'inbox' ? '02 / ACLARAR' : view === 'next' ? '05 / HACER' : '03 / ORGANIZAR'}</p><h2>{labels[view]}</h2><p>{descriptions[view]}</p></div>{view === 'next' && <button className="button secondary" onClick={() => editTask(taskTemplate('', 'next'))}><Glyph name="plus" size={16}/>Nueva acción</button>}</div>
      <div className="gtd-search"><Glyph name="search" size={16}/><input aria-label={`Buscar en ${labels[view]}`} placeholder="Buscar en esta lista" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {view === 'next' && <><div className="gtd-filters"><label className="field"><span>¿Dónde / con qué?</span><select value={context} onChange={e => setContext(e.target.value)}><option value="">Todos los contextos</option>{contexts.map(c => <option key={c}>{c}</option>)}</select></label><label className="field"><span>Tiempo disponible</span><select value={time} onChange={e => setTime(e.target.value)}><option value="">Sin límite</option>{[2, 5, 15, 30, 60, 120].map(n => <option key={n} value={n}>Hasta {n} min</option>)}</select></label><label className="field"><span>Energía disponible</span><select value={energy} onChange={e => setEnergy(e.target.value)}><option value="">Cualquier energía</option><option value="1">Baja</option><option value="2">Media</option><option value="3">Alta</option></select></label><label className="field"><span>Proyecto</span><select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}><option value="">Todos los proyectos</option>{allProjects.map(p => <option key={p.id} value={p.id}>{p.title}{p.archived ? ' · archivado' : ''}</option>)}</select></label></div><p className="gtd-choice-note">Entre lo que podés hacer ahora, elegí lo que más importa para vos.</p></>}
      <div className="gtd-task-list">{shownTasks.map(task => <article key={task.id} className={`gtd-task gtd-status-${task.status}`}>
        {(task.status === 'next' || task.status === 'done') && <button className={`gtd-complete ${task.status === 'done' ? 'checked' : ''}`} aria-label={task.status === 'done' ? `Volver a próximas acciones: ${task.title}` : `Marcar hecha: ${task.title}`} onClick={() => updateTask(task, task.status === 'done' ? 'next' : 'done')}>{task.status === 'done' && <Glyph name="check" size={14}/>}</button>}
        <div className="gtd-task-copy"><h3>{task.title}</h3>{task.notes && <p>{task.notes}</p>}<div className="gtd-task-meta">{task.status === 'next' && <><span>{task.context || 'Sin contexto'}</span><span>{minutesValue(task.minutes)} min</span><span>Energía {energies[task.energy]?.toLowerCase() || 'media'}</span></>}{task.projectId && projects[task.projectId] && <span className="gtd-project-tag"><Glyph name="project" size={12}/>{projects[task.projectId].title}</span>}{task.status === 'waiting' && <span>Esperando a {task.waitingFor || 'definir persona'}</span>}{task.due && <span className={task.due < today && task.status !== 'done' && task.status !== 'trash' ? 'gtd-overdue' : ''}><Glyph name="calendar" size={12}/>{task.status === 'waiting' ? 'Revisar' : 'Fecha límite'} {dateLabel(task.due)}</span>}</div></div>
        <div className="gtd-task-actions">{task.status === 'inbox' ? <button className="button secondary" onClick={() => editTask(task)}>Aclarar<Glyph name="arrow" size={14}/></button> : <>{task.status === 'trash' || task.status === 'done' ? <button className="text-button" onClick={() => updateTask(task, 'inbox')}><Glyph name="restore" size={15}/>Recuperar</button> : task.status === 'next' && <button className="gtd-small-action" onClick={() => onSchedule(task)}><Glyph name="calendar" size={15}/><span>Elegir fecha y hora</span></button>}<button className="icon-button gtd-edit" aria-label={`Editar ${task.title}`} onClick={() => editTask(task)}><Glyph name="edit" size={16}/></button></>}</div>
      </article>)}</div>
      {!shownTasks.length && <div className="gtd-empty"><span><Glyph name={view === 'inbox' ? 'inbox' : view === 'waiting' ? 'waiting' : 'leaf'} size={30}/></span><h3>{search || (view === 'next' && (context || time || energy || projectFilter)) ? 'No hay acciones con esos filtros' : view === 'inbox' ? 'Por acá, todo despejado.' : 'Esta lista tiene espacio.'}</h3><p>{search || (view === 'next' && (context || time || energy || projectFilter)) ? 'Probá otro contexto, más tiempo o quitá algún filtro.' : view === 'inbox' ? 'Capturá lo que aparezca. Lo vas a aclarar cuando vuelvas.' : 'Lo que guardes en esta categoría va a aparecer acá.'}</p>{view === 'next' && (context || time || energy || projectFilter || search) && <button className="text-button" onClick={() => { setContext(''); setTime(''); setEnergy(''); setProjectFilter(''); setSearch(''); }}>Quitar filtros</button>}</div>}
      {view === 'next' && <div className="gtd-calendar-note"><Glyph name="calendar"/><p>El calendario es para compromisos con fecha y hora. Elegí cuándo agendar una acción; esta lista queda disponible para tus ratos libres.</p></div>}
    </section>}

    {view === 'projects' && <section className="panel gtd-projects-panel"><div className="gtd-list-heading"><div><p className="eyebrow">03 / ORGANIZAR</p><h2>Resultados que querés conseguir</h2><p>Si requiere varias acciones, dale un proyecto y un resultado claro.</p></div><button className="button secondary" onClick={() => setProjectDraft({ id: uid(), title: '', outcome: '', archived: false })}><Glyph name="plus" size={16}/>Nuevo proyecto</button></div><label className="toggleline"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/><span>Mostrar proyectos archivados</span></label><div className="gtd-project-grid">{allProjects.filter(p => showArchived || !p.archived).map(project => {
      const nextCount = list.filter(t => t.projectId === project.id && t.status === 'next').length;
      const waitingCount = list.filter(t => t.projectId === project.id && t.status === 'waiting').length;
      return <article className={`gtd-project ${project.archived ? 'archived' : ''}`} key={project.id}><div className="gtd-project-top"><span><Glyph name="project" size={21}/></span><button className="icon-button" aria-label={`Editar proyecto ${project.title}`} onClick={() => setProjectDraft({ ...project })}><Glyph name="edit" size={16}/></button></div><h3>{project.title}</h3><p>{project.outcome}</p><div className="gtd-project-meta"><span className={!nextCount && !project.archived ? 'needs-next' : ''}>{project.archived ? 'Archivado' : nextCount ? `${nextCount} ${nextCount === 1 ? 'próxima acción' : 'próximas acciones'}` : 'Sin próxima acción'}</span>{waitingCount > 0 && <span>{waitingCount} en espera</span>}</div><div className="gtd-project-actions"><button className="text-button" onClick={() => editTask(taskTemplate(project.id, 'next'))}><Glyph name="plus" size={14}/>Definir próxima acción</button><button className="text-button" onClick={() => { setProjectFilter(project.id); setView('next'); setContext(''); setTime(''); setEnergy(''); setSearch(''); }}>Ver acciones<Glyph name="arrow" size={14}/></button></div></article>;
    })}</div>{!allProjects.filter(p => showArchived || !p.archived).length && <div className="gtd-empty"><span><Glyph name="project" size={30}/></span><h3>¿Qué te gustaría ver terminado?</h3><p>Creá un proyecto, escribí el resultado y después definí su próxima acción.</p></div>}</section>}

    {view === 'review' && <section className="gtd-review-layout"><div className="panel gtd-review-panel"><div className="gtd-list-heading"><div><p className="eyebrow">04 / REVISAR</p><h2>Volvé a mirar el conjunto.</h2><p>Revisión de la semana del {dateLabel(monday)}. Tu avance queda guardado.</p></div><span className="gtd-review-counter">{reviewCount}/{reviewSteps.length}</span></div><div className="gtd-review-progress"><span style={{ width: `${reviewCount / reviewSteps.length * 100}%` }}/></div><div className="gtd-review-checklist">{reviewSteps.map((step, index) => <label key={step.id} className={review?.[`${monday}:${step.id}`] ? 'checked' : ''}><input type="checkbox" checked={Boolean(review?.[`${monday}:${step.id}`])} onChange={e => {
      const checked = e.target.checked;
      setReview(previous => { const next = { ...previous, [`${monday}:${step.id}`]: checked }; if (!checked) for (const key of Object.keys(next)) if (key.startsWith(`${monday}:completed:`)) delete next[key]; return next; });
    }}/><span><b><small>0{index + 1}</small>{step.title}</b><p>{step.detail}</p></span></label>)}</div><button className="button primary gtd-review-complete" disabled={reviewCount !== reviewSteps.length} onClick={completeReview}><Glyph name="check"/>{currentCompletion ? 'Actualizar revisión completada' : 'Dar la revisión por terminada'}</button>{currentCompletion && <p className="gtd-review-date">Completada el {new Date(Number(currentCompletion.split(':').at(-1))).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.</p>}{!currentCompletion && lastCompletion && <p className="gtd-review-date">Última revisión completada: {new Date(Number(lastCompletion.split(':').at(-1))).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}</div><aside className="gtd-review-aside"><div className="gtd-review-summary"><Glyph name="leaf" size={31}/><h3>Un sistema en el que podés confiar.</h3><p>Actualizá las listas para elegir con tranquilidad qué hacer y qué dejar para después.</p><button onClick={() => switchView('inbox')}><span>Entradas por aclarar</span><strong>{counts.inbox}</strong><Glyph name="arrow" size={15}/></button><button onClick={() => switchView('waiting')}><span>Asuntos en espera</span><strong>{counts.waiting}</strong><Glyph name="arrow" size={15}/></button><button onClick={() => switchView('projects')}><span>Proyectos sin próxima acción</span><strong>{projectsWithoutNext.length}</strong><Glyph name="arrow" size={15}/></button></div><p className="gtd-review-hint">La revisión no completa ni agenda tareas. Vos decidís qué sigue.</p></aside></section>}

    <div className="gtd-method-footer"><span>Capturar <i>→</i> Aclarar <i>→</i> Organizar <i>→</i> Revisar <i>→</i> Hacer</span><p>Basado en <a href="https://gettingthingsdone.com/what-is-gtd/" target="_blank" rel="noreferrer">GTD® de David Allen</a> y sus <a href="https://gettingthingsdone.com/2010/06/you-are-in-control-when-you-can-see-it-all/" target="_blank" rel="noreferrer">criterios para elegir acciones</a>.</p></div>
    {notice && <div className={`gtd-notice${noticeError ? ' error' : ''}`} role={noticeError ? 'alert' : 'status'}><Glyph name={noticeError ? 'close' : 'check'} size={15}/>{notice}</div>}

    {draft && <Dialog title={draft.status === 'inbox' ? 'Dale un próximo paso.' : 'Ajustar este asunto'} close={() => setDraft(null)}><form className="gtd-task-form" onSubmit={event => { event.preventDefault(); saveTask(); }}><p className="gtd-dialog-intro">¿Requiere una acción? Escribí algo concreto que puedas hacer. Si necesita varias, vinculalo a un proyecto.</p><label className="field"><span>{draft.status === 'next' ? 'Próxima acción concreta' : '¿Qué es / cuál es el próximo paso?'}</span><input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Ej.: escribirle a Juan para confirmar el estudio" maxLength={300}/></label><label className="field"><span>¿Dónde lo vas a guardar?</span><select value={draft.status} onChange={e => { setDraft({ ...draft, status: e.target.value as GtdTask['status'] }); setFormError(''); }}>{Object.entries(labels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      {(draft.status === 'next' || draft.status === 'inbox' || draft.status === 'waiting') && <><div className="gtd-form-grid"><label className="field"><span>Contexto / herramienta</span><input list="gtd-contexts" value={draft.context} onChange={e => setDraft({ ...draft, context: e.target.value })} placeholder="Ej.: @Computadora" maxLength={300}/><datalist id="gtd-contexts">{contexts.map(c => <option key={c} value={c}/>)}</datalist></label><label className="field"><span>Duración estimada · min</span><input required type="number" min={1} max={1440} value={draft.minutes} onChange={e => setDraft({ ...draft, minutes: Number(e.target.value) })}/></label><label className="field"><span>Energía que requiere</span><select value={draft.energy} onChange={e => setDraft({ ...draft, energy: e.target.value as GtdTask['energy'] })}>{Object.entries(energies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Proyecto</span><select disabled={newProject} value={draft.projectId} onChange={e => setDraft({ ...draft, projectId: e.target.value })}><option value="">Sin proyecto</option>{allProjects.map(p => <option key={p.id} value={p.id}>{p.title}{p.archived ? ' · archivado' : ''}</option>)}</select></label></div><button type="button" className="text-button" onClick={() => setNewProject(!newProject)}><Glyph name={newProject ? 'close' : 'plus'} size={14}/>{newProject ? 'Cancelar nuevo proyecto' : 'Crear un proyecto para este asunto'}</button>{newProject && <div className="gtd-inline-project"><label className="field"><span>Nombre del proyecto</span><input required value={inlineTitle} onChange={e => setInlineTitle(e.target.value)} placeholder="Ej.: publicar el nuevo sencillo" maxLength={300}/></label><label className="field"><span>¿Qué resultado querés conseguir?</span><input required value={inlineOutcome} onChange={e => setInlineOutcome(e.target.value)} placeholder="Ej.: sencillo publicado en las plataformas" maxLength={10000}/></label></div>}</>}
      {draft.status === 'waiting' && <div className="gtd-form-grid gtd-waiting-fields"><label className="field"><span>¿A quién esperás?</span><input required value={draft.waitingFor} onChange={e => setDraft({ ...draft, waitingFor: e.target.value })} placeholder="Persona o equipo" maxLength={1000}/></label><label className="field"><span>Fecha para revisar</span><input required type="date" value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })}/></label></div>}
      {draft.status !== 'waiting' && <label className="field"><span>Fecha límite real · opcional</span><input type="date" value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })}/><small>Una fecha límite no reserva un horario en tu calendario.</small></label>}
      <label className="field"><span>Notas / información de apoyo</span><textarea rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Detalles, enlaces o lo que necesites tener a mano" maxLength={10000}/></label>
      {(draft.status === 'inbox' || draft.status === 'next') && minutesValue(draft.minutes) <= 2 && <div className="gtd-two-minute"><span><strong>¿Lo hacés en dos minutos?</strong><small>Podés hacerlo ahora y después marcarlo como terminado.</small></span><button type="button" className="button secondary" onClick={() => saveTask('done')}><Glyph name="check" size={15}/>Lo hice</button></div>}
      {formError && <p className="gtd-form-error" role="alert">{formError}</p>}<div className="gtd-dialog-actions"><button className="button secondary" type="button" onClick={() => setDraft(null)}>Cancelar</button><button className="button primary" type="submit">Guardar en {labels[draft.status]}<Glyph name="check" size={16}/></button></div></form></Dialog>}
    {projectDraft && <Dialog title={projects[projectDraft.id] ? 'Ajustar proyecto' : 'Un resultado para avanzar.'} close={() => { setProjectDraft(null); setProjectError(''); }}><form onSubmit={saveProject} onChange={() => projectError && setProjectError('')}><label className="field"><span>Nombre del proyecto</span><input required value={projectDraft.title} onChange={e => setProjectDraft({ ...projectDraft, title: e.target.value })} placeholder="Ej.: terminar el disco" maxLength={300}/></label><label className="field"><span>¿Cómo sabrás que está terminado?</span><textarea required rows={3} value={projectDraft.outcome} onChange={e => setProjectDraft({ ...projectDraft, outcome: e.target.value })} placeholder="Escribí el resultado que querés conseguir" maxLength={10000}/></label><label className="toggleline"><input type="checkbox" checked={projectDraft.archived} onChange={e => setProjectDraft({ ...projectDraft, archived: e.target.checked })}/><span>Archivar este proyecto</span></label><p className="gtd-dialog-intro">Las acciones vinculadas se conservan al archivar. Podés recuperar el proyecto en cualquier momento.</p>{projectError && <p className="gtd-form-error" role="alert">{projectError}</p>}<div className="gtd-dialog-actions"><button type="button" className="button secondary" onClick={() => { setProjectDraft(null); setProjectError(''); }}>Cancelar</button><button type="submit" className="button primary">Guardar proyecto<Glyph name="check" size={16}/></button></div></form></Dialog>}
  </div>;
}

export default GtdView;
