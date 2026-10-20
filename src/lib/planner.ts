import type { CalendarEventOccurrence } from './calendarModel';

export type Settings = {
  childName: string;
  workLocation: string;
  rehearsalName: string;
  rehearsalPlace: string;
  scheduleEnabled: boolean;
  anchorMonday: string;
  familyConfirmed: boolean;
  cordobaConfirmed: boolean;
  cordobaEndConfirmed: boolean;
  recordingConfirmed: boolean;
  recordingCare: 'pending' | 'withMe' | 'covered';
  recordingDay: number;
  preparationConfirmed: boolean;
  breakfastInPreparation: boolean;
  breakfastCreatine: boolean;
  hasBlender: boolean;
  hasHandBlender: boolean;
  homeMapsUrl: string;
  gymMapsUrl: string;
  workMapsUrl: string;
  mondayRehearsalMapsUrl: string;
  preparationMin: number;
  morningBufferMin: number;
  sleepHours: number;
  preferredBedtime: string;
  defaultWake: string;
  schoolStart: string;
  schoolTravelMin: number;
  cordobaArrival: string;
  cordobaWorkMin: number;
  cordobaTravelMin: number;
  cordobaHomeTravelMin: number;
  cordobaBufferMin: number;
  mondayEveningEnabled: boolean;
  mondayEveningName: string;
  mondayEveningStart: string;
  mondayEveningEnd: string;
  mondayEveningTravelMin: number;
  mondaySoloDeparture: string;
  mondaySoloArrival: string;
  mondayReturnCompanion: string;
  mondayReturnTravelConfirmed: boolean;
  recordingStart: string;
  recordingDurationMin: number;
  recordingTravelMin: number;
  gymDays: number[];
  gymDurationMin: number;
  gymTravelMin: number;
  showerMin: number;
  danceTransport: 'pending' | 'me' | 'other';
  danceTravelMin: number;
  cookingWithChild: boolean;
  mealPrepDurationMin: number;
  mealPrepDays: number[];
  mealPrepTuesdayStart: string;
  mealPrepFridayStart: string;
  flexibleWorkMin: number;
  rehearsalTravelMin: number;
};

export type ExtraEvent = {
  id: string;
  title: string;
  date?: string;
  /** JavaScript weekdays: Sunday 0, Monday 1, ... Saturday 6. */
  days?: number[];
  startHHmm: string;
  durationMin: number;
  travelMin: number;
  kind: 'work' | 'personal';
};

export type DayOverride = {
  /** This Monday only: skip the usual office trip, without moving it to another day. */
  skipPewen?: boolean;
  schoolClosed?: boolean;
  care?: 'auto' | 'me' | 'other';
  dropoff?: 'auto' | 'me' | 'other';
  pickup?: 'auto' | 'me' | 'other';
};

export type EventKind = 'school' | 'travel' | 'work' | 'recording' | 'gym' | 'meal' | 'cooking' | 'family' | 'personal' | 'sleep';

export type PlanEvent = {
  id: string;
  title: string;
  start: number;
  end: number;
  kind: EventKind;
  detail: string;
  fixed: boolean;
  tentative: boolean;
  conflict?: boolean;
  /** Imported commitments are managed in their source calendar, never checked off locally. */
  source?: 'google';
  allDay?: boolean;
  /** Informative all-day/transparent imports remain visible without consuming a free slot. */
  busy?: boolean;
};

export type DayPlan = {
  date: string;
  week: 'A' | 'B';
  wakeTime: number;
  /** Clock minutes on the previous evening; formatTime handles midnight. */
  bedtimePrevious: number;
  events: PlanEvent[];
  warnings: string[];
  pending: string[];
  care: string;
};

export const defaults: Settings = {
  childName: 'tu peque',
  workLocation: 'tu destino',
  rehearsalName: 'Ensayo',
  rehearsalPlace: 'Lugar a confirmar',
  scheduleEnabled: false,
  anchorMonday: '2026-10-12',
  familyConfirmed: false,
  cordobaConfirmed: false,
  cordobaEndConfirmed: false,
  recordingConfirmed: false,
  recordingCare: 'pending',
  recordingDay: 3,
  preparationConfirmed: false,
  breakfastInPreparation: true,
  breakfastCreatine: false,
  hasBlender: false,
  hasHandBlender: false,
  homeMapsUrl: '',
  gymMapsUrl: '',
  workMapsUrl: '',
  mondayRehearsalMapsUrl: '',
  preparationMin: 20,
  morningBufferMin: 10,
  sleepHours: 8,
  preferredBedtime: '23:30',
  defaultWake: '08:00',
  schoolStart: '07:45',
  schoolTravelMin: 30,
  cordobaArrival: '09:30',
  cordobaWorkMin: 360,
  cordobaTravelMin: 60,
  cordobaHomeTravelMin: 60,
  cordobaBufferMin: 15,
  mondayEveningEnabled: false,
  mondayEveningName: 'Ensayo',
  mondayEveningStart: '16:30',
  mondayEveningEnd: '20:00',
  mondayEveningTravelMin: 0,
  mondaySoloDeparture: '16:00',
  mondaySoloArrival: '17:00',
  mondayReturnCompanion: 'Compañía a confirmar',
  mondayReturnTravelConfirmed: false,
  recordingStart: '15:00',
  recordingDurationMin: 180,
  recordingTravelMin: 0,
  gymDays: [0, 1, 2, 3, 4, 5, 6],
  gymDurationMin: 75,
  gymTravelMin: 15,
  showerMin: 15,
  danceTransport: 'me',
  danceTravelMin: 30,
  cookingWithChild: false,
  mealPrepDurationMin: 90,
  mealPrepDays: [2, 5],
  mealPrepTuesdayStart: '',
  mealPrepFridayStart: '',
  flexibleWorkMin: 120,
  rehearsalTravelMin: 0,
};

