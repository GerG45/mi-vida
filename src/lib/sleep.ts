import { addDays, buildDay, formatTime, type DayOverride, type ExtraEvent, type Settings } from './planner';
import type { CalendarEventOccurrence } from './calendarModel';
export const SLEEP_PREPARATION_MINUTES = 45;

/** A proposed sleep window, derived from tomorrow's plan, never a sleep measurement. */
export function getNightPlan(date: string, settings: Settings, overrides: Record<string,DayOverride> = {}, extras: ExtraEvent[] = [], externalOccurrences: CalendarEventOccurrence[] = []) {
  const current = buildDay(date,settings,overrides,extras,externalOccurrences);
  const wakeDate = addDays(current.date,1);
  const tomorrow = buildDay(wakeDate,settings,overrides,extras,externalOccurrences);
  const sleepHours = typeof settings.sleepHours === 'number' && Number.isFinite(settings.sleepHours) ? Math.max(4,Math.min(12,settings.sleepHours)) : 8;
  const bedtimeOffset = 1440 + tomorrow.wakeTime - Math.round(sleepHours*60);
  const bedtimeDate = bedtimeOffset >= 1440 ? wakeDate : current.date;
  const bedtime = ((bedtimeOffset % 1440)+1440)%1440;
  const preparationOffset=bedtimeOffset-SLEEP_PREPARATION_MINUTES;
  const preparationDate=addDays(current.date,Math.floor(preparationOffset/1440));
  const preparationTime=((preparationOffset%1440)+1440)%1440;
  const conflicts = current.events.filter(event=>event.kind!=='family' && event.kind!=='sleep' && !(event.source==='google' && (event.allDay || event.busy===false)) && event.end>bedtimeOffset)
    .map(event=>`${event.title} termina a las ${formatTime(event.end)}, después de la hora propuesta para dormir.`);
  return {date:current.date,wakeDate,wakeTime:tomorrow.wakeTime,bedtimeDate,bedtime,preparationDate,preparationTime,sleepHours,conflicts,enabled:settings.scheduleEnabled===true};
}
