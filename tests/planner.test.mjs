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
const { defaults, buildDay, isoDate, addDays, formatTime, weekForDate, normalizeMapsUrl } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
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

test('lunes A y B permanecen en destino hasta ensayo 16:30–20 y regresan después, sin entrenamiento lunes o domingo', () => {
  const config = settings({mondayEveningEnabled:true, mondayEveningName:'Ensayo de orquesta', mondayReturnCompanion:'mi acompañante', gymDays:[2,3,4,5,6]});
  for (const date of ['2026-10-19','2026-10-26']) {
    const day = buildDay(date, config, {}, []);
    const rehearsal = day.events.find(e => e.id === 'monday-rehearsal');
    assert.equal(rehearsal.title, 'Ensayo de orquesta');
    assert.equal(rehearsal.start, 990);
    assert.equal(rehearsal.end, 1200);
    assert.equal(rehearsal.fixed, true);
    assert.equal(rehearsal.tentative, false, 'el fin laboral desconocido no vuelve tentativo el ensayo confirmado');
    const back = day.events.find(e => e.id === 'cordoba-back');
    assert.equal(back.start, 1200);
    assert.equal(back.end, 1260);
    assert.equal(back.tentative, true);
    assert.match(back.detail, /mi acompañante/);
    assert.equal(day.events.some(e => e.id.startsWith('gym')), false);
    assert.ok(day.pending.some(p => p.includes('terminás de trabajar')));
    assert.ok(day.pending.some(p => p.includes('traslado entre el trabajo y el ensayo')));
    assert.equal(day.events.filter(e => e.kind === 'meal').length, 4, 'se conserva la comida en destino antes del ensayo');
  }
  for (const date of ['2026-10-18','2026-10-25']) assert.equal(buildDay(date, config, {}, []).events.some(e => e.id.startsWith('gym')), false);
  const confirmed = buildDay('2026-10-19', {...config,mondayReturnTravelConfirmed:true}, {}, []);
  assert.equal(confirmed.events.find(e => e.id === 'cordoba-back').tentative, false);
  assert.equal(confirmed.pending.some(p => p.includes('Regreso después del ensayo')), false);
});

test('el lunes con ensayo protege permanencia fuera de casa y detecta un fin laboral incompatible', () => {
  const config = settings({mondayEveningEnabled:true, cordobaWorkMin:300, gymDurationMin:30, gymTravelMin:0, showerMin:0});
  const day = buildDay('2026-10-19', config, {}, []);
  for (const event of day.events.filter(e => e.id.startsWith('gym'))) assert.ok(event.end <= 470 || event.start >= 1260, 'el hueco entre trabajo y ensayo no es un regreso a casa');
  const overlap = buildDay('2026-10-19', {...config,cordobaWorkMin:600,mondayEveningTravelMin:15}, {}, []);
  assert.equal(overlap.events.find(e => e.id === 'monday-rehearsal').conflict, true);
  assert.equal(overlap.events.find(e => e.id === 'monday-rehearsal-out').start, 975);
  assert.ok(overlap.warnings.some(w => w.includes('Se superponen') && w.includes('Ensayo')));
});

test('configuración anterior conserva el regreso laboral y no activa ensayo nuevo', () => {
  const legacy = settings();
  for (const field of ['mondayEveningEnabled','mondayEveningName','mondayEveningStart','mondayEveningEnd','mondayEveningTravelMin','mondayReturnCompanion','mondayReturnTravelConfirmed','mealPrepTuesdayStart','mealPrepFridayStart']) delete legacy[field];
  const monday = buildDay('2026-10-19', legacy, {}, []);
  assert.equal(monday.events.some(e => e.id === 'monday-rehearsal'), false);
  assert.equal(monday.events.find(e => e.id === 'cordoba-back').start, 930);
  for (const value of ['true','false',1]) assert.equal(buildDay('2026-10-19', {...legacy,mondayEveningEnabled:value}, {}, []).events.some(e => e.id === 'monday-rehearsal'), false);
});

