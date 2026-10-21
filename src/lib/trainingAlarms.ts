import { Capacitor, registerPlugin } from '@capacitor/core';
import { getDateAccess, localDateKey } from './datePolicy';
import type { TrainingSession } from './training';

export type TrainingTimerKind = 'rest' | 'set';
export type TrainingTimerAlarm = {
  key: string; sessionId: string; date: string; kind: TrainingTimerKind;
  at: number; title: string; body: string;
};
export type TrainingTimerAlarmResult = { native: boolean; armed: number; warning: string | null };
type NativeTimerStatus = { armed?: number; warning?: string | null };
interface LifeTrainingTimersPlugin {
  replace(options: { scope: string; timers: TrainingTimerAlarm[] }): Promise<NativeTimerStatus>;
  cancelAll(): Promise<NativeTimerStatus>;
}
const LifeTrainingTimers = registerPlugin<LifeTrainingTimersPlugin>('LifeTrainingTimers');
export function isAndroidTrainingTimers() { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'; }

/** Factual countdowns only: no inferred session end, calendar time or completed sets. */
export function buildTrainingTimerAlarms(sessions: Record<string, TrainingSession>, now = Date.now()): TrainingTimerAlarm[] {
  if (!Number.isFinite(now)) return [];
  const alarms: TrainingTimerAlarm[] = [];
  for (const session of Object.values(sessions)) {
    if (session.status !== 'active' || !getDateAccess(session.date, now).canExecute) continue;
    for (const [kind, at] of [['rest', session.restUntil], ['set', session.setTimerUntil]] as const) {
      // A countdown cannot make yesterday writable or ring across the day's boundary.
      if (typeof at !== 'number' || !Number.isSafeInteger(at) || at <= now || at > now + 7_200_000 || localDateKey(at) !== session.date) continue;
      const exercise = session.exercises[session.currentExercise];
      alarms.push({
        key: `${session.id}:${kind}`, sessionId: session.id, date: session.date, kind, at,
        title: kind === 'rest' ? 'Descanso listo' : 'Terminó el contador de la serie',
        body: kind === 'rest' ? 'Volvé a tu próxima serie cuando estés preparado.' : `Volvé a Mi Vida para confirmar los segundos reales${exercise ? ` de ${exercise.name}` : ' de la serie'}.`,
      });
    }
  }
  // Normal operation has one session; the bound also protects imported snapshots.
  return alarms.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key)).slice(0, 32);
}

let revision = 0;
let queue: Promise<unknown> = Promise.resolve();
const inactive = (): TrainingTimerAlarmResult => ({ native: isAndroidTrainingTimers(), armed: 0, warning: null });
function serialized(operation: (isCurrent: () => boolean) => Promise<TrainingTimerAlarmResult>) {
  const current = ++revision;
  const task = queue.catch(() => undefined).then(() => current === revision ? operation(() => current === revision) : inactive());
  queue = task;
  return task;
}

/** App owns reconciliation, so navigating or hiding the training screen never cancels a timer. */
export function syncTrainingTimerAlarms(options: { scope: string | null; sessions: Record<string, TrainingSession>; now?: number }): Promise<TrainingTimerAlarmResult> {
  if (!isAndroidTrainingTimers()) return Promise.resolve(inactive());
  // Snapshot now; a delayed queued call must not observe mutated or another account's state.
  const snapshot = structuredClone(options.sessions);
  const scope = options.scope ?? 'local';
  return serialized(async isCurrent => {
    const timers = buildTrainingTimerAlarms(snapshot, options.now ?? Date.now());
    try {
      const result = await LifeTrainingTimers.replace({ scope, timers });
      return isCurrent() ? { native: true, armed: result.armed ?? 0, warning: result.warning ?? null } : inactive();
    } catch (error) {
      return isCurrent() ? { native: true, armed: 0, warning: error instanceof Error ? error.message : 'No se pudieron preparar los avisos del entrenamiento. Revisá los permisos de alarmas y notificaciones en la APK.' } : inactive();
    }
  });
}

/** Explicit account/logout/reset cancellation; never use as a Training screen effect cleanup. */
export function clearTrainingTimerAlarms(): Promise<TrainingTimerAlarmResult> {
  if (!isAndroidTrainingTimers()) return Promise.resolve(inactive());
  return serialized(async isCurrent => {
    try {
      await LifeTrainingTimers.cancelAll();
      return inactive();
    } catch {
      return isCurrent() ? { native: true, armed: 0, warning: 'No se pudieron cancelar los avisos del entrenamiento. Volvé a abrir Mi Vida.' } : inactive();
    }
  });
}
