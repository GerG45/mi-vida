import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function moduleSource(path) {
  const { outputText } = ts.transpileModule(await fs.readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const plannerUrl = await moduleSource('../src/lib/planner.ts');
const { defaults } = await import(plannerUrl);
const sleepSource = ts.transpileModule(await fs.readFile(new URL('../src/lib/sleep.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace(/from ['"]\.\/planner['"]/, `from '${plannerUrl}'`);
const sleepUrl = `data:text/javascript;base64,${Buffer.from(sleepSource).toString('base64')}`;
const trainingUrl = await moduleSource('../src/lib/training.ts');
const training = await import(trainingUrl);
const trainingReportSource = ts.transpileModule(await fs.readFile(new URL('../src/lib/trainingReport.ts',import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},
}).outputText.replace(/from ['"]\.\/training['"]/,`from '${trainingUrl}'`);
const trainingReportUrl = `data:text/javascript;base64,${Buffer.from(trainingReportSource).toString('base64')}`;
const reportSource = ts.transpileModule(await fs.readFile(new URL('../src/lib/weeklyReport.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace(/from ['"]\.\/planner['"]/, `from '${plannerUrl}'`).replace(/from ['"]\.\/sleep['"]/, `from '${sleepUrl}'`).replace(/from ['"]\.\/trainingReport['"]/,`from '${trainingReportUrl}'`);
const { getReportWeek, getDefaultReportWeek, buildWeeklyReport } = await import(`data:text/javascript;base64,${Buffer.from(reportSource).toString('base64')}`);
const backup = (sections = {}) => ({ version: 1, exportedAt: '2026-10-19T01:20:00.000Z', sections });

test('Sunday closes its own week, Monday offers the preceding complete week', () => {
  assert.deepEqual(getDefaultReportWeek('2026-10-18'), {
    start: '2026-10-12', end: '2026-10-18',
    dates: ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18'],
  });
  assert.equal(getDefaultReportWeek('2026-10-19').start, '2026-10-12');
  assert.equal(getDefaultReportWeek('2026-10-20').start, '2026-10-19');
  assert.equal(getReportWeek('2026-10-19').start, '2026-10-19', 'an explicitly selected Monday belongs to its own week');
});

test('calendar ranges cross years and never shift their date through a timezone conversion', () => {
  assert.equal(getDefaultReportWeek('2027-01-04').start, '2026-12-28');
  assert.equal(getReportWeek('2027-01-03').end, '2027-01-03');
  assert.throws(() => getReportWeek('2026-02-30'), /fecha válida/);
  assert.throws(() => getReportWeek('2026-10-18T23:30:00-03:00'), /fecha válida/);
  const report = buildWeeklyReport(backup({ journal: { '2026-10-18': { freeText: 'Anoche sentí calma.' }, '2026-10-19': { freeText: 'No pertenece al cierre.' } } }), '2026-10-18');
  assert.match(report.markdown, /Anoche sentí calma\./);
  assert.doesNotMatch(report.markdown, /No pertenece al cierre/);
  assert.match(report.markdown, /18\/10\/2026, 22:20:00/);
});

test('old and absent sections produce a useful report without inventing diary, mood, energy or habits', () => {
  const report = buildWeeklyReport(backup({ journal: { '2026-10-12': { gratitude: 'El mate compartido.' } } }), '2026-10-12');
  assert.equal(report.journalDays, 1);
  assert.equal(report.habitMarks, 0);
  assert.equal(report.blockMarks, 0);
  assert.equal((report.markdown.match(/Sin entrada registrada\./g) || []).length, 6);
  assert.match(report.markdown, /Ánimo registrado: Sin registrar/);
  assert.match(report.markdown, /Energía elegida: Sin registrar/);
  assert.match(report.markdown, /No hay hábitos guardados/);
  assert.match(report.markdown, /No hay agenda activada/);
  assert.match(report.markdown, /No hay acciones GTD guardadas/);
  assert.doesNotMatch(report.markdown, /0\/5/);
  const oldTask = buildWeeklyReport(backup({ tasks: { old: { title: 'Pendiente antiguo' } } }), '2026-10-12');
  assert.match(oldTask.markdown, /### Entrada \(1\)/);
  assert.match(oldTask.markdown, /Pendiente antiguo/);
});

test('habit marks are exact dates for currently existing habits; no inference from blanks or deleted habits', () => {
  const report = buildWeeklyReport(backup({
    habits: { read: { id: 'read', name: 'Leer', cue: 'Mate', tinyStep: 'Una página' } },
    habitChecks: { '2026-10-11:read': true, '2026-10-12:read': true, '2026-10-13:read': false, '2026-10-18:read': true, '2026-10-19:read': true, '2026-10-14:deleted': true },
  }), '2026-10-18');
  assert.equal(report.habitMarks, 2);
  assert.match(report.markdown, /\| Leer \| ✓ \| — \| — \| — \| — \| — \| ✓ \|/);
  assert.match(report.markdown, /no se calcula una tasa de cumplimiento/);
  assert.doesNotMatch(report.markdown, /deleted/);
});

test('all journal fields are preserved and blank entries do not count as registrations', () => {
  const report = buildWeeklyReport(backup({ journal: {
    '2026-10-12': { intention: 'Intención', gratitude: 'Gracias', smallStep: 'Paso', win: 'Logro', learned: 'Aprendizaje', letGo: 'Soltar', freeText: 'Primera línea\nSegunda línea', mood: 'En calma', energy: 4 },
    '2026-10-13': { intention: '', mood: '', energy: 0 },
  } }), '2026-10-12');
  assert.equal(report.journalDays, 1);
  for (const text of ['Intención','Gracias','Paso','Logro','Aprendizaje','Soltar','> Primera línea\n> Segunda línea','Energía elegida: 4/5']) assert.ok(report.markdown.includes(text));
});

test('report excludes access configuration and location fields, and name is explicitly optional', () => {
  const reportBackup = backup({
    profile: { name: 'Nombre privado', uid: 'uid-no-compartir', email: 'correo-privado@example.test' },
    settings: { ...defaults, scheduleEnabled: true, homeAddress: 'Domicilio secreto 123', homeMapsUrl: 'https://share.google/mapa-casa', gymMapsUrl: 'https://maps.app.goo.gl/mapa-gym', apiKey: 'clave-no-compartir', workLocation: 'Dirección oficina 567', rehearsalPlace: 'Dirección ensayo 789' },
    journal: { '2026-10-12': { freeText: 'Mi ubicación https://share.google/mapa-pegado y https://www.google.com/maps/place/privado' } },
    firebase: { projectId: 'proyecto-privado', apiKey: 'clave-firebase' },
  });
  const plain = buildWeeklyReport(reportBackup, '2026-10-12');
  for (const privateValue of ['Nombre privado','uid-no-compartir','correo-privado','Domicilio secreto','mapa-casa','mapa-gym','clave-no-compartir','proyecto-privado','clave-firebase','Dirección oficina','Dirección ensayo','mapa-pegado','google.com/maps']) assert.ok(!plain.markdown.includes(privateValue), privateValue);
  assert.match(plain.markdown, /enlace de ubicación omitido/);
  assert.match(buildWeeklyReport(reportBackup, '2026-10-12', { includeName: true }).markdown, /Nombre privado/);
});

test('agenda describes proposals and exact saved marks without asserting real sleep or creatine intake', () => {
  const report = buildWeeklyReport(backup({
    settings: { ...defaults, scheduleEnabled: true, breakfastCreatine: true, mondayEveningEnabled: true },
    overrides: { '2026-10-12': { skipPewen: true } },
    done: { '2026-10-12:meal-breakfast': true, '2026-10-12:old-block': true, '2026-10-19:meal-breakfast': true },
  }), '2026-10-12');
  assert.equal(report.blockMarks, 2);
  assert.match(report.markdown, /Desayuno, creatina y prepararte\*\* — Marcado hecho/);
  assert.match(report.markdown, /marcar el desayuno no confirma por separado haber tomado creatina/i);
  assert.match(report.markdown, /No son horas reales de sueño/);
  assert.match(report.markdown, /Despertar propuesto/);
  assert.match(report.markdown, /este lunes no voy a Pewen; no se traslada/);
  assert.doesNotMatch(report.markdown, /Creatina tomada|Dormiste \d|horas dormidas:/);
});

test('GTD is a current snapshot, not weekly completions; trash and optional tasks are excluded', () => {
  const reportBackup = backup({
    tasks: { done: { id: 'done', title: 'Hecha en otra fecha', status: 'done', updatedAt: '2026-10-18T12:00:00Z' }, waiting: { id: 'waiting', title: 'Esperar respuesta', status: 'waiting', waitingFor: 'Respuesta del equipo', notes: 'Volver a consultar', projectId: 'p' }, trash: { id: 'trash', title: 'Elemento descartado privado', status: 'trash' } },
    projects: { p: { id: 'p', title: 'Proyecto actual', outcome: 'Resultado claro', archived: false } },
  });
  const report = buildWeeklyReport(reportBackup, '2026-10-18');
  assert.match(report.markdown, /“Hecho” no significa “terminado durante esta semana”/);
  assert.match(report.markdown, /Hecha en otra fecha/);
  assert.match(report.markdown, /Respuesta del equipo/);
  assert.match(report.markdown, /Resultado claro/);
  assert.doesNotMatch(report.markdown, /Elemento descartado privado|2026-10-18T12:00:00Z/);
  assert.doesNotMatch(buildWeeklyReport(reportBackup, '2026-10-18', { includeTasks: false }).markdown, /Hecha en otra fecha|Esperar respuesta|Proyecto actual/);
});

test('night advice belongs to the following morning, including the Monday outside the report range', () => {
  const report = buildWeeklyReport(backup({
    settings: { ...defaults, scheduleEnabled: true, sleepHours: 8, gymDays: [2,3,4,5,6] },
  }), '2026-10-18');
  const sunday = report.markdown.split('### domingo, 18 de octubre de 2026 · Semana A')[1];
  assert.match(sunday, /Acostarse para el próximo día: \*\*2026-10-18 a las 22:45\*\*/);
  assert.match(sunday, /Despertar propuesto del día siguiente \(2026-10-19\): \*\*06:45\*\*/);
  assert.match(report.markdown, /Acostarse propuesto para la noche anterior/);
  const midnight = buildWeeklyReport(backup({ settings: { ...defaults, scheduleEnabled: true, sleepHours: 8 }, overrides: { '2026-10-13': { schoolClosed: true, care: 'other', dropoff: 'other', pickup: 'other' } } }), '2026-10-12');
  assert.match(midnight.markdown, /Acostarse para el próximo día: \*\*2026-10-13 a las 00:00\*\*/);
});

function loggedGym(id,date,loadKg,now){
  let session=training.createTrainingSession({id,date,week:1,day:1,now});
  session=training.updateTrainingSet(session,0,'s0',{loadKg:10,reps:8});
  session=training.completeTrainingSet(session,0,'s0',now+500);
  session=training.updateTrainingSet(session,0,'s1',{loadKg,reps:10});
  session=training.completeTrainingSet(session,0,'s1',now+1000);
  return training.finishTrainingSession(session,now+120000);
}
test('reporte incluye series reales, aproximaciones y carga anterior de la misma variante sin contar precargas',()=>{
  const prior=loggedGym('prior','2026-10-11',20,10000);
  let current=training.createTrainingSession({id:'current',date:'2026-10-13',week:2,day:1,now:200000});
  current=training.updateTrainingSet(current,0,'s0',{loadKg:10,reps:8});
  current=training.completeTrainingSet(current,0,'s0',201000);
  current=training.updateTrainingSet(current,0,'s1',{loadKg:22.5,reps:10});
  current=training.completeTrainingSet(current,0,'s1',202000);
  current=training.updateTrainingSet(current,0,'s2',{loadKg:99,reps:12});
  current.exercises[0].rpe=7.5;current.exercises[0].discomfort=0;current.exercises[0].notes='Con control https://share.google/privado';
  current=training.finishTrainingSession(current,320000);
  const report=buildWeeklyReport(backup({gymSessions:{prior,current},done:{'2026-10-14:gym':true}}),'2026-10-18');
  assert.equal(report.trainingSessions,1);
  const gym=report.markdown.split('## Entrenamiento · registros guardados')[1];
  assert.match(gym,/Series efectivas completadas: \*\*1\*\*/);
  assert.match(gym,/Aproximaciones completadas: \*\*1\*\*/);
  assert.match(gym,/S0 · Aproximación: \*\*10 kg\*\* · 8 repeticiones/);
  assert.match(gym,/S1 · Serie efectiva: \*\*22,5 kg\*\* · 10 repeticiones/);
  assert.match(gym,/Diferencia: \*\*\+2,5 kg\*\*/);
  assert.match(gym,/RPE elegido: 7,5\/10/);
  assert.match(gym,/Molestia elegida: 0\/10/);
  assert.match(gym,/enlace de ubicación omitido/);
  assert.doesNotMatch(gym,/99 kg|share\.google/);
});

test('reporte distingue borradores, parciales y antiguos importados sin inventar hechos',()=>{
  const draft=training.createTrainingSession({id:'draft',date:'2026-10-13',week:1,day:2,now:10000});
  draft.exercises[0].sets[1].loadKg=40;
  const partial={...loggedGym('partial','2026-10-14',15,200000),status:'abandoned'};
  const imported={...training.createTrainingSession({id:'old',date:'2026-10-15',week:1,day:3,now:400000}),status:'imported',activeStartedAt:null};
  imported.exercises[0].sets[1].loadKg=60;
  const report=buildWeeklyReport(backup({gymSessions:{draft,partial,old:imported}}),'2026-10-18');
  assert.equal(report.trainingSessions,1);
  assert.match(report.markdown,/Estado:\*\* En curso/);
  assert.match(report.markdown,/Estado:\*\* Cerrada parcial/);
  assert.match(report.markdown,/Estado:\*\* Historial importado/);
  assert.match(report.markdown,/repeticiones y segundos sin registro/);
  assert.doesNotMatch(report.markdown,/\*\*40 kg\*\*/);
  const empty=buildWeeklyReport(backup({done:{'2026-10-13:gym':true}}),'2026-10-18');
  assert.equal(empty.trainingSessions,0);
  assert.match(empty.markdown,/No hay sesiones de gimnasio registradas/);
  const undated={...imported,legacyDateUnknown:true};
  const unknown=buildWeeklyReport(backup({gymSessions:{old:undated}}),'2026-10-18');
  assert.match(unknown.markdown,/registros importados sin fecha de entrenamiento verificable/);
  assert.doesNotMatch(unknown.markdown,/\*\*60 kg\*\*/);
});