test('un lunes A sin Pewen reserva entrenamiento 08:15, conserva ensayo y no recupera la jornada otros días', () => {
  const config = settings({mondayEveningEnabled:true,mondayEveningName:'La orquesta',mondayReturnCompanion:'Acompañante',gymDays:[2,3,4,5,6],mealPrepTuesdayStart:'10:30',mealPrepFridayStart:'10:30'});
  const overrides = {'2026-10-26':{skipPewen:true}};
  const day = buildDay('2026-10-26',config,overrides,[]);
  assert.equal(day.events.some(e => e.id === 'cordoba-out' || e.id.startsWith('cordoba-work') || e.id === 'cordoba-buffer'),false);
  assert.equal(day.events.find(e => e.id === 'gym').start,495);
  assert.equal(day.events.find(e => e.id === 'gym').end,570);
  assert.equal(day.events.find(e => e.id === 'gym').fixed,false);
  assert.equal(day.wakeTime,450,'despertar07:30 para desayuno20+10margen y salir08:00');
  assert.equal(day.events.find(e => e.id === 'monday-rehearsal-out').start,960);
  assert.equal(day.events.find(e => e.id === 'monday-rehearsal-out').end,1020);
  assert.equal(day.events.find(e => e.id === 'monday-rehearsal-out').tentative,false);
  assert.match(day.events.find(e => e.id === 'monday-rehearsal-out').detail,/Colectivo desde Carlos Paz/);
  assert.equal(day.events.find(e => e.id === 'monday-rehearsal').start,1020);
  assert.equal(day.events.find(e => e.id === 'monday-rehearsal').end,1200);
  assert.match(day.events.find(e => e.id === 'monday-rehearsal').detail,/comienza a las 16:30; hoy llegás a las 17:00 por acuerdo/);
  assert.equal(day.events.find(e => e.id === 'meal-snack').start,945);
  assert.equal(day.events.find(e => e.id === 'meal-snack').end,960);
  assert.equal(day.events.find(e => e.id === 'cordoba-back').start,1200);
  assert.equal(day.events.find(e => e.id === 'cordoba-back').end,1260);
  assert.match(day.events.find(e => e.id === 'cordoba-back').detail,/Acompañante/);
  assert.equal(day.events.filter(e => e.kind === 'meal').length,4);
  for (const e of day.events) assert.equal(e.conflict,undefined,`${e.title}: no debe haber cruces`);
  assert.equal(day.pending.some(p => p.includes('terminás de trabajar')),false);
  assert.equal(day.pending.some(p => p.includes('desde casa al ensayo')),false,'el viaje en colectivo 16–17 ya está acordado');
  for (const date of ['2026-10-28','2026-10-30']) assert.deepEqual(buildDay(date,config,overrides,[]),buildDay(date,config,{},[]),'miércoles y viernes conservan sus compromisos sin recibir Pewen');
  assert.ok(buildDay('2026-11-02',config,overrides,[]).events.some(e => e.id === 'cordoba-out'),'el lunes siguiente conserva Pewen');
});

test('un lunes B sin Pewen conserva jardín y regreso y acomoda entrenamiento08:35 con aviso', () => {
  const day = buildDay('2026-10-19',settings({mondayEveningEnabled:true,gymDays:[2,3,4,5,6]}),{'2026-10-19':{skipPewen:true}},[]);
  assert.equal(day.wakeTime,405);
  assert.equal(day.events.find(e => e.id === 'school-out').start,435);
  assert.equal(day.events.find(e => e.id === 'school-dropoff').start,465);
  assert.equal(day.events.find(e => e.id === 'school-back').start,470);
  assert.equal(day.events.find(e => e.id === 'school-back').end,500);
  assert.equal(day.events.find(e => e.id === 'gym').start,515,'se esperan los viajes del jardín antes de salir a entrenar');
  assert.equal(day.events.find(e => e.id === 'gym').end,590);
  for (const gym of day.events.filter(e => e.id.startsWith('gym'))) {
    assert.equal(gym.conflict,undefined);
    for (const fixed of day.events.filter(e => e.fixed)) assert.equal(intersects(gym,fixed),false);
  }
  assert.ok(day.warnings.some(w => w.includes('08:15 no son posibles') && w.includes('jardín') && w.includes('08:35')));
  assert.equal(day.events.filter(e => e.kind === 'meal').length,4);
  assert.equal(day.events.some(e => e.id === 'cordoba-out'),false);
});

