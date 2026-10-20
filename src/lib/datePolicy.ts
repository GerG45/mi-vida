/** Calendar access uses the device's local date, just like the agenda. */
export type DateAccessKind = 'past' | 'today' | 'future' | 'invalid';
export interface DateAccess {
  date: string;
  today: string;
  kind: DateAccessKind;
  canPlan: boolean;
  canExecute: boolean;
  readOnly: boolean;
}

export function localDateKey(now: Date | number = Date.now()): string {
  const value = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(value.getTime())) return '';
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Future dates allow preparation; only today allows recording what actually happened. */
export function getDateAccess(date: string, now: Date | number = Date.now()): DateAccess {
  const today = localDateKey(now);
  const kind: DateAccessKind = !validDate(date) || !validDate(today) ? 'invalid' : date === today ? 'today' : date < today ? 'past' : 'future';
  return {date, today, kind, canPlan: kind === 'today' || kind === 'future', canExecute: kind === 'today', readOnly: kind === 'past' || kind === 'invalid'};
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const datedKey = (key: string): string => /^\d{4}-\d{2}-\d{2}:.+$/.test(key) ? key.slice(0, 10) : '';

/**
 * This is the local-write boundary, independent of selected tabs or stale UI callbacks.
 * Cloud hydration and explicit backup restoration keep legitimate historical records.
 * Definitions (GTD, routines, settings, recurring events) remain global.
 */
export function canMutateDateSection(section: string, key: string, before: unknown, after: unknown, now: Date | number = Date.now()): boolean {
  const access = (date: unknown): DateAccess => getDateAccess(typeof date === 'string' ? date : '', now);
  if (section === 'calendarEvents' || section === 'calendarLinks') {
    return [before, after].every(value => value === undefined || (object(value) && access(value.date).canPlan));
  }
  if (section === 'done' || section === 'habitChecks') return access(datedKey(key)).canExecute;
  if (section === 'journal') return access(key).canExecute;
  if (section === 'overrides') return access(key).canPlan;
  if (section === 'extras') {
    // Check both sides: changing a date or making an old event recurring cannot unlock it.
    return [before, after].every(value => value === undefined || (object(value) && (value.date === undefined || access(value.date).canPlan)));
  }
  if (section === 'gymSessions') {
    return [before, after].every(value => value === undefined || (object(value) && access(value.date).canExecute));
  }
  if (section === 'workItems') {
    if (![before, after].every(value => value === undefined || (object(value) && access(value.date).canPlan))) return false;
    if (!object(after) || access(after.date).canExecute) return true;
    // New future tasks contain only a plan. Existing plans may keep untouched legacy
    // execution fields, but checking, resetting, timing, or moving actual work ahead is blocked.
    const previous = object(before) ? before : undefined;
    if (!previous || previous.date !== after.date) {
      return after.done === false && after.completedAt === null && after.elapsedSeconds === 0 && after.timerStartedAt === null;
    }
    return ['done', 'completedAt', 'elapsedSeconds', 'timerStartedAt', 'createdAt'].every(field => Object.is(previous[field], after[field]));
  }
  return true;
}
