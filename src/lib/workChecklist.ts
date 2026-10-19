/** A dated checklist belongs to one logical work period; its timer records time, never estimates it. */
export interface WorkItem {
  id: string;
  date: string;
  blockId: string;
  title: string;
  done: boolean;
  estimatedMinutes: number | null;
  createdAt: number;
  completedAt: number | null;
  order: number;
  elapsedSeconds: number;
  timerStartedAt: number | null;
}
export type WorkItems = Record<string, WorkItem>;
export interface WorkChecklistSummary {
  total: number;
  completed: number;
  estimatedMinutes: number;
  elapsedSeconds: number;
  activeItemId: string | null;
}

const MAX_SECONDS = 31_536_000;
const fields = ['id','date','blockId','title','done','estimatedMinutes','createdAt','completedAt','order','elapsedSeconds','timerStartedAt'];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const timestamp = (value: unknown): value is number => integer(value,0,8_640_000_000_000_000);
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(value) && !['__proto__','prototype','constructor'].includes(value);
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}

/** Reject unknown/unsafe fields before a record reaches local storage, a backup, or Firebase. */
export function normalizeWorkItem(value: unknown, key?: string): WorkItem | undefined {
  if (!object(value) || !Object.keys(value).every(field => fields.includes(field))) return;
  if (!safeId(value.id) || (key !== undefined && value.id !== key) || !validDate(value.date) || !safeId(value.blockId)) return;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 300 || typeof value.done !== 'boolean') return;
  if (value.estimatedMinutes !== null && !integer(value.estimatedMinutes,1,1440)) return;
  if (!timestamp(value.createdAt) || (value.completedAt !== null && !timestamp(value.completedAt)) || !integer(value.order,0,1_000_000)) return;
  if (!integer(value.elapsedSeconds,0,MAX_SECONDS) || (value.timerStartedAt !== null && !timestamp(value.timerStartedAt))) return;
  if (value.done !== (value.completedAt !== null) || (value.done && value.timerStartedAt !== null)) return;
  if (value.completedAt !== null && value.completedAt < value.createdAt) return;
  if (value.timerStartedAt !== null && value.timerStartedAt < value.createdAt) return;
  return {...value} as unknown as WorkItem;
}

export function createWorkItem(options: {
  id: string; date: string; blockId: string; title: string;
  estimatedMinutes?: number | null; order?: number; now?: number;
}): WorkItem {
  const item: WorkItem = {
    id: options.id, date: options.date, blockId: getWorkChecklistBlockId({id:options.blockId}), title: options.title.trim(),
    done: false, estimatedMinutes: options.estimatedMinutes ?? null, createdAt: options.now ?? Date.now(),
    completedAt: null, order: options.order ?? 0, elapsedSeconds: 0, timerStartedAt: null,
  };
  const normalized = normalizeWorkItem(item,item.id);
  if (!normalized) throw new Error('La tarea de trabajo no es válida.');
  return normalized;
}

/** Rehearsals use the work color but have their own schedule, rather than a project checklist. */
export function isWorkChecklistEvent(event: {kind: string; id: string}): boolean {
  return event.kind === 'work' && !['monday-rehearsal','saturday-rehearsal'].includes(event.id);
}

/** Planner splits/reindexes free work time; the day's logical work list keeps its identity. */
export function getWorkChecklistBlockId(event: {id: string}): string {
  if (/^flex-work-\d+$/.test(event.id)) return 'flex-work';
  if (/^cordoba-work(?:-am|-pm)?$/.test(event.id)) return 'cordoba-work';
  return event.id;
}

export function getWorkItemsForBlock(items: WorkItems, date: string, blockId: string): WorkItem[] {
  const logicalBlockId = getWorkChecklistBlockId({id:blockId});
  return Object.values(items).filter(item => item.date === date && getWorkChecklistBlockId({id:item.blockId}) === logicalBlockId)
    .sort((a,b) => a.order-b.order || a.createdAt-b.createdAt || a.id.localeCompare(b.id));
}

/** Absolute timestamps make a running timer survive a reload or a suspended mobile app. */
export function getWorkItemElapsed(item: WorkItem, now = Date.now()): number {
  const endOfDay=new Date(`${item.date}T00:00:00`);endOfDay.setDate(endOfDay.getDate()+1);
  const effectiveNow=Number.isFinite(endOfDay.getTime())?Math.min(now,endOfDay.getTime()):now;
  const additional = item.timerStartedAt !== null && Number.isFinite(effectiveNow)
    ? Math.floor(Math.max(0,effectiveNow-item.timerStartedAt)/1000) : 0;
  return Math.min(MAX_SECONDS,item.elapsedSeconds+additional);
}

export function pauseWorkItem(item: WorkItem, now = Date.now()): WorkItem {
  return item.timerStartedAt === null ? item : {...item,elapsedSeconds:getWorkItemElapsed(item,now),timerStartedAt:null};
}

export function startWorkItem(item: WorkItem, now = Date.now()): WorkItem {
  if (item.done || item.timerStartedAt !== null || !timestamp(now)) return item;
  return {...item,timerStartedAt:Math.max(item.createdAt,now)};
}

/** Only an explicit start creates tracked time; checking a task never invents time worked. */
export function toggleWorkItem(item: WorkItem, now = Date.now()): WorkItem {
  if (item.done) return {...item,done:false,completedAt:null};
  if (!timestamp(now)) return item;
  return {...pauseWorkItem(item,now),done:true,completedAt:Math.max(item.createdAt,now)};
}

/** Switch timers within the same day without writing into another date's locked records. */
export function startWorkItemTimer(items: WorkItems, id: string, now = Date.now()): WorkItems {
  const target = items[id];
  if (!target || target.done || !timestamp(now)) return items;
  let changed = false;
  const next: WorkItems = {};
  for (const [key,item] of Object.entries(items)) {
    const updated = key === id ? startWorkItem(item,now) : item.date===target.date?pauseWorkItem(item,now):item;
    next[key] = updated;
    if (updated !== item) changed = true;
  }
  return changed ? next : items;
}

export function getWorkChecklistSummary(items: WorkItems, date?: string, blockId?: string, now = Date.now()): WorkChecklistSummary {
  const selected = Object.values(items).filter(item => (date === undefined || item.date === date) && (blockId === undefined || getWorkChecklistBlockId({id:item.blockId}) === getWorkChecklistBlockId({id:blockId})));
  const running = selected.filter(item => item.timerStartedAt !== null)
    .sort((a,b) => (b.timerStartedAt ?? 0)-(a.timerStartedAt ?? 0) || a.id.localeCompare(b.id));
  return {
    total: selected.length,
    completed: selected.filter(item => item.done).length,
    estimatedMinutes: selected.reduce((total,item) => total+(item.estimatedMinutes ?? 0),0),
    elapsedSeconds: selected.reduce((total,item) => total+getWorkItemElapsed(item,now),0),
    activeItemId: running[0]?.id ?? null,
  };
}