test('un lunes sin Pewen y sin espacio para entrenar avisa en lugar de superponer cuidados', () => {
  const day=buildDay('2026-10-26',settings({mondayEveningEnabled:true,gymDays:[2,3,4,5,6]}),{'2026-10-26':{skipPewen:true,care:'me'}},[]);
  assert.equal(day.events.some(e=>e.id.startsWith('gym')),false);
  assert.ok(day.warnings.some(w=>w.startsWith('Entrenamiento: no hay un hueco real de 120 min')));
  assert.ok(day.events.some(e=>e.id==='monday-rehearsal'),'el ensayo se conserva y señala su propio conflicto de cuidado');
});

test('la salida al ensayo sin trabajo es editable y no cambia el lunes normal', () => {
  const config=settings({mondayEveningEnabled:true,mondaySoloDeparture:'15:45',mondaySoloArrival:'16:45'});
  const day=buildDay('2026-10-26',config,{'2026-10-26':{skipPewen:true}},[]);
  assert.equal(day.events.find(e=>e.id==='monday-rehearsal-out').start,945);
  assert.equal(day.events.find(e=>e.id==='monday-rehearsal-out').end,1005);
  assert.equal(day.events.find(e=>e.id==='monday-rehearsal').start,1005);
  assert.equal(buildDay('2026-10-26',config,{},[]).events.find(e=>e.id==='monday-rehearsal').start,990);
  const invalid=buildDay('2026-10-26',{...config,mondaySoloDeparture:'99:99',mondaySoloArrival:null},{'2026-10-26':{skipPewen:true}},[]);
  assert.equal(invalid.events.find(e=>e.id==='monday-rehearsal-out').start,960);
  assert.equal(invalid.events.find(e=>e.id==='monday-rehearsal').start,1020);
  const reversed=buildDay('2026-10-26',{...config,mondaySoloDeparture:'17:00',mondaySoloArrival:'16:00'},{'2026-10-26':{skipPewen:true}},[]);
  assert.ok(reversed.warnings.some(w=>w.includes('llegada del colectivo debe ser posterior')));
});

test('saltar Pewen solo se aplica el lunes y con un booleano verdadero', () => {
  const config = settings({gymDays:[2,3,4,5,6]});
  for (const skipPewen of ['true','false',1,false,null,undefined]) {
    assert.deepEqual(buildDay('2026-10-19',config,{'2026-10-19':{skipPewen}},[]),buildDay('2026-10-19',config,{},[]));
  }
  assert.deepEqual(buildDay('2026-10-21',config,{'2026-10-21':{skipPewen:true}},[]),buildDay('2026-10-21',config,{},[]));
  const withoutRehearsal = buildDay('2026-10-26',config,{'2026-10-26':{skipPewen:true}},[]);
  assert.equal(withoutRehearsal.events.some(e => e.id === 'cordoba-back' || e.id === 'monday-rehearsal'),false);
  assert.equal(withoutRehearsal.events.find(e => e.id === 'gym').start,495);
});

test('martes entrena 08:30–09:45 con viajes y ducha completos antes de cocinar 10:30',()=>{
  const config=settings({gymDays:[2,3,4,5,6],mealPrepTuesdayStart:'10:30',mealPrepFridayStart:'10:30'});
  for(const date of ['2026-10-13','2026-10-20']) {
    const day=buildDay(date,config);
    assert.equal(day.wakeTime,465,'07:45 permite desayuno y preparación de20min con10min de margen');
    assert.deepEqual(day.events.filter(event=>event.id.startsWith('gym')).map(event=>[event.id,event.start,event.end]),[
      ['gym-out',495,510],['gym',510,585],['gym-back',585,600],['gym-shower',600,615],
    ]);
    const cooking=day.events.find(event=>event.id==='meal-prep');
    assert.equal(cooking.start,630);assert.equal(cooking.end,720);
    assert.equal(day.events.find(event=>event.id==='pickup-out').start,750);
    for(const gym of day.events.filter(event=>event.id.startsWith('gym'))) {
      assert.equal(gym.conflict,undefined);
      for(const fixed of day.events.filter(event=>event.fixed)) assert.equal(intersects(gym,fixed),false,`${date}: ${fixed.title}`);
    }
    assert(!day.warnings.some(message=>message.includes('Entrenamiento del martes')));
  }
});

