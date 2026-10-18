import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourcePath = fileURLToPath(new URL('../src/lib/planner.ts', import.meta.url));
const source = await fs.readFile(sourcePath, 'utf8');
const { outputText, diagnostics = [] } = ts.transpileModule(source, {
  fileName: sourcePath,
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, strict: true },
});
assert.equal(diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const { defaults, buildDay, isoDate, addDays, formatTime, weekForDate } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
// Explicitly activated fixture: public defaults intentionally start with an empty agenda.
const settings = (patch = {}) => ({
  ...defaults,
  childName: 'tu peque', workLocation: 'destino de trabajo', rehearsalName: 'Ensayo', rehearsalPlace: 'Lugar',
  scheduleEnabled: true, familyConfirmed: true, cordobaConfirmed: true, recordingConfirmed: true, preparationConfirmed: true,
  gymDays: [...defaults.gymDays], mealPrepDays: [...defaults.mealPrepDays],
  ...patch,
});
const intersects = (a, b) => a.start < b.end && b.start < a.end;

test('defaults públicos no activan una agenda personal hasta elegir habilitarla', () => {
  assert.equal(defaults.scheduleEnabled, false);
  assert.equal(defaults.familyConfirmed, false);
  assert.equal(defaults.cordobaConfirmed, false);
  assert.equal(defaults.recordingConfirmed, false);
  assert.equal(defaults.preparationConfirmed, false);
  for (let n = 0; n < 14; n++) {
    const day = buildDay(addDays('2026-10-19', n), { ...defaults }, {}, []);
    assert.deepEqual(day.events, []);
    assert.ok(day.pending.some(message => message.includes('activá tu agenda')));
  }
  assert.ok(buildDay('2026-10-19', settings(), {}, []).events.length > 0);
});

test('booleanos importados como texto no habilitan la agenda accidentalmente', () => {
  for (const scheduleEnabled of ['false', 'true', 0, 1, null, undefined]) {
    const day = buildDay('2026-10-19', settings({ scheduleEnabled }), {}, []);
    assert.deepEqual(day.events, [], `No debe activar la agenda: ${String(scheduleEnabled)}`);
  }
});

test('etiquetas personales configuradas reemplazan todos los tokens visibles', () => {
  const personalized = settings({ childName: 'mi peque', workLocation: 'Centro de trabajo', rehearsalName: 'Encuentro musical', rehearsalPlace: 'Sala Norte', recordingDay: 2 });
  const plans = Array.from({ length: 14 }, (_, n) => buildDay(addDays('2026-10-19', n), personalized, {}, []));
  const visible = JSON.stringify(plans.map(day => ({ events: day.events.map(({ title, detail }) => ({ title, detail })), warnings: day.warnings, pending: day.pending, care: day.care })));
  for (const label of ['mi peque', 'Centro de trabajo', 'Encuentro musical', 'Sala Norte']) assert.ok(visible.includes(label), `Faltó ${label}`);
  assert.doesNotMatch(visible, /\[(PEQUE|DESTINO|ENSAYO|LUGAR)\]/);
});

test('etiquetas con $& y $$ se conservan literalmente sin reinsertar tokens', () => {
  const personalized = settings({ childName: 'peque $& $$', workLocation: 'destino $&', rehearsalName: 'música $&', rehearsalPlace: 'sala $&' });
  const plans = Array.from({ length: 7 }, (_, n) => buildDay(addDays('2026-10-19', n), personalized, {}, []));
  const visible = JSON.stringify(plans);
  for (const label of ['peque $& $$', 'destino $&', 'música $&', 'sala $&']) assert.ok(visible.includes(label), `Faltó la etiqueta literal ${label}`);
  assert.doesNotMatch(visible, /\[(PEQUE|DESTINO|ENSAYO|LUGAR)\]/);
});

test('alternancia A/B antes y después del lunes de referencia', () => {
  assert.equal(weekForDate('2026-10-12', defaults.anchorMonday), 'A');
  assert.equal(weekForDate('2026-10-18', defaults.anchorMonday), 'A');
  assert.equal(weekForDate('2026-10-19', defaults.anchorMonday), 'B');
  assert.equal(weekForDate('2026-10-25', defaults.anchorMonday), 'B');
  assert.equal(weekForDate('2026-10-26', defaults.anchorMonday), 'A');
  assert.equal(weekForDate('2026-10-11', defaults.anchorMonday), 'B');
  assert.equal(weekForDate('2026-10-05', defaults.anchorMonday), 'B');
  assert.equal(weekForDate('2026-10-04', defaults.anchorMonday), 'A');
});

test('lunes B sale 07:15 y despierta 06:45 para jardín 07:45', () => {
  const day = buildDay('2026-10-19', settings(), {}, []);
  assert.equal(day.week, 'B');
  assert.equal(day.wakeTime, 405);
  assert.equal(day.events.find(e => e.id === 'school-out').start, 435);
  assert.equal(day.events.find(e => e.id === 'school-dropoff').start, 465);
  assert.equal(day.bedtimePrevious, 1365);
  assert.ok(day.events.find(e => e.id === 'cordoba-back').tentative);
  assert.ok(day.events.find(e => e.id === 'gym').tentative);
  assert.equal(day.events.find(e => e.id === 'cordoba-back').start, 930);
});

test('lunes A no lleva al jardín; calcula su viaje desde casa', () => {
  const day = buildDay('2026-10-26', settings({ cordobaHomeTravelMin: 90 }), {}, []);
  assert.equal(day.events.some(e => e.id === 'school-dropoff'), false);
  assert.equal(day.events.find(e => e.id === 'cordoba-out').start, 465);
  assert.equal(day.wakeTime, 435);
});

test('desayuno adicional despierta 06:25 y deja preparación y margen separados', () => {
  const day = buildDay('2026-10-19', settings({ breakfastInPreparation: false }), {}, []);
  assert.equal(day.wakeTime, 385);
  const breakfast = day.events.find(e => e.id === 'meal-breakfast');
  const preparation = day.events.find(e => e.id === 'morning-preparation');
  const buffer = day.events.find(e => e.id === 'morning-buffer');
  assert.equal(breakfast.start, 385);
  assert.equal(breakfast.end, 405);
  assert.equal(preparation.start, 405);
  assert.equal(preparation.end, 425);
  assert.equal(buffer.start, 425);
  assert.equal(buffer.end, 435);
  assert.equal(intersects(breakfast, preparation), false);
  assert.equal(intersects(preparation, buffer), false);
});

test('llegada imposible al destino de trabajo genera aviso sin adelantar jardín', () => {
  const day = buildDay('2026-10-19', settings({ cordobaArrival: '08:30', cordobaTravelMin: 90 }), {}, []);
  assert.equal(day.events.find(e => e.id === 'school-dropoff').start, 465);
  assert.ok(day.warnings.some(w => w.includes('No llegás a destino de trabajo')));
  assert.ok(day.events.filter(e => e.id.startsWith('cordoba-')).some(e => e.conflict));
});

test('trabajo con jornada corta conserva almuerzo dentro del bloque y vuelta posterior', () => {
  for (const cordobaWorkMin of [180, 210, 225, 240, 300, 360]) {
    const day = buildDay('2026-10-19', settings({ cordobaWorkMin }), {}, []);
    const back = day.events.find(e => e.id === 'cordoba-back');
    assert.equal(back.start, 570 + cordobaWorkMin);
    assert.equal(back.end, back.start + 60);
    const lunch = day.events.find(e => e.id === 'meal-lunch-office');
    if (lunch) assert.ok(lunch.end <= back.start);
    assert.equal(back.conflict, undefined);
  }
});

test('gimnasio completo cabe entre fijos y siempre fuera del cuidado durante cuatro semanas', () => {
  for (let n = 0; n < 28; n++) {
    const day = buildDay(addDays('2026-10-12', n), settings(), {}, []);
    const gymEvents = day.events.filter(e => e.id.startsWith('gym'));
    for (const gym of gymEvents) {
      assert.equal(gym.conflict, undefined, `${day.date}: ${gym.title}`);
      for (const fixed of day.events.filter(e => e.fixed)) {
        assert.equal(intersects(gym, fixed), false, `${day.date}: ${gym.title} / ${fixed.title}`);
      }
    }
    if (gymEvents.length) assert.equal(gymEvents.reduce((sum, e) => sum + e.end - e.start, 0), 120);
    else assert.ok(day.warnings.some(w => w.startsWith('Entrenamiento:')));
  }
});

test('catorce días reales conservan las cuatro comidas sin cruces y la rutina matutina', () => {
  for (let n = 0; n < 14; n++) {
    const day = buildDay(addDays('2026-10-19', n), settings(), {}, []);
    const meals = day.events.filter(e => e.kind === 'meal');
    assert.equal(meals.length, 4, `${day.date}: faltó una comida`);
    for (const meal of meals) assert.equal(meal.conflict, undefined, `${day.date}: ${meal.title}`);
    const routine = day.events.find(e => e.id === 'meal-breakfast');
    assert.equal(routine.start, day.wakeTime);
    assert.equal(routine.end - routine.start, 20);
    const buffer = day.events.find(e => e.id === 'morning-buffer');
    if (buffer) assert.ok(routine.end <= buffer.start, `${day.date}: rutina sin margen`);
    for (const event of day.events.filter(e => e.id.startsWith('gym') || e.kind === 'cooking')) {
      for (const other of day.events.filter(e => e.id !== event.id)) {
        assert.equal(intersects(event, other), false, `${day.date}: ${event.title} / ${other.title}`);
      }
    }
  }
});

test('cocinar durante el cuidado requiere opción explícita y entonces puede usar ese tiempo', () => {
  const extra = { id: 'morning', title: 'Mañana ocupada', date: '2026-10-20', startHHmm: '08:30', durationMin: 230, travelMin: 0, kind: 'work' };
  const blocked = buildDay('2026-10-20', settings({ gymDays: [] }), {}, [extra]);
  assert.equal(blocked.events.some(e => e.id === 'meal-prep'), false);
  assert.ok(blocked.warnings.some(w => w.includes('habilitá explícitamente cocinar con ella')));
  const enabled = buildDay('2026-10-20', settings({ gymDays: [], cookingWithChild: true }), {}, [extra]);
  const cooking = enabled.events.find(e => e.id === 'meal-prep');
  assert.ok(cooking);
  assert.ok(cooking.start >= 780);
  assert.equal(cooking.conflict, undefined);
  assert.ok(cooking.detail.includes('habilitado por vos'));
});

test('grabación pasó a miércoles 15–18; el martes no conserva ese bloque', () => {
  const tue = buildDay('2026-10-20', settings(), {}, []);
  const wed = buildDay('2026-10-21', settings(), {}, []);
  assert.equal(tue.events.some(e => e.id === 'recording'), false);
  const recording = wed.events.find(e => e.id === 'recording');
  assert.equal(recording.start, 900);
  assert.equal(recording.end, 1080);
  assert.equal(recording.conflict, undefined);
  assert.ok(wed.pending.some(p => p.includes('lugar de grabación')));
});

test('una grabación durante cuidado conserva y señala el conflicto hasta resolver cobertura', () => {
  const day = buildDay('2026-10-20', settings({ recordingDay: 2 }), {}, []);
  assert.equal(day.events.find(e => e.id === 'recording').conflict, true);
  assert.ok(day.pending.some(p => p.includes('quién cuida')));
  for (const recordingCare of ['covered', 'withMe']) {
    const resolved = buildDay('2026-10-20', settings({ recordingDay: 2, recordingCare }), {}, []);
    assert.equal(resolved.events.find(e => e.id === 'recording').conflict, undefined);
    assert.equal(resolved.pending.some(p => p.includes('quién cuida')), false);
  }
});

test('excepciones cambian quién lleva y jardín cerrado elimina viajes escolares', () => {
  const mondayA = buildDay('2026-10-26', settings(), { '2026-10-26': { dropoff: 'me' } }, []);
  assert.ok(mondayA.events.some(e => e.id === 'school-dropoff'));
  const closed = buildDay('2026-10-19', settings(), { '2026-10-19': { schoolClosed: true } }, []);
  assert.equal(closed.events.some(e => e.id.startsWith('school-') || e.id.startsWith('pickup-')), false);
  assert.ok(closed.pending.some(p => p.includes('Jardín cerrado')));
  assert.equal(closed.events.some(e => e.id === 'gym'), false);
  assert.ok(closed.events.find(e => e.id.startsWith('care-')).end === 1440);
  const coveredPickup = buildDay('2026-10-20', settings(), { '2026-10-20': { pickup: 'other' } }, []);
  assert.equal(coveredPickup.events.some(e => e.id === 'school-pickup'), false);
  const preservedCare = coveredPickup.events.find(e => e.id.startsWith('care-'));
  assert.equal(preservedCare.start, 780);
  assert.equal(preservedCare.end, 1440);
  assert.ok(coveredPickup.pending.some(message => message.includes('el cuidado a tu cargo se mantiene')));
  const coveredDay = buildDay('2026-10-20', settings(), { '2026-10-20': { pickup: 'other', care: 'other' } }, []);
  assert.equal(coveredDay.events.some(e => e.id.startsWith('care-')), false);
  const coveredDropoff = buildDay('2026-10-21', settings(), { '2026-10-21': { dropoff: 'other' } }, []);
  assert.equal(coveredDropoff.events.some(e => e.id === 'school-dropoff'), false);
  assert.equal(coveredDropoff.events.find(e => e.id.startsWith('care-')).end, 465);
  const fullDayCare = buildDay('2026-10-25', settings(), { '2026-10-25': { care: 'me' } }, []);
  assert.equal(fullDayCare.events.find(e => e.id.startsWith('care-')).end, 1440);
  assert.equal(fullDayCare.events.some(e => e.id === 'gym'), false);
});

test('ensayo todos los sábados y cuidado A desde19, domingo A todo el día', () => {
  for (const date of ['2026-10-17', '2026-10-24']) {
    const day = buildDay(date, settings(), {}, []);
    assert.equal(day.events.find(e => e.id === 'saturday-rehearsal').start, 990);
    assert.equal(day.events.find(e => e.id === 'saturday-rehearsal').end, 1140);
  }
  const saturdayA = buildDay('2026-10-17', settings(), {}, []);
  assert.equal(saturdayA.events.find(e => e.id.startsWith('care-')).start, 1140);
  const sundayA = buildDay('2026-10-18', settings(), {}, []);
  assert.equal(sundayA.events.some(e => e.id === 'gym'), false);
  assert.ok(sundayA.care.includes('todo el día'));
  const sundayB = buildDay('2026-10-25', settings(), {}, []);
  assert.equal(sundayB.events.some(e => e.id.startsWith('care-')), false);
  assert.ok(sundayB.events.some(e => e.id === 'gym'));
});

test('regreso del ensayo de 30min en sábado A permite viajar durante el cuidado', () => {
  const day = buildDay('2026-10-17', settings({ rehearsalTravelMin: 30 }), {}, []);
  const back = day.events.find(e => e.id === 'rehearsal-back');
  assert.equal(back.start, 1140);
  assert.equal(back.end, 1170);
  assert.equal(back.conflict, undefined);
  assert.ok(back.detail.includes('después del intercambio'));
  assert.equal(day.warnings.some(warning => warning.includes('Volver del ensayo') && warning.includes('cuidado')), false);
});

test('danza pendiente no bloquea como un compromiso confirmado', () => {
  const pending = buildDay('2026-10-20', settings({ danceTransport: 'pending' }), {}, []);
  assert.equal(pending.events.some(e => e.id.startsWith('dance')), false);
  assert.ok(pending.pending.some(p => p.includes('quién traslada')));
  const me = buildDay('2026-10-20', settings(), {}, []);
  assert.equal(me.events.find(e => e.id === 'dance').start, 1110);
  assert.equal(me.events.find(e => e.id === 'dance').end, 1230);
  const custom = buildDay('2026-10-20', settings({ danceTravelMin: 45 }), {}, []);
  assert.equal(custom.events.find(e => e.id === 'dance-out').start, 1065);
  assert.equal(custom.events.find(e => e.id === 'dance-back').end, 1275);
});

test('eventos por fecha o día reservan traslados y detectan choques reales', () => {
  const extra = { id: 'turno', title: 'Turno personal', date: '2026-10-21', startHHmm: '15:30', durationMin: 30, travelMin: 20, kind: 'personal' };
  const wed = buildDay('2026-10-21', settings(), {}, [extra]);
  assert.equal(wed.events.find(e => e.id === 'extra-turno-out').start, 910);
  assert.equal(wed.events.find(e => e.id === 'extra-turno').conflict, true);
  assert.ok(wed.warnings.some(w => w.includes('Turno personal') && w.includes('Grabar violines')));
  const thu = buildDay('2026-10-22', settings(), {}, [extra]);
  assert.equal(thu.events.some(e => e.id === 'extra-turno'), false);
  const weekly = buildDay('2026-10-22', settings(), {}, [{ ...extra, id: 'weekly', date: undefined, days: [4], startHHmm: '09:00' }]);
  assert.ok(weekly.events.some(e => e.id === 'extra-weekly'));
});

test('si no queda espacio para entrenar se avisa sin superponer ni acortar', () => {
  const day = buildDay('2026-10-25', settings(), {}, [{ id: 'viaje', title: 'Día ocupado', date: '2026-10-25', startHHmm: '06:00', durationMin: 1080, travelMin: 0, kind: 'personal' }]);
  assert.equal(day.events.some(e => e.id === 'gym'), false);
  assert.ok(day.warnings.some(w => w.startsWith('Entrenamiento:')));
});

test('fechas se mantienen locales inclusive por la noche y entre años', () => {
  assert.equal(isoDate(new Date(2026, 9, 17, 23, 55)), '2026-10-17');
  assert.equal(isoDate(new Date(2026, 9, 18, 0, 5)), '2026-10-18');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(formatTime(-60), '23:00');
  assert.equal(formatTime(1440), '00:00');
});

test('entradas inválidas no producen NaN ni caídas', () => {
  const bad = settings({ preparationMin: NaN, cordobaTravelMin: Infinity, recordingDay: 99, schoolStart: '99:99', gymDays: null, sleepHours: NaN });
  const day = buildDay('2026-02-31', bad, null, [null, { id: 'bad', days: [1], title: 'Sin hora', startHHmm: 'xxx', durationMin: 60, travelMin: NaN, kind: 'work' }]);
  assert.equal(day.date, '2026-10-19');
  assert.ok(Number.isFinite(day.wakeTime));
  assert.ok(Number.isFinite(day.bedtimePrevious));
  for (const event of day.events) {
    assert.ok(Number.isFinite(event.start));
    assert.ok(Number.isFinite(event.end));
    assert.ok(event.start >= 0 && event.end <= 1440 && event.end > event.start);
  }
});