type Range = { start: number; end: number };
const blocksTime = (event: PlanEvent): boolean => event.source !== 'google' || (event.busy !== false && event.allDay !== true);
const MINUTE_DAY = 1440;
const FALLBACK_DATE = '2026-10-19';

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 2200) return false;
  const test = new Date(year, month - 1, day, 12);
  return test.getFullYear() === year && test.getMonth() === month - 1 && test.getDate() === day;
}

function localDate(value: string): Date {
  const [year, month, day] = (validDate(value) ? value : FALLBACK_DATE).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function isoDate(date: Date): string {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return FALLBACK_DATE;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(date: string, days: number): string {
  const result = localDate(date);
  result.setDate(result.getDate() + (Number.isFinite(days) ? Math.trunc(days) : 0));
  return isoDate(result);
}

export function formatTime(minutes: number): string {
  if (!Number.isFinite(minutes)) return '--:--';
  const clock = ((Math.round(minutes) % MINUTE_DAY) + MINUTE_DAY) % MINUTE_DAY;
  return `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
}

function calendarNumber(date: string): number {
  const d = localDate(date);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
}

export function weekForDate(date: string, anchor: string): 'A' | 'B' {
  const anchorDate = localDate(anchor);
  const monday = calendarNumber(isoDate(anchorDate)) - ((anchorDate.getDay() + 6) % 7);
  const offset = Math.floor((calendarNumber(date) - monday) / 7);
  return ((offset % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

function time(value: unknown, fallback: string): number {
  const text = typeof value === 'string' ? value : fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return time(fallback, '08:00');
  return Number(match[1]) * 60 + Number(match[2]);
}

function number(value: unknown, fallback: number, min = 0, max = 1440): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value))) : fallback;
}

function weekdayList(value: unknown, fallback: number[]): number[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is number => Number.isInteger(v) && v >= 0 && v <= 6))] : [...fallback];
}

/** Stored location links are optional and must never introduce active URL schemes. */
export function normalizeMapsUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length > 2000) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password && url.href.length <= 2000 ? url.href : '';
  } catch { return ''; }
}

function normalize(input: Settings): Settings {
  const raw = input && typeof input === 'object' ? input : {} as Settings;
  const s = { ...defaults, ...raw };
  for (const key of ['scheduleEnabled','familyConfirmed','cordobaConfirmed','cordobaEndConfirmed','recordingConfirmed','preparationConfirmed','mondayEveningEnabled','mondayReturnTravelConfirmed'] as const) s[key] = s[key] === true;
  for (const key of ['childName','workLocation','rehearsalName','rehearsalPlace','mondayEveningName','mondayReturnCompanion'] as const) s[key] = typeof s[key] === 'string' ? s[key].slice(0,100) : defaults[key];
  const numeric = [
    'preparationMin', 'morningBufferMin', 'schoolTravelMin', 'cordobaWorkMin', 'cordobaTravelMin',
    'cordobaHomeTravelMin', 'cordobaBufferMin', 'mondayEveningTravelMin', 'recordingDurationMin', 'recordingTravelMin',
    'gymDurationMin', 'gymTravelMin', 'showerMin', 'mealPrepDurationMin', 'flexibleWorkMin', 'rehearsalTravelMin', 'danceTravelMin',
  ] as const;
  for (const key of numeric) s[key] = number(s[key], defaults[key]);
  for (const key of ['breakfastInPreparation', 'breakfastCreatine', 'hasBlender', 'hasHandBlender', 'cookingWithChild'] as const) s[key] = typeof s[key] === 'boolean' ? s[key] : defaults[key];
  for (const key of ['homeMapsUrl','gymMapsUrl','workMapsUrl','mondayRehearsalMapsUrl'] as const) s[key] = normalizeMapsUrl(s[key]);
  s.recordingDay = number(s.recordingDay, defaults.recordingDay, 0, 6);
  s.sleepHours = typeof s.sleepHours === 'number' && Number.isFinite(s.sleepHours) ? Math.min(12, Math.max(4, s.sleepHours)) : defaults.sleepHours;
  s.anchorMonday = validDate(s.anchorMonday) ? s.anchorMonday : defaults.anchorMonday;
  for (const key of ['schoolStart', 'cordobaArrival', 'recordingStart', 'defaultWake', 'preferredBedtime', 'mondayEveningStart', 'mondayEveningEnd', 'mondaySoloDeparture', 'mondaySoloArrival'] as const) s[key] = formatTime(time(s[key], defaults[key]));
  for (const key of ['mealPrepTuesdayStart','mealPrepFridayStart'] as const) s[key] = typeof s[key] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s[key]) ? s[key] : '';
  s.gymDays = weekdayList(s.gymDays, defaults.gymDays);
  s.mealPrepDays = weekdayList(s.mealPrepDays, defaults.mealPrepDays);
  if (!['pending', 'me', 'other'].includes(s.danceTransport)) s.danceTransport = 'pending';
  if (!['pending', 'withMe', 'covered'].includes(s.recordingCare)) s.recordingCare = 'pending';
  return s;
}

function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

function freeRanges(start: number, end: number, busy: Range[]): Range[] {
  const sorted = busy.filter(b => b.end > start && b.start < end).sort((a, b) => a.start - b.start);
  const result: Range[] = [];
  let cursor = start;
  for (const b of sorted) {
    if (b.start > cursor) result.push({ start: cursor, end: Math.min(end, b.start) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= end) break;
  }
  if (cursor < end) result.push({ start: cursor, end });
  return result;
}

/** Finds a whole contiguous opening, preserving the requested duration. */
function findSlot(duration: number, start: number, end: number, preferred: number, busy: Range[]): number | undefined {
  if (duration <= 0 || end <= start) return undefined;
  const candidates = freeRanges(start, end, busy).filter(r => r.end - r.start >= duration)
    .map(r => Math.max(r.start, Math.min(preferred, r.end - duration)));
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
  return candidates[0];
}

/** Imported snapshots never become local extras; identities survive remote title/time changes. */
export function getCalendarBusyEvents(occurrences: Record<string,CalendarEventOccurrence> | CalendarEventOccurrence[], date: string): PlanEvent[] {
  if (!validDate(date) || !occurrences || typeof occurrences !== 'object') return [];
  const seen = new Set<string>();
  return Object.values(occurrences).flatMap(occurrence => {
    if (!occurrence || typeof occurrence !== 'object' || occurrence.date !== date || typeof occurrence.id !== 'string' || !occurrence.id || occurrence.id.length > 500
      || typeof occurrence.title !== 'string' || !occurrence.title.trim() || occurrence.title.length > 300 || typeof occurrence.allDay !== 'boolean' || typeof occurrence.busy !== 'boolean'
      || !Number.isInteger(occurrence.startMin) || !Number.isInteger(occurrence.endMin) || occurrence.startMin < 0 || occurrence.endMin > MINUTE_DAY || occurrence.endMin <= occurrence.startMin
      || (occurrence.allDay && (occurrence.startMin !== 0 || occurrence.endMin !== MINUTE_DAY)) || seen.has(occurrence.id)) return [];
    seen.add(occurrence.id);
    const busy = occurrence.busy && !occurrence.allDay;
    return [{id:`google-${occurrence.id}`,title:occurrence.title,start:occurrence.startMin,end:occurrence.endMin,kind:'personal' as const,
      detail:occurrence.allDay ? 'Google Calendar · Todo el día. Informativo; no bloquea horarios.' : busy ? 'Compromiso de Google Calendar. Se modifica desde su calendario de origen.' : 'Google Calendar · Disponible. No bloquea horarios.',
      fixed:true,tentative:false,source:'google' as const,allDay:occurrence.allDay,busy}];
  }).sort((a,b) => a.start-b.start || a.id.localeCompare(b.id));
}

export function buildDay(dateISO: string, input: Settings, overrides: Record<string, DayOverride> = {}, extras: ExtraEvent[] = [], externalOccurrences: CalendarEventOccurrence[] = []): DayPlan {
  const s = normalize(input);
  const date = validDate(dateISO) ? dateISO : FALLBACK_DATE;
  const personalize = (text: string) => text.replaceAll('[PEQUE]', () => s.childName || 'tu peque').replaceAll('[DESTINO]', () => s.workLocation || 'tu destino').replaceAll('[ENSAYO]', () => s.rehearsalName || 'Ensayo').replaceAll('[LUGAR]', () => s.rehearsalPlace || 'Lugar a confirmar');
  const weekday = localDate(date).getDay();
  if (!s.scheduleEnabled) return {date, week: weekForDate(date,s.anchorMonday),wakeTime: time(s.defaultWake,defaults.defaultWake),bedtimePrevious: ((time(s.defaultWake,defaults.defaultWake)-s.sleepHours*60)%1440+1440)%1440,events:getCalendarBusyEvents(externalOccurrences,date),warnings:[],pending:['Importá tus horarios o activá tu agenda en Ajustes. Los datos de ejemplo todavía no están en uso.'],care:'Completá tu organización familiar para empezar.'};
  const week = weekForDate(date, s.anchorMonday);
  const override = (overrides && typeof overrides === 'object' && overrides[date]) || {};
  const skipPewen = weekday === 1 && override.skipPewen === true;
  const events: PlanEvent[] = getCalendarBusyEvents(externalOccurrences,date);
  const warnings: string[] = [];
  const pending: string[] = [];
  const careWindows: Range[] = [];
  const awayWindows: Range[] = [];
  const allowedDuringCare = new Set<string>();
  const schoolStart = time(s.schoolStart, defaults.schoolStart);
  const isSchoolDay = weekday >= 1 && weekday <= 5;
  const autoDropoff = weekday === 3 || weekday === 5 || (weekday === 1 && week === 'B');
  const autoPickup = weekday === 2 || weekday === 4;
  const chosen = (choice: unknown, automatic: boolean) => choice === 'me' || (choice !== 'other' && automatic);
  const dropoff = isSchoolDay && chosen(override.dropoff, autoDropoff);
  const pickup = isSchoolDay && chosen(override.pickup, autoPickup);
  const schoolClosed = Boolean(override.schoolClosed);

  if (!validDate(dateISO)) warnings.push('La fecha no era válida; se muestra el lunes 19/10/2026 como referencia.');
  if (!s.familyConfirmed) pending.push('Confirmar la alternancia familiar. Los cuidados se muestran como simulación.');
  if (!s.preparationConfirmed) pending.push('Confirmar cuánto tardás en prepararte: el despertar usa una duración de ejemplo.');
  if (weekday === 1 && !skipPewen && !s.cordobaConfirmed) pending.push('Confirmar llegada y viaje a [DESTINO]: se muestran horarios de ejemplo.');
  if (weekday === 1 && !skipPewen && !s.cordobaEndConfirmed) pending.push(s.mondayEveningEnabled
    ? 'Confirmar a qué hora terminás de trabajar en [DESTINO]: la jornada sigue siendo tentativa; el ensayo de la tarde conserva su horario.'
    : 'Confirmar a qué hora terminás en [DESTINO]: trabajo, regreso y huecos posteriores son tentativos.');
  if (weekday === 1 && s.mondayEveningEnabled && !skipPewen && s.mondayEveningTravelMin === 0) pending.push('Confirmar el traslado entre el trabajo y el ensayo del lunes; por ahora no se reserva tiempo de viaje.');
  if (weekday === 1 && s.mondayEveningEnabled && !s.mondayReturnTravelConfirmed) pending.push(`Regreso después del ensayo del lunes: viaje estimado en ${s.cordobaHomeTravelMin} min. Ajustá la duración si cambia.`);
  if (weekday === 1 && !skipPewen && !dropoff) pending.push('Confirmar el viaje desde casa a [DESTINO]; su duración se puede editar por separado.');
  if (weekday === s.recordingDay && !s.recordingConfirmed) pending.push('Confirmar el horario de grabación; el bloque actual es un ejemplo.');
  if (weekday === s.recordingDay && s.recordingTravelMin === 0) pending.push('Confirmar el lugar de grabación y sus traslados; por ahora no se reserva tiempo de viaje.');
  if (weekday === 6 && s.rehearsalTravelMin === 0) pending.push('Completá el traslado al ensayo en [LUGAR]; el ensayo es 16:30–19:00.');

  const tentativePlan = !s.familyConfirmed || (weekday === 1 && !skipPewen && (!s.cordobaConfirmed || !s.cordobaEndConfirmed))
    || (weekday === s.recordingDay && !s.recordingConfirmed);

  const push = (id: string, title: string, start: number, end: number, kind: EventKind, detail: string, fixed = true, tentative = false, careAllowed = false) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    if (start < 0 || end > MINUTE_DAY) warnings.push(`${title}: el horario excede este día; revisá la duración o la hora de inicio.`);
    const boundedStart = Math.max(0, start);
    const boundedEnd = Math.min(MINUTE_DAY, end);
    if (boundedEnd <= boundedStart) return;
    events.push({ id, title, start: boundedStart, end: boundedEnd, kind, detail, fixed, tentative: tentative || (!fixed && tentativePlan) });
    if (careAllowed) allowedDuringCare.add(id);
  };

  if (autoDropoff || dropoff) careWindows.push({ start: 0, end: schoolClosed ? MINUTE_DAY : schoolStart });
  if (autoPickup || pickup) careWindows.push({ start: 13 * 60, end: MINUTE_DAY });
  if (weekday === 6 && week === 'A') careWindows.push({ start: 19 * 60, end: MINUTE_DAY });
  if (weekday === 0 && week === 'A') careWindows.push({ start: 0, end: MINUTE_DAY });
  if (override.care === 'other') careWindows.splice(0);
  if (override.care === 'me') careWindows.splice(0, careWindows.length, {start:0,end:MINUTE_DAY});
  if ((override.dropoff === 'other' || override.pickup === 'other') && override.care !== 'other') pending.push('Otra persona hace el traslado; el cuidado a tu cargo se mantiene. Si también cubre el día, cambialo en la excepción de cuidado.');
  if (schoolClosed && (dropoff || pickup)) pending.push('Jardín cerrado: confirmar entrega y cuidado de [PEQUE]. Se protege el tiempo a tu cargo.');
  if (schoolClosed) warnings.push('El jardín está cerrado hoy: se quitaron sus viajes y las entregas o retiros escolares.');

  const care = careWindows.length === 0 ? 'Sin cuidado de [PEQUE] asignado hoy.'
    : careWindows.some(w => w.start === 0 && w.end === MINUTE_DAY) ? '[PEQUE] está con vos todo el día.'
    : careWindows.map(w => w.start === 0 ? `[PEQUE] con vos hasta las ${formatTime(w.end)}.` : `[PEQUE] con vos desde las ${formatTime(w.start)} y durante la noche.`).join(' ');

  careWindows.forEach((window, index) => push(`care-${index}`, 'Tiempo con [PEQUE]', window.start, window.end, 'family', care, true, !s.familyConfirmed, true));

  if (dropoff && !schoolClosed) {
    push('school-out', 'Salir para el jardín', schoolStart - s.schoolTravelMin, schoolStart, 'travel', `${s.schoolTravelMin} min de Uber; llegar a las ${formatTime(schoolStart)}.`, true, !s.familyConfirmed, true);
    push('school-dropoff', 'Dejar a [PEQUE] en el jardín', schoolStart, schoolStart + 5, 'school', 'Entrada confirmada. El jardín nunca se adelanta para acomodar otro compromiso.', true, !s.familyConfirmed, true);
    if (weekday !== 1 || skipPewen) push('school-back', 'Volver del jardín', schoolStart + 5, schoolStart + 5 + s.schoolTravelMin, 'travel', `${s.schoolTravelMin} min estimados de regreso.`, true, !s.familyConfirmed, true);
  }

  if (pickup && !schoolClosed) {
    push('pickup-out', 'Salir a buscar a [PEQUE]', 780 - s.schoolTravelMin, 780, 'travel', `${s.schoolTravelMin} min de traslado antes del retiro.`, true, !s.familyConfirmed, true);
    push('school-pickup', 'Retirar a [PEQUE] del jardín', 780, 785, 'school', 'Desde el retiro, el resto del día y la noche son con vos.', true, !s.familyConfirmed, true);
    push('pickup-back', 'Volver con [PEQUE]', 785, 785 + s.schoolTravelMin, 'travel', `${s.schoolTravelMin} min de regreso.`, true, !s.familyConfirmed, true);
  }

  let hasOfficeLunch = false;
  if (weekday === 1 && !skipPewen) {
    const arrival = time(s.cordobaArrival, defaults.cordobaArrival);
    const fromSchool = dropoff && !schoolClosed;
    const travel = fromSchool ? s.cordobaTravelMin : s.cordobaHomeTravelMin;
    const departure = fromSchool ? schoolStart + 5 : arrival - travel - s.cordobaBufferMin;
    const actualArrival = departure + travel + s.cordobaBufferMin;
    push('cordoba-out', fromSchool ? 'Viajar del jardín a [DESTINO]' : 'Salir hacia [DESTINO]', departure, departure + travel, 'travel', `${travel} min de viaje ${fromSchool ? 'desde el jardín' : 'desde casa'}.`, true, !s.cordobaConfirmed);
    push('cordoba-buffer', 'Margen de llegada a [DESTINO]', departure + travel, actualArrival, 'travel', `${s.cordobaBufferMin} min para llegar y entrar al trabajo.`, true, !s.cordobaConfirmed);
    if (fromSchool && actualArrival > arrival) warnings.push(`No llegás a [DESTINO] a las ${formatTime(arrival)}: después del jardín de ${formatTime(schoolStart)}, el viaje y el margen te dejan llegar a las ${formatTime(actualArrival)}. La entrada al jardín se mantiene.`);
    const tentative = !s.cordobaConfirmed || !s.cordobaEndConfirmed;
    let end = arrival + s.cordobaWorkMin;
    if (s.cordobaWorkMin >= 60 && arrival < 840 && end >= 750) {
      const lunchStart = Math.max(arrival, Math.min(780, end - 30));
      hasOfficeLunch = true;
      push('cordoba-work-am', 'Trabajar en [DESTINO]', arrival, lunchStart, 'work', 'Fin de jornada pendiente de confirmar.', true, tentative);
      push('meal-lunch-office', 'Almorzar', lunchStart, lunchStart + 30, 'meal', 'Pausa de 30 min reservada dentro de la jornada en [DESTINO].', false, tentative, true);
      push('cordoba-work-pm', 'Trabajar en [DESTINO]', lunchStart + 30, end, 'work', 'Duración de jornada de ejemplo, incluyendo la pausa de almuerzo.', true, tentative);
    } else push('cordoba-work', 'Trabajar en [DESTINO]', arrival, end, 'work', 'Duración de ejemplo hasta confirmar fin de jornada.', true, tentative);
    if (!s.mondayEveningEnabled) push('cordoba-back', 'Volver de [DESTINO]', end, end + s.cordobaHomeTravelMin, 'travel', `${s.cordobaHomeTravelMin} min de regreso; salida pendiente de confirmar.`, true, tentative);
  }

  // The Monday orchestra rehearsal survives an office exception on the same date.
  if (weekday === 1 && s.mondayEveningEnabled) {
    const rehearsalStart = time(s.mondayEveningStart, defaults.mondayEveningStart);
    const rehearsalEnd = time(s.mondayEveningEnd, defaults.mondayEveningEnd);
    const soloDeparture = time(s.mondaySoloDeparture, defaults.mondaySoloDeparture);
    const soloArrival = time(s.mondaySoloArrival, defaults.mondaySoloArrival);
    const attendanceStart = skipPewen ? Math.max(rehearsalStart, soloArrival) : rehearsalStart;
    const rehearsalName = s.mondayEveningName || 'Ensayo';
    if (skipPewen && soloArrival <= soloDeparture) warnings.push(`${rehearsalName}: la llegada del colectivo debe ser posterior a la salida, dentro del lunes.`);
    if (rehearsalEnd <= attendanceStart) warnings.push(`${rehearsalName}: la hora de finalización debe ser posterior al inicio y a tu llegada, dentro del lunes.`);
    else {
      const departure = skipPewen ? soloDeparture : rehearsalStart - s.mondayEveningTravelMin;
      push('monday-rehearsal-out', skipPewen ? `Ir en colectivo al ensayo: ${rehearsalName}` : `Ir al ensayo: ${rehearsalName}`, departure, skipPewen ? soloArrival : rehearsalStart, 'travel', skipPewen ? `Colectivo desde Carlos Paz: salida ${formatTime(soloDeparture)} y llegada acordada ${formatTime(soloArrival)}. Hoy no vas a [DESTINO].` : `${s.mondayEveningTravelMin} min de traslado desde el trabajo configurados.`, true);
      push('monday-rehearsal', rehearsalName, attendanceStart, rehearsalEnd, 'work', skipPewen ? `El ensayo comienza a las ${formatTime(rehearsalStart)}; hoy llegás a las ${formatTime(soloArrival)} por acuerdo y te quedás hasta las ${formatTime(rehearsalEnd)}. No hay jornada en [DESTINO].` : `Ensayo de los lunes, ${formatTime(rehearsalStart)}–${formatTime(rehearsalEnd)}. Permanecés en [DESTINO] hasta terminar.`, true);
      push('cordoba-back', skipPewen ? 'Volver del ensayo' : 'Volver de [DESTINO]', rehearsalEnd, rehearsalEnd + s.cordobaHomeTravelMin, 'travel', `Regreso en auto con ${s.mondayReturnCompanion || 'compañía a confirmar'}, después del ensayo. ${s.cordobaHomeTravelMin} min${s.mondayReturnTravelConfirmed ? ' confirmados' : ' estimados; confirmar duración'}.`, true, !s.mondayReturnTravelConfirmed);
      const awayStart = skipPewen ? soloDeparture : events.find(e => e.id === 'cordoba-out')?.start ?? departure;
      awayWindows.push({start: awayStart, end: rehearsalEnd + s.cordobaHomeTravelMin});
    }
  }

  if (weekday === s.recordingDay) {
    const start = time(s.recordingStart, defaults.recordingStart);
    const end = start + s.recordingDurationMin;
    const covered = s.recordingCare === 'covered' || s.recordingCare === 'withMe';
    const overlapsCare = careWindows.some(w => overlaps(w,{start:start-s.recordingTravelMin,end:end+s.recordingTravelMin}));
    const detail = !overlapsCare ? 'Grabación reservada fuera del tiempo de cuidado familiar.' : s.recordingCare === 'covered' ? 'Cuidado de [PEQUE] cubierto durante este bloque.'
      : s.recordingCare === 'withMe' ? '[PEQUE] va con vos; confirmar condiciones del lugar y traslados.'
      : 'Falta resolver el cuidado de [PEQUE] durante la grabación.';
    push('recording-out', 'Ir a grabar violines', start - s.recordingTravelMin, start, 'travel', `${s.recordingTravelMin} min de viaje configurados.`, true, !s.recordingConfirmed, covered);
    push('recording', 'Grabar violines', start, end, 'recording', detail, true, !s.recordingConfirmed, covered);
    push('recording-back', 'Volver de la grabación', end, end + s.recordingTravelMin, 'travel', `${s.recordingTravelMin} min de regreso configurados.`, true, !s.recordingConfirmed, covered);
    if (!covered && careWindows.some(w => overlaps(w, { start: start - s.recordingTravelMin, end: end + s.recordingTravelMin }))) pending.push('Resolver quién cuida a [PEQUE] durante la grabación.');
  }

  if (weekday === 2 || weekday === 4) {
    if (s.danceTransport === 'me') {
      push('dance-out', 'Llevar a [PEQUE] a danza', 1110 - s.danceTravelMin, 1110, 'travel', `Traslado reservado: ${s.danceTravelMin} min configurados, ajustar según el lugar.`, true, true, true);
      push('dance', 'Danza de [PEQUE]', 18 * 60 + 30, 20 * 60 + 30, 'family', '18:30–20:30. Hoy te encargás de los traslados.', true, !s.familyConfirmed, true);
      push('dance-back', 'Volver de danza con [PEQUE]', 1230, 1230 + s.danceTravelMin, 'travel', `Regreso reservado: ${s.danceTravelMin} min configurados.`, true, true, true);
      pending.push(`Confirmar el tiempo de viaje a danza: se reservaron ${s.danceTravelMin} min de ida y ${s.danceTravelMin} de vuelta.`);
    } else if (s.danceTransport === 'pending') pending.push('Danza 18:30–20:30: falta definir quién traslada a [PEQUE]; no se tomó como compromiso confirmado tuyo.');
  }

  if (weekday === 6) {
    push('rehearsal-out', 'Ir al ensayo en [LUGAR]', 990 - s.rehearsalTravelMin, 990, 'travel', `${s.rehearsalTravelMin} min de ida configurados.`, true);
    push('saturday-rehearsal', 'Ensayo [ENSAYO] · [LUGAR]', 990, 1140, 'work', 'Ensayo confirmado todos los sábados, 16:30–19:00.', true, false);
    push('rehearsal-back', 'Volver del ensayo', 1140, 1140 + s.rehearsalTravelMin, 'travel', `${s.rehearsalTravelMin} min de regreso configurados.${week==='A'?' Regreso con [PEQUE] después del intercambio.':''}`, true, false, week === 'A');
  }

  for (const [index, extra] of (Array.isArray(extras) ? extras : []).entries()) {
    if (!extra || typeof extra !== 'object') continue;
    const applies = typeof extra.date === 'string' ? extra.date === date : Array.isArray(extra.days) && extra.days.includes(weekday);
    if (!applies) continue;
    if (typeof extra.startHHmm !== 'string' || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(extra.startHHmm)) {
      warnings.push(`${extra.title || 'Compromiso adicional'}: falta una hora de inicio válida.`);
      continue;
    }
    const duration = number(extra.durationMin, 0);
    if (duration <= 0) { warnings.push(`${extra.title || 'Compromiso adicional'}: la duración debe ser mayor que cero.`); continue; }
    const start = time(extra.startHHmm, '08:00');
    const travel = number(extra.travelMin, 0);
    const id = `extra-${String(extra.id || index)}`;
    const title = String(extra.title || 'Compromiso adicional');
    push(`${id}-out`, `Ir: ${title}`, start - travel, start, 'travel', `${travel} min de ida.`, true);
    push(id, title, start, start + duration, extra.kind === 'work' ? 'work' : 'personal', 'Compromiso agregado por vos.', true);
    push(`${id}-back`, `Volver: ${title}`, start + duration, start + duration + travel, 'travel', `${travel} min de regreso.`, true);
  }

  const fixedCookingTime = weekday === 2 ? s.mealPrepTuesdayStart : weekday === 5 ? s.mealPrepFridayStart : '';
  const hasFixedCooking = s.mealPrepDays.includes(weekday) && s.mealPrepDurationMin > 0 && fixedCookingTime !== '';
  if (hasFixedCooking) {
    const start = time(fixedCookingTime, '10:30');
    const end = start + s.mealPrepDurationMin;
    const withChild = careWindows.some(care => overlaps(care, {start,end}));
    push('meal-prep', 'Cocinar para los próximos días', start, end, 'cooking', `Tanda ${weekday === 2 ? '1' : '2'} de cocina: horario fijo elegido por vos, ${formatTime(start)}–${formatTime(end)}. ${s.mealPrepDurationMin} min de preparación.${withChild && s.cookingWithChild ? ' Cocinar con [PEQUE] habilitado por vos.' : ''}`, true, false, s.cookingWithChild);
  }

  // Family ranges do not force a midnight wake-up. Fixed journeys and commitments do.
  const earliestFixed = events.filter(e => e.fixed && blocksTime(e) && e.kind !== 'family' && !e.id.startsWith('care-')).reduce((earliest, event) => Math.min(earliest, event.start), MINUTE_DAY);
  // Prepare in time for 08:15 on an office-free Monday or 08:30 on Tuesday.
  // Actual school journeys, imported commitments and care still take precedence.
  const preferredMondayDeparture = 8 * 60 + 15 - s.gymTravelMin;
  const preferredTuesdayDeparture = 8 * 60 + 30 - s.gymTravelMin;
  const tuesdayTraining = weekday === 2 && s.gymDays.includes(2);
  const preferredTrainingDeparture = skipPewen ? preferredMondayDeparture : tuesdayTraining ? preferredTuesdayDeparture : MINUTE_DAY;
  const morningAnchor = Math.min(earliestFixed,preferredTrainingDeparture);
  const defaultWake = time(s.defaultWake, defaults.defaultWake);
  const breakfastDuration = s.breakfastInPreparation ? 0 : 20;
  const morningDuration = s.preparationMin + breakfastDuration;
  const rawWake = Math.min(defaultWake, morningAnchor - morningDuration - s.morningBufferMin);
  if (rawWake < 0) warnings.push('La preparación del primer compromiso empezaría el día anterior. Revisá el horario o la duración: el plan no entra en esta mañana.');
  const wakeTime = Math.max(0, rawWake);
  const bedtimePrevious = ((wakeTime - Math.round(s.sleepHours * 60)) % MINUTE_DAY + MINUTE_DAY) % MINUTE_DAY;
  const preferredBedtime = time(s.preferredBedtime, defaults.preferredBedtime);
  const sleepAvailable = wakeTime - preferredBedtime + (preferredBedtime >= 720 ? MINUTE_DAY : 0);
  if (sleepAvailable < s.sleepHours * 60) warnings.push(`Para dormir ${s.sleepHours} h y levantarte a las ${formatTime(wakeTime)}, acostate la noche anterior a las ${formatTime(bedtimePrevious)}. Tu hora habitual ${formatTime(preferredBedtime)} deja ${Math.max(0, Math.floor(sleepAvailable / 60))} h ${Math.max(0, Math.round(sleepAvailable % 60))} min.`);

  const busy = (includeCare: boolean, includeAway = false): Range[] => [...events.filter(e => blocksTime(e) && (includeCare || !e.id.startsWith('care-'))), ...(includeAway ? awayWindows : [])];
  const meal = (id: string, title: string, duration: number, from: number, to: number, preferred: number) => {
    const slot = findSlot(duration, Math.max(wakeTime, from), to, preferred, busy(false));
    if (slot === undefined) warnings.push(`${title}: no hay un hueco de ${duration} min en su franja. Hace falta mover un compromiso.`);
    else push(id, title, slot, slot + duration, 'meal', 'Pausa protegida para comer.', false, false, true);
  };
  if (s.breakfastInPreparation && s.preparationMin > 0) {
    push('meal-breakfast', s.breakfastCreatine ? 'Desayuno, creatina y prepararte' : 'Desayuno y prepararte', wakeTime, wakeTime + s.preparationMin, 'meal', `Rutina de ${s.preparationMin} min: desayuno y preparación incluidos. Ajustá si necesitás más tiempo.${s.breakfastCreatine ? ' Tomar la creatina junto al desayuno, según tu indicación habitual.' : ''}`, false, !s.preparationConfirmed, true);
  } else {
    push('meal-breakfast', s.breakfastCreatine ? 'Desayunar y tomar creatina' : 'Desayunar', wakeTime, wakeTime + 20, 'meal', `20 min de desayuno, separados del tiempo para prepararte.${s.breakfastCreatine ? ' Tomar la creatina junto al desayuno, según tu indicación habitual.' : ''}`, false, false, true);
    push('morning-preparation', 'Prepararte para el día', wakeTime + 20, wakeTime + 20 + s.preparationMin, 'personal', `${s.preparationMin} min de preparación además del desayuno.`, false, !s.preparationConfirmed, true);
  }
  if (morningAnchor < MINUTE_DAY && s.morningBufferMin > 0) {
    push('morning-buffer', 'Margen antes de salir', morningAnchor - s.morningBufferMin, morningAnchor, 'personal', `${s.morningBufferMin} min reservados antes del primer compromiso.`, false, false, true);
  }
  if (!hasOfficeLunch) meal('meal-lunch', 'Almorzar', 30, 705, 900, 780);
  const mondayRehearsalDeparture = skipPewen ? events.find(e => e.id === 'monday-rehearsal-out')?.start : undefined;
  // On an office-free Monday, eat before leaving home for the afternoon rehearsal.
  const snackBeforeDeparture = mondayRehearsalDeparture === undefined ? 990 : Math.max(0, mondayRehearsalDeparture - 15);
  meal('meal-snack', 'Merienda', 15, Math.min(960, snackBeforeDeparture), 1125, Math.min(990, snackBeforeDeparture));
  meal('meal-dinner', 'Cenar', 30, 1170, 1380, 1230);

  if (s.gymDays.includes(weekday) || skipPewen) {
    const duration = s.gymTravelMin * 2 + s.gymDurationMin + s.showerMin;
    const preferred = skipPewen ? preferredMondayDeparture : tuesdayTraining ? preferredTuesdayDeparture : 1020;
    const slot = findSlot(duration, Math.max(wakeTime + 30, 420), 1290, preferred, busy(true, true));
    if (slot === undefined) warnings.push(`Entrenamiento: no hay un hueco real de ${duration} min fuera del cuidado de [PEQUE]. Elegí cobertura u otro día; no se superpuso con tus compromisos.`);
    else {
      if (skipPewen && slot !== preferred) {
        const wanted = {start:preferred,end:preferred+duration};
        const schoolBlocks = events.some(e => (e.id.startsWith('school-') || e.id.startsWith('pickup-')) && overlaps(e,wanted));
        warnings.push(`Entrenamiento: las 08:15 no son posibles con ${schoolBlocks ? 'los viajes del jardín' : 'los compromisos y cuidados de hoy'}. Se ubicó a las ${formatTime(slot+s.gymTravelMin)}, con el traslado, la vuelta y la ducha completos.`);
      }
      if (tuesdayTraining && slot !== preferred) warnings.push(`Entrenamiento del martes: las 08:30 no son posibles con los compromisos y cuidados de hoy. Se ubicó a las ${formatTime(slot+s.gymTravelMin)}, con la sesión, los traslados y la ducha completos.`);
      let cursor = slot;
      push('gym-out', 'Ir a entrenar', cursor, cursor += s.gymTravelMin, 'travel', `${s.gymTravelMin} min de ida.`, false);
      push('gym', 'Entrenar', cursor, cursor += s.gymDurationMin, 'gym', skipPewen ? 'Lunes sin [DESTINO]: entrenamiento con preferencia a las 08:15, acomodado a los compromisos reales. Abrí la sesión guiada en Mi Vida para elegir tu rutina y registrar series, cargas y descansos.' : tuesdayTraining ? 'Martes: preferencia a las 08:30, antes de la tanda de cocina y respetando tus compromisos. Abrí la sesión guiada en Mi Vida para registrar series, cargas y descansos.' : 'Bloque de entrenamiento. Abrí la sesión guiada en Mi Vida para elegir tu rutina y registrar series, cargas y descansos.', false);
      push('gym-back', 'Volver de entrenar', cursor, cursor += s.gymTravelMin, 'travel', `${s.gymTravelMin} min de regreso.`, false);
      push('gym-shower', 'Ducha y cambio', cursor, cursor + s.showerMin, 'personal', `${s.showerMin} min después de entrenar.`, false);
    }
  }

  if (s.mealPrepDays.includes(weekday) && s.mealPrepDurationMin > 0 && !hasFixedCooking) {
    const slot = findSlot(s.mealPrepDurationMin, Math.max(wakeTime + morningDuration, 480), 1260, weekday === 2 ? 600 : 900, busy(!s.cookingWithChild, true));
    if (slot === undefined) warnings.push(s.cookingWithChild
      ? `Meal prep: no entran ${s.mealPrepDurationMin} min de cocina entre los compromisos actuales, incluso habilitando cocinar con [PEQUE].`
      : `Meal prep: no entran ${s.mealPrepDurationMin} min de cocina fuera del cuidado de [PEQUE]. Cambiá el día, disponé de cobertura o habilitá explícitamente cocinar con ella.`);
    else {
      const withChild = careWindows.some(care => overlaps(care, { start: slot, end: slot + s.mealPrepDurationMin }));
      push('meal-prep', 'Cocinar para los próximos días', slot, slot + s.mealPrepDurationMin, 'cooking', `${s.mealPrepDurationMin} min de cocina y preparación.${withChild ? ' Cocinar con [PEQUE] habilitado por vos.' : ''}`, false, false, s.cookingWithChild);
    }
  }

  if ((weekday >= 2 && weekday <= 5 || skipPewen) && weekday !== s.recordingDay && s.flexibleWorkMin > 0) {
    let remaining = s.flexibleWorkMin;
    let block = 0;
    const openings = freeRanges(Math.max(480, wakeTime + morningDuration), 1140, busy(true, true));
    for (const opening of openings) {
      if (remaining <= 0) break;
      const duration = Math.min(remaining, opening.end - opening.start);
      if (duration < 30) continue;
      push(`flex-work-${block++}`, 'Trabajo / proyectos', opening.start, opening.start + duration, 'work', 'Trabajo flexible ubicado después de proteger comidas, entrenamiento y cuidados.', false);
      remaining -= duration;
    }
    if (remaining > 0) warnings.push(`Trabajo flexible: quedan ${remaining} min sin ubicar; el día no tiene más espacio fuera de los cuidados.`);
  }

  const seenConflicts = new Set<string>();
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (!blocksTime(a) || !blocksTime(b) || !overlaps(a, b)) continue;
      const careEvent = a.id.startsWith('care-') ? a : b.id.startsWith('care-') ? b : undefined;
      const other = careEvent === a ? b : a;
      if (careEvent) {
        if (allowedDuringCare.has(other.id) || other.id.startsWith('care-')) continue;
        other.conflict = true;
        careEvent.conflict = true;
        const key = `care:${other.id}`;
        if (!seenConflicts.has(key)) warnings.push(`${other.title} se cruza con el cuidado de [PEQUE]. Hace falta resolver quién la acompaña.`);
        seenConflicts.add(key);
      } else {
        a.conflict = true;
        b.conflict = true;
        const key = [a.title, b.title].sort().join('|');
        if (!seenConflicts.has(key)) warnings.push(`Se superponen ${a.title} y ${b.title} (${formatTime(Math.max(a.start, b.start))}–${formatTime(Math.min(a.end, b.end))}).`);
        seenConflicts.add(key);
      }
    }
  }

  events.sort((a, b) => a.start - b.start || Number(a.id.startsWith('care-')) - Number(b.id.startsWith('care-')) || a.end - b.end);
  return { date, week, wakeTime, bedtimePrevious, events: events.map(e => e.source === 'google' ? e : ({...e,title:personalize(e.title),detail:personalize(e.detail)})), warnings: [...new Set(warnings)].map(personalize), pending: [...new Set(pending)].map(personalize), care:personalize(care) };
}