test('martes busca el hueco más cercano cuando Google cruza 08:30 y conserva cocina fija',()=>{
  const config=settings({gymDays:[2],mealPrepTuesdayStart:'10:30',mealPrepFridayStart:'10:30'});
  const date='2026-10-20';
  const google={id:'busy-morning',calendarId:'source@example.test',eventId:'appointment',title:'Turno temprano',date,startMin:480,endMin:600,allDay:false,busy:true,updatedAt:1};
  const day=buildDay(date,config,{[date]:{care:'other',dropoff:'other',pickup:'other'}},[],[google]);
  const gym=day.events.find(event=>event.id==='gym');
  assert(gym,'puede encontrar otro hueco completo con cobertura familiar');
  assert.notEqual(gym.start,510);
  assert.equal(gym.end-gym.start,config.gymDurationMin);
  assert.equal(day.events.find(event=>event.id==='meal-prep').start,630);
  assert.equal(day.events.filter(event=>event.id.startsWith('gym')).reduce((total,event)=>total+event.end-event.start,0),120);
  for(const event of day.events.filter(event=>event.id.startsWith('gym'))) {
    assert.equal(event.conflict,undefined);
    for(const fixed of day.events.filter(event=>event.fixed)) assert.equal(intersects(event,fixed),false,event.id);
  }
  assert(day.warnings.some(message=>message.includes('Entrenamiento del martes: las 08:30 no son posibles')&&message.includes(formatTime(gym.start))));
});

test('miércoles y viernes entrenan por la mañana después del regreso del jardín en semanas A y B', () => {
  const config = settings({gymDays:[2,3,4,5,6],mealPrepTuesdayStart:'10:30',mealPrepFridayStart:'10:30'});
  for (const date of ['2026-10-21','2026-10-23','2026-10-28','2026-10-30']) {
    const day = buildDay(date,config,{[date]:{pickup:'me'}},[]);
    assert.equal(day.events.find(event=>event.id==='school-dropoff').start,465);
    assert.equal(day.events.find(event=>event.id==='school-back').end,500);
    assert.equal(day.events.find(event=>event.id==='gym-out').start,500);
    assert.equal(day.events.find(event=>event.id==='gym').start,515,'08:35 después de volver a casa 08:20 y viajar 15 min');
    assert.equal(day.events.find(event=>event.id==='gym').end,590);
    assert.equal(day.events.find(event=>event.id==='gym-shower').end,620);
    assert.equal(day.events.find(event=>event.id==='pickup-out').start,750);
    assert.equal(day.wakeTime,405);
    for (const event of day.events.filter(event=>event.id.startsWith('gym'))) {
      assert.equal(event.conflict,undefined,date);
      for (const other of day.events.filter(other=>other.id!==event.id)) assert.equal(intersects(event,other),false,`${date}: ${event.id} / ${other.id}`);
    }
    if (date.endsWith('21') || date.endsWith('28')) {
      assert.equal(day.events.find(event=>event.id==='recording').start,900);
      assert.equal(day.events.find(event=>event.id==='recording').end,1080);
    } else {
      assert.equal(day.events.find(event=>event.id==='meal-prep').start,630);
      assert.equal(day.events.find(event=>event.id==='meal-prep').end,720);
    }
  }
  assert.equal(buildDay('2026-10-20',config).events.find(event=>event.id==='gym').start,510,'el martes conserva 08:30');
});

test('si otra persona lleva al jardín, miércoles y viernes conservan entrenamiento 08:30 y calculan la preparación', () => {
  const config=settings({gymDays:[3,5],mealPrepFridayStart:'10:30'});
  for (const date of ['2026-10-21','2026-10-23','2026-10-28','2026-10-30']) {
    const day=buildDay(date,config,{[date]:{dropoff:'other'}});
    assert.equal(day.events.some(event=>event.id.startsWith('school-')),false);
    assert.equal(day.events.find(event=>event.id==='gym').start,510);
    assert.equal(day.events.find(event=>event.id==='gym').end,585);
    assert.equal(day.wakeTime,465,'07:45 para desayuno, preparación y margen antes de salir 08:15');
    assert.equal(day.bedtimePrevious,1425);
    for (const event of day.events.filter(event=>event.id.startsWith('gym'))) assert.equal(event.conflict,undefined);
  }
  const noTraining=buildDay('2026-10-21',{...config,gymDays:[]},{'2026-10-21':{dropoff:'other'}});
  assert.equal(noTraining.wakeTime,480,'no anticipa el despertar si ese día se desactiva el entrenamiento');
});

test('la preferencia matutina no mueve el gimnasio a la tarde cuando Google o los cuidados ocupan la mañana', () => {
  const config=settings({gymDays:[3,5],mealPrepFridayStart:'10:30'});
  for (const date of ['2026-10-21','2026-10-23']) {
    const google={id:'busy-morning',calendarId:'source@example.test',eventId:'appointment',title:'Mañana ocupada',date,startMin:500,endMin:720,allDay:false,busy:true,updatedAt:1};
    const day=buildDay(date,config,{},[],[google]);
    assert.equal(day.events.some(event=>event.id.startsWith('gym')),false);
    assert(day.warnings.some(message=>message.includes('Entrenamiento: no hay un hueco real de 120 min por la mañana')&&message.includes('no se trasladó a la tarde')));
    assert.equal(day.events.find(event=>event.id==='google-busy-morning').start,500);
    assert.equal(day.events.find(event=>event.id==='google-busy-morning').end,720);
    assert.equal(day.events.find(event=>event.id=== (date.endsWith('21')?'recording':'meal-prep')).start,date.endsWith('21')?900:630);
    for (const override of [{care:'me'},{schoolClosed:true}]) {
      const covered=buildDay(date,config,{[date]:override});
      assert.equal(covered.events.some(event=>event.id.startsWith('gym')),false);
      assert(covered.warnings.some(message=>message.includes('Entrenamiento: no hay un hueco real')));
    }
  }
});

test('un compromiso temprano desplaza el gimnasio dentro de la mañana con aviso y conserva toda la sesión', () => {
  const date='2026-10-21';
  const extra={id:'turno',title:'Turno temprano',date,startHHmm:'08:20',durationMin:40,travelMin:0,kind:'personal'};
  const day=buildDay(date,settings({gymDays:[3]}),{},[extra]);
  assert.equal(day.events.find(event=>event.id==='gym').start,555);
  assert.equal(day.events.find(event=>event.id==='gym').end,630);
  assert.equal(day.events.find(event=>event.id==='gym-shower').end,660);
  assert(day.warnings.some(message=>message.includes('Entrenamiento del miércoles')&&message.includes('09:15')));
  for (const event of day.events.filter(event=>event.id.startsWith('gym'))) assert.equal(event.conflict,undefined);
});

test('martes no invade cuidado ni acorta la sesión si la mañana no alcanza y no anticipa días desactivados',()=>{
  const date='2026-10-20';
  const config=settings({gymDays:[2],mealPrepTuesdayStart:'10:30'});
  const busy={id:'busy-morning',calendarId:'source@example.test',eventId:'appointment',title:'Compromiso de mañana',date,startMin:480,endMin:630,allDay:false,busy:true,updatedAt:1};
  const closed=buildDay(date,config,{},[],[busy]);
  assert.equal(closed.events.some(event=>event.id.startsWith('gym')),false);
  assert(closed.warnings.some(message=>message.includes('Entrenamiento: no hay un hueco real de 120 min')));
  const noGym=buildDay(date,{...config,gymDays:[]});
  assert.equal(noGym.wakeTime,480);
  assert.equal(noGym.events.some(event=>event.id.startsWith('gym')),false);
});

test('creatina acompaña el mismo desayuno cada mañana, sin añadir tiempos ni una dosis', () => {
  for (const breakfastInPreparation of [true,false]) {
    for (let n=0;n<14;n++) {
      const date=addDays('2026-10-19',n);
      const baseline=buildDay(date,settings({breakfastInPreparation}),{},[]);
      const day=buildDay(date,settings({breakfastInPreparation,breakfastCreatine:true,hasBlender:true,hasHandBlender:true}),{},[]);
      assert.equal(day.wakeTime,baseline.wakeTime);
      assert.deepEqual(day.events.map(e=>[e.id,e.start,e.end]),baseline.events.map(e=>[e.id,e.start,e.end]));
      const breakfasts=day.events.filter(e=>e.id==='meal-breakfast');
      assert.equal(breakfasts.length,1);
      assert.match(breakfasts[0].title,/creatina/);
      assert.match(breakfasts[0].detail,/junto al desayuno/);
      assert.doesNotMatch(breakfasts[0].detail,/\d+\s*(g|mg|gramos)\b/);
    }
  }
  for (const breakfastCreatine of ['true','false',1]) assert.doesNotMatch(buildDay('2026-10-19',settings({breakfastCreatine}),{},[]).events.find(e=>e.id==='meal-breakfast').title,/creatina/);
});

test('mapas y electrodomésticos empiezan vacíos y los enlaces rechazan protocolos activos y credenciales', () => {
  for (const key of ['breakfastCreatine','hasBlender','hasHandBlender']) assert.equal(defaults[key],false);
  for (const key of ['homeMapsUrl','gymMapsUrl','workMapsUrl','mondayRehearsalMapsUrl']) assert.equal(defaults[key],'');
  assert.equal(normalizeMapsUrl(' https://share.google/example '),'https://share.google/example');
  for (const url of ['javascript:alert(1)','data:text/html,hello','http://example.com','https://user:password@example.com','https://example.com/'+ 'a'.repeat(2000),'bad',null,42]) assert.equal(normalizeMapsUrl(url),'');
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

test('las dos tandas de cocina fijas se reservan antes del gimnasio y trabajo sin duplicarse', () => {
  const config = settings({mealPrepTuesdayStart:'10:30',mealPrepFridayStart:'10:30',gymDays:[2,3,4,5,6]});
  for (const date of ['2026-10-20','2026-10-23','2026-10-27','2026-10-30']) {
    const day = buildDay(date, config, {}, []);
    const cooking = day.events.filter(e => e.id === 'meal-prep');
    assert.equal(cooking.length, 1);
    assert.equal(cooking[0].start, 630);
    assert.equal(cooking[0].end, 720);
    assert.equal(cooking[0].fixed, true);
    assert.equal(cooking[0].conflict, undefined);
    assert.match(cooking[0].detail, /horario fijo elegido por vos/);
    for (const event of day.events.filter(e => e.id.startsWith('gym') || e.id.startsWith('flex-work'))) assert.equal(intersects(cooking[0], event), false);
  }
});

test('la cocina fija conserva su horario y avisa conflictos de compromisos y cuidado', () => {
  const config = settings({mealPrepTuesdayStart:'10:30'});
  const extra = {id:'turno',title:'Turno',date:'2026-10-20',startHHmm:'11:00',durationMin:30,travelMin:0,kind:'personal'};
  const clash = buildDay('2026-10-20', config, {}, [extra]);
  assert.equal(clash.events.find(e => e.id === 'meal-prep').start, 630);
  assert.equal(clash.events.find(e => e.id === 'meal-prep').conflict, true);
  assert.ok(clash.warnings.some(w => w.includes('Se superponen') && w.includes('Turno')));
  const care = buildDay('2026-10-20', {...config,mealPrepTuesdayStart:'14:00'}, {}, []);
  assert.equal(care.events.find(e => e.id === 'meal-prep').start, 840);
  assert.equal(care.events.find(e => e.id === 'meal-prep').conflict, true);
  const permitted = buildDay('2026-10-20', {...config,mealPrepTuesdayStart:'14:00',cookingWithChild:true}, {}, []);
  assert.equal(permitted.events.find(e => e.id === 'meal-prep').conflict, undefined);
  assert.match(permitted.events.find(e => e.id === 'meal-prep').detail, /habilitado por vos/);
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
