import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const transpile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const data = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const plannerUrl = data(transpile(await fs.readFile(new URL('../src/lib/planner.ts',import.meta.url),'utf8')));
const planner = await import(plannerUrl);
const sleepUrl = data(transpile(await fs.readFile(new URL('../src/lib/sleep.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`));
const alarmsSource = transpile(await fs.readFile(new URL('../src/lib/alarms.ts',import.meta.url),'utf8'));
let moduleId=0;
async function api(plugin={}) {
  globalThis.__alarmPlugin=plugin;
  const source=alarmsSource.replace(/import\s*\{[^}]+\}\s*from\s*['"]@capacitor\/core['"];?/, 'const Capacitor={isNativePlatform:()=>false,getPlatform:()=>"web"}; const registerPlugin=()=>globalThis.__alarmPlugin;').replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`).replace(/from ['"]\.\/sleep['"]/,`from '${sleepUrl}'`);
  return import(data(source)+`#${++moduleId}`);
}
const alarms=await api();
const settings = {...planner.defaults,scheduleEnabled:true,familyConfirmed:true,cordobaConfirmed:true,recordingConfirmed:true,preparationConfirmed:true};
const localEpoch = (day,hour=0,minute=0) => new Date(2026,9,day,hour,minute).getTime();
// Existing cases isolate the alarm type under test; training-end has its own enabled-by-default cases below.
const prefs = patch => ({...alarms.defaultAlarmPreferences(),trainingEnd:false,...patch});

test('alarma del lunes B usa el despertar calculado de las 06:45',()=>{
  const batch=alarms.buildAlarmBatch({settings,preferences:prefs({wake:true}),now:localEpoch(19)});
  assert.equal(batch.preview[0].key,'wake:2026-10-19');
  assert.equal(batch.preview[0].at,localEpoch(19,6,45));
  assert.equal(batch.preview[0].kind,'wake');
  assert.equal(batch.notifications.length,14);
  assert.equal(batch.through,'2026-11-01');
});

test('acostarse del domingo usa las 22:45 reales del domingo antes del lunes B, sin adelanto de agenda',()=>{
  const preferences=prefs({bedtime:true,beforeMin:60,categories:[]});
  const batch=alarms.buildAlarmBatch({settings,preferences,now:localEpoch(18)});
  const first=batch.preview.find(alarm=>alarm.key==='bedtime:2026-10-19');
  assert.equal(first.at,localEpoch(18,22,45));
  assert.equal(first.kind,'reminder');
  assert.equal(first.source,'bedtime');
  assert.match(first.body,/06:45/);
  assert(batch.preview.every(alarm=>['bedtime','bedtime-prepare'].includes(alarm.source)));
  const changed=alarms.buildAlarmBatch({settings:{...settings,sleepHours:7},preferences,now:localEpoch(18)}).preview.find(alarm=>alarm.key===first.key);
  assert.equal(changed.at,localEpoch(18,23,45));
  assert.equal(changed.id,first.id,'el aviso del mismo despertar se actualiza sin acumular otro ID');
});

test('cada noche tiene dos fases separadas por 45 minutos y ambas usan el tono de recordatorio',()=>{
  const preferences=prefs({bedtime:true,beforeMin:60,categories:[]});
  const batch=alarms.buildAlarmBatch({settings,preferences,now:localEpoch(18)});
  const sleep=batch.preview.find(alarm=>alarm.key==='bedtime:2026-10-19');
  const prepare=batch.preview.find(alarm=>alarm.key==='bedtime-prepare:2026-10-19');
  assert.equal(prepare.at,localEpoch(18,22,0));
  assert.equal(sleep.at-prepare.at,45*60000);
  assert.equal(prepare.kind,'reminder');assert.equal(sleep.kind,'reminder');
  assert.notEqual(prepare.id,sleep.id);
  assert.match(prepare.body,/45 min.*22:45/);
  for(const night of batch.preview.filter(alarm=>alarm.source==='bedtime')) {
    const earlier=batch.preview.find(alarm=>alarm.key===night.key.replace('bedtime:','bedtime-prepare:'));
    if(earlier)assert.equal(night.at-earlier.at,45*60000);
  }
  const changed=alarms.buildAlarmBatch({settings:{...settings,sleepHours:7},preferences,now:localEpoch(18)});
  for(const before of [sleep,prepare]) {
    const after=changed.preview.find(alarm=>alarm.key===before.key);
    assert.equal(after.id,before.id);assert.equal(after.at,before.at+60*60000);
  }
});

test('prepararse para una hora después de medianoche cae en la fecha anterior y no vuelve a sonar si ya pasó',()=>{
  const config={...settings,sleepHours:7.5};
  const batch=alarms.buildAlarmBatch({settings:config,preferences:prefs({bedtime:true}),now:localEpoch(23,23,30)});
  const prepare=batch.preview.find(alarm=>alarm.key==='bedtime-prepare:2026-10-24');
  const sleep=batch.preview.find(alarm=>alarm.key==='bedtime:2026-10-24');
  assert.equal(prepare.at,localEpoch(23,23,45));assert.equal(sleep.at,localEpoch(24,0,30));
  const later=alarms.buildAlarmBatch({settings:config,preferences:prefs({bedtime:true}),now:localEpoch(24,0,10)});
  assert(!later.preview.some(alarm=>alarm.key===prepare.key));
  assert.equal(later.preview.find(alarm=>alarm.key===sleep.key).id,sleep.id);
});

test('el último día del horizonte incluye la preparación aunque acostarse ya caiga fuera del rango',()=>{
  const config={...settings,sleepHours:7.5};
  const batch=alarms.buildAlarmBatch({settings:config,preferences:prefs({bedtime:true}),now:localEpoch(11,12)});
  assert.equal(batch.through,'2026-10-24');
  assert.equal(batch.preview.find(alarm=>alarm.key==='bedtime-prepare:2026-10-25').at,localEpoch(24,23,45));
  assert(!batch.preview.some(alarm=>alarm.key==='bedtime:2026-10-25'));
  assert(batch.preview.every(alarm=>planner.isoDate(new Date(alarm.at))>= '2026-10-11'&&planner.isoDate(new Date(alarm.at))<=batch.through));
});

test('apagar la rutina nocturna elimina las dos fases sin cambiar el despertador ni las alarmas puntuales',()=>{
  const preferences=prefs({wake:true,bedtime:true,custom:[{id:'custom',title:'Personal',date:'2026-10-20',time:'12:00',kind:'wake'}]});
  const on=alarms.buildAlarmBatch({settings,preferences,now:localEpoch(19)});
  const off=alarms.buildAlarmBatch({settings,preferences:{...preferences,bedtime:false},now:localEpoch(19)});
  assert(on.preview.some(alarm=>alarm.source==='bedtime-prepare'));
  assert(off.preview.every(alarm=>!alarm.source.startsWith('bedtime')));
  assert.deepEqual(off.notifications,on.preview.filter(alarm=>!alarm.source.startsWith('bedtime')).map(({id,at,title,body,kind})=>({id,at,title,body,kind})));
});

test('acostarse después de medianoche conserva la fecha y se encuentra al abrir la app ya pasada medianoche',()=>{
  const config={...settings,sleepHours:7.5};
  const beforeMidnight=alarms.buildAlarmBatch({settings:config,preferences:prefs({bedtime:true}),now:localEpoch(23,23,50)});
  const afterMidnight=alarms.buildAlarmBatch({settings:config,preferences:prefs({bedtime:true}),now:localEpoch(24,0,10)});
  const before=beforeMidnight.preview.find(alarm=>alarm.key==='bedtime:2026-10-24');
  const after=afterMidnight.preview.find(alarm=>alarm.key==='bedtime:2026-10-24');
  assert.equal(before.at,localEpoch(24,0,30));
  assert.equal(after.at,before.at);
  assert.equal(after.id,before.id);
  assert(afterMidnight.preview.every(alarm=>planner.isoDate(new Date(alarm.at))<=afterMidnight.through));
  const disabled=alarms.buildAlarmBatch({settings:{...config,scheduleEnabled:false},preferences:prefs({bedtime:true}),now:localEpoch(24,0,10)});
  assert.equal(disabled.notifications.length,0);
  assert.equal(alarms.buildAlarmBatch({settings:config,preferences:prefs(),now:localEpoch(24,0,10)}).notifications.length,0);
});

test('excluye avisos pasados, bloques de cuidado y compromisos completados',()=>{
  const before=alarms.buildAlarmBatch({settings,preferences:prefs({agenda:true,beforeMin:0}),now:localEpoch(19,7,20)});
  assert(before.preview.length>0);
  assert(before.preview.every(alarm=>alarm.at>localEpoch(19,7,20) && !alarm.key.includes('care-')));
  assert(!before.preview.some(alarm=>alarm.key==='agenda:2026-10-19:school-out'));
  assert(before.preview.some(alarm=>alarm.key==='agenda:2026-10-19:school-dropoff'));
  const done=alarms.buildAlarmBatch({settings,preferences:prefs({agenda:true,beforeMin:0}),now:localEpoch(19,7,20),done:{'2026-10-19:school-dropoff':true}});
  assert(!done.preview.some(alarm=>alarm.key==='agenda:2026-10-19:school-dropoff'));
});

test('creatina avisa una vez por desayuno, sin adelanto ni categorías de agenda, también en descanso',()=>{
  for(const breakfastInPreparation of [true,false]) {
    const config={...settings,breakfastCreatine:true,breakfastInPreparation,gymDays:[2,3,4,5,6]};
    const batch=alarms.buildAlarmBatch({settings:config,preferences:prefs({creatine:true,beforeMin:60,categories:[]}),now:localEpoch(19)});
    assert.equal(batch.preview.length,14);
    assert(batch.preview.every(alarm=>alarm.source==='creatine' && alarm.kind==='reminder'));
    assert.equal(new Set(batch.preview.map(alarm=>alarm.key)).size,14);
    for(const alarm of batch.preview) {
      const date=alarm.key.slice('creatine:'.length);
      const breakfast=planner.buildDay(date,config,{},[]).events.find(event=>event.id==='meal-breakfast');
      assert.equal(alarm.at,alarms.alarmEpoch(date,planner.formatTime(breakfast.start)));
      assert.equal(alarm.title,'Creatina con el desayuno');
    }
    assert(batch.preview.some(alarm=>alarm.key==='creatine:2026-10-25'));
  }
});

test('creatina respeta el desayuno completado y los tres interruptores de agenda, rutina y aviso',()=>{
  const config={...settings,breakfastCreatine:true};
  const preferences=prefs({creatine:true});
  const batch=alarms.buildAlarmBatch({settings:config,preferences,now:localEpoch(19),done:{'2026-10-19:meal-breakfast':true}});
  assert.equal(batch.preview.length,13);
  assert(!batch.preview.some(alarm=>alarm.key==='creatine:2026-10-19'));
  for(const patch of [{scheduleEnabled:false},{breakfastCreatine:false}]) {
    assert.equal(alarms.buildAlarmBatch({settings:{...config,...patch},preferences,now:localEpoch(19)}).notifications.length,0);
  }
  assert.equal(alarms.buildAlarmBatch({settings:config,preferences:prefs(),now:localEpoch(19)}).notifications.length,0);
  const afterBreakfast=alarms.buildAlarmBatch({settings:config,preferences,now:localEpoch(19,8)});
  assert(!afterBreakfast.preview.some(alarm=>alarm.key==='creatine:2026-10-19'));
});

test('los IDs permanecen estables al agregar otra alarma o avanzar el reloj',()=>{
  const preferences=prefs({wake:true,agenda:true});
  const first=alarms.buildAlarmBatch({settings,preferences,now:localEpoch(19)});
  const second=alarms.buildAlarmBatch({settings,preferences:{...preferences,custom:[{id:'added',title:'Puntual',date:'2026-10-20',time:'12:00',kind:'reminder'}]},now:localEpoch(19,6,50)});
  const known=new Map(first.preview.map(alarm=>[alarm.key,alarm.id]));
  for(const alarm of second.preview.filter(alarm=>alarm.source!=='custom'))assert.equal(alarm.id,known.get(alarm.key));
  assert.equal(new Set(second.notifications.map(alarm=>alarm.id)).size,second.notifications.length);
  assert(second.notifications.every(alarm=>Number.isInteger(alarm.id)&&alarm.id>0));
});

test('una alarma puntual futura no se pierde al renovar la agenda ni con la agenda apagada',()=>{
  const custom={id:'far',title:'Un turno futuro',date:'2026-12-20',time:'10:00',kind:'reminder'};
  const first=alarms.buildAlarmBatch({settings,preferences:prefs({wake:true,agenda:true,custom:[custom]}),now:localEpoch(19)});
  const renewed=alarms.buildAlarmBatch({settings:{...settings,scheduleEnabled:false},preferences:prefs({custom:[custom]}),now:localEpoch(25)});
  assert.equal(renewed.notifications.length,1);
  assert.equal(renewed.preview[0].id,first.preview.find(alarm=>alarm.source==='custom').id);
  assert.equal(renewed.preview[0].at,alarms.alarmEpoch(custom.date,custom.time));
});

test('el límite de 200 reserva las alarmas puntuales y conserva orden cronológico',()=>{
  const extras=Array.from({length:30},(_,index)=>({id:`extra-${index}`,title:`Evento ${index}`,days:[0,1,2,3,4,5,6],startHHmm:'12:00',durationMin:5,travelMin:0,kind:'personal'}));
  const batch=alarms.buildAlarmBatch({settings,extras,preferences:prefs({wake:true,agenda:true,custom:[{id:'far',title:'Puntual lejana',date:'2027-01-01',time:'10:00',kind:'wake'}]}),now:localEpoch(19)});
  assert.equal(batch.notifications.length,200);
  assert(batch.omitted>0);
  assert(batch.preview.some(alarm=>alarm.key==='custom:far'));
  assert(batch.preview.every((alarm,index)=>index===0||alarm.at>=batch.preview[index-1].at));
});

test('un exceso de compromisos no desplaza los despertares ni ninguna fase nocturna',()=>{
  const extras=Array.from({length:30},(_,index)=>({id:`extra-${index}`,title:`Evento ${index}`,days:[0,1,2,3,4,5,6],startHHmm:'12:00',durationMin:5,travelMin:0,kind:'personal'}));
  const preferences=prefs({wake:true,bedtime:true,agenda:true,custom:[{id:'far',title:'Puntual',date:'2027-01-01',time:'10:00',kind:'wake'}]});
  const full=alarms.buildAlarmBatch({settings,extras,preferences,now:localEpoch(19)});
  const protectedBatch=alarms.buildAlarmBatch({settings,extras,preferences:{...preferences,agenda:false},now:localEpoch(19)});
  assert.equal(full.notifications.length,200);assert(full.omitted>0);
  for(const expected of protectedBatch.preview) {
    const actual=full.preview.find(alarm=>alarm.key===expected.key);
    assert(actual,expected.key);assert.equal(actual.at,expected.at);assert.equal(actual.id,expected.id);
  }
});

test('la actualización Android activa una vez ambos avisos, conserva las demás elecciones y respeta apagarlos después',()=>{
  const items=new Map();globalThis.localStorage={getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};
  const key=scope=>'mi-vida.device-alarms.v1.'+encodeURIComponent(scope);
  const previous=prefs({wake:true,bedtime:false,creatine:true,beforeMin:7,custom:[{id:'turno',title:'Turno',date:'2026-11-01',time:'10:00',kind:'reminder'}]});
  items.set(key('project:A'),JSON.stringify(previous));
  const migrated=alarms.loadAlarmPreferences('project:A',true);
  assert.deepEqual(migrated,{...previous,bedtime:true});
  assert.equal(JSON.parse(items.get(key('project:A'))).bedtimeRoutineVersion,1);
  alarms.saveAlarmPreferences('project:A',{...migrated,bedtime:false});
  assert.equal(alarms.loadAlarmPreferences('project:A',true).bedtime,false);
  assert.equal(alarms.loadAlarmPreferences('project:B',true).bedtime,true);
  assert.equal(alarms.loadAlarmPreferences('project:B',true).wake,false);
  items.set(key('project:web'),JSON.stringify(previous));
  assert.equal(alarms.loadAlarmPreferences('project:web',false).bedtime,false);
  assert.equal(JSON.parse(items.get(key('project:web'))).bedtimeRoutineVersion,undefined);
});

test('ajustes locales separados por cuenta y valores importados estrictos',()=>{
  const items=new Map();globalThis.localStorage={getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};
  alarms.saveAlarmPreferences('project:A',prefs({wake:true,bedtime:true,creatine:true}));
  assert.equal(alarms.loadAlarmPreferences('project:A').wake,true);
  assert.equal(alarms.loadAlarmPreferences('project:A').creatine,true);
  assert.equal(alarms.loadAlarmPreferences('project:A').bedtime,true);
  assert.equal(alarms.loadAlarmPreferences('project:B').wake,false);
  assert.equal(alarms.loadAlarmPreferences('project:B').creatine,false);
  assert.equal(alarms.loadAlarmPreferences('project:B').bedtime,false);
  assert.equal(alarms.loadAlarmPreferences(null).wake,false);
  assert.equal(alarms.normalizeAlarmPreferences({wake:true,agenda:true}).creatine,false);
  assert.equal(alarms.normalizeAlarmPreferences({wake:true,agenda:true}).bedtime,false);
  const invalid=alarms.normalizeAlarmPreferences({wake:'true',bedtime:'true',agenda:1,creatine:'true',beforeMin:1000,categories:['care','work'],custom:[{id:'x',title:'Imposible',date:'2026-02-31',time:'10:00',kind:'wake'}]});
  assert.equal(invalid.wake,false);assert.equal(invalid.bedtime,false);assert.equal(invalid.agenda,false);assert.equal(invalid.creatine,false);assert.equal(invalid.beforeMin,60);
  assert.deepEqual(invalid.categories,['work']);assert.deepEqual(invalid.custom,[]);
});

test('el aviso de fin de entrenamiento se activa en ajustes anteriores y conserva una desactivación explícita por cuenta',()=>{
  const items=new Map();globalThis.localStorage={getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};
  const key=scope=>'mi-vida.device-alarms.v1.'+encodeURIComponent(scope);
  const previous={wake:true,bedtime:false,agenda:false,creatine:true,beforeMin:7,categories:['work'],custom:[],bedtimeRoutineVersion:1};
  items.set(key('project:old'),JSON.stringify(previous));
  const loaded=alarms.loadAlarmPreferences('project:old',true);
  assert.equal(alarms.defaultAlarmPreferences().trainingEnd,true);
  assert.equal(loaded.trainingEnd,true);
  assert.equal(loaded.wake,true);assert.equal(loaded.bedtime,false);assert.equal(loaded.creatine,true);
  assert.equal(loaded.beforeMin,7);assert.deepEqual(loaded.categories,['work']);
  alarms.saveAlarmPreferences('project:old',{...loaded,trainingEnd:false});
  assert.equal(alarms.loadAlarmPreferences('project:old',true).trainingEnd,false);
  assert.equal(alarms.loadAlarmPreferences('project:new',false).trainingEnd,true);
  assert.equal(alarms.normalizeAlarmPreferences({trainingEnd:false}).trainingEnd,false);
  assert.equal(alarms.normalizeAlarmPreferences({trainingEnd:'false'}).trainingEnd,true);
  assert.equal(alarms.normalizeAlarmPreferences({trainingEnd:0}).trainingEnd,true);
});

test('el fin de entrenamiento usa el fin de cada bloque real durante 14 días, sin agenda, categorías ni adelanto',()=>{
  const now=localEpoch(19),preferences=alarms.defaultAlarmPreferences(),config={...settings,gymDays:[2,3,4,5,6]};
  preferences.categories=[];preferences.beforeMin=60;
  const batch=alarms.buildAlarmBatch({settings:config,preferences,now});
  const expected=[];
  for(let offset=0;offset<14;offset++) {
    const date=planner.addDays('2026-10-19',offset);
    const gym=planner.buildDay(date,config,{},[]).events.find(event=>event.id==='gym');
    if(gym)expected.push({date,gym});
  }
  assert(expected.length>0);
  assert.equal(batch.preview.length,expected.length);
  assert.equal(batch.through,'2026-11-01');
  for(const {date,gym} of expected) {
    const alarm=batch.preview.find(value=>value.key===`training-end:${date}`);
    assert(alarm,date);
    assert.equal(alarm.source,'training-end');assert.equal(alarm.kind,'reminder');
    assert.equal(alarm.at,alarms.alarmEpoch(date,planner.formatTime(gym.end)));
    assert.match(alarm.body,new RegExp(planner.formatTime(gym.end)));
    assert.match(alarm.body,/no marca series ni el entrenamiento/);
  }
  assert(!batch.preview.some(alarm=>alarm.key==='training-end:2026-10-19'));
  assert(!batch.preview.some(alarm=>alarm.key==='training-end:2026-10-25'));
});

test('el fin de entrenamiento respeta el bloque completado, el reloj y los dos interruptores',()=>{
  const now=localEpoch(21),preferences=prefs({trainingEnd:true});
  const before=alarms.buildAlarmBatch({settings,preferences,now});
  const alarm=before.preview.find(value=>value.key==='training-end:2026-10-21');
  assert(alarm);
  const completed=alarms.buildAlarmBatch({settings,preferences,now,done:{'2026-10-21:gym':true}});
  assert(!completed.preview.some(value=>value.key===alarm.key));
  assert.deepEqual(completed.preview,before.preview.filter(value=>value.key!==alarm.key));
  const pending=alarms.buildAlarmBatch({settings,preferences,now,done:{'2026-10-21:gym':false}});
  assert(pending.preview.some(value=>value.key===alarm.key));
  const elapsed=alarms.buildAlarmBatch({settings,preferences,now:alarm.at});
  assert(!elapsed.preview.some(value=>value.key===alarm.key));
  for(const options of [
    {settings,preferences:{...preferences,trainingEnd:false}},
    {settings:{...settings,scheduleEnabled:false},preferences},
    {settings:{...settings,gymDays:[]},preferences},
  ])assert.equal(alarms.buildAlarmBatch({...options,now}).notifications.length,0);
});

test('el fin de entrenamiento se acomoda a los compromisos y desaparece si no entra un bloque por la mañana',()=>{
  const date='2026-10-21',now=localEpoch(21),preferences=prefs({trainingEnd:true});
  const overrides={[date]:{care:'other',dropoff:'other',pickup:'other'}};
  const initial=alarms.buildAlarmBatch({settings,overrides,preferences,now}).preview.find(alarm=>alarm.key===`training-end:${date}`);
  const extras=[{id:'morning-appointment',title:'Turno de la mañana',date,startHHmm:'08:15',durationMin:90,travelMin:0,kind:'personal'}];
  const gym=planner.buildDay(date,settings,overrides,extras).events.find(event=>event.id==='gym');
  assert(gym);
  const changed=alarms.buildAlarmBatch({settings,overrides,extras,preferences,now}).preview.find(alarm=>alarm.key===`training-end:${date}`);
  assert.equal(changed.at,alarms.alarmEpoch(date,planner.formatTime(gym.end)));
  assert.notEqual(changed.at,initial.at);assert.equal(changed.id,initial.id);
  const blocked=[{...extras[0],startHHmm:'00:00',durationMin:720}];
  assert(!planner.buildDay(date,settings,overrides,blocked).events.some(event=>event.id==='gym'));
  assert(!alarms.buildAlarmBatch({settings,overrides,extras:blocked,preferences,now}).preview.some(alarm=>alarm.key===initial.key));
});

test('el aviso de fin no duplica el de inicio y mantiene ID al cambiar duración',()=>{
  const preferences=prefs({trainingEnd:true,agenda:true,beforeMin:10}),now=localEpoch(21);
  const batch=alarms.buildAlarmBatch({settings,preferences,now});
  const end=batch.preview.find(alarm=>alarm.key==='training-end:2026-10-21');
  const start=batch.preview.find(alarm=>alarm.key==='agenda:2026-10-21:gym');
  assert(end&&start);assert.notEqual(end.id,start.id);assert(end.at>start.at);
  assert.equal(batch.preview.filter(alarm=>alarm.key===end.key).length,1);
  const changed=alarms.buildAlarmBatch({settings:{...settings,gymDurationMin:settings.gymDurationMin+5},preferences,now}).preview.find(alarm=>alarm.key===end.key);
  assert.equal(changed.id,end.id);assert.equal(changed.at,end.at+5*60000);
});

test('los fines de entrenamiento conservan el cupo de 200 y no desplazan despertadores ni las dos fases de sueño',()=>{
  const extras=Array.from({length:30},(_,index)=>({id:`extra-${index}`,title:`Evento ${index}`,days:[0,1,2,3,4,5,6],startHHmm:'12:00',durationMin:5,travelMin:0,kind:'personal'}));
  const preferences=prefs({trainingEnd:true,wake:true,bedtime:true,agenda:true,custom:[{id:'far',title:'Puntual',date:'2027-01-01',time:'10:00',kind:'wake'}]});
  const full=alarms.buildAlarmBatch({settings,extras,preferences,now:localEpoch(19)});
  const protectedBatch=alarms.buildAlarmBatch({settings,extras,preferences:{...preferences,trainingEnd:false,agenda:false},now:localEpoch(19)});
  assert.equal(full.notifications.length,200);assert(full.omitted>0);
  for(const expected of protectedBatch.preview) {
    const actual=full.preview.find(alarm=>alarm.key===expected.key);
    assert(actual,expected.key);assert.equal(actual.at,expected.at);assert.equal(actual.id,expected.id);
  }
});

test('una programación anterior pendiente no gana al cambiar de cuenta',async()=>{
  const calls=[];let release;
  const status={granted:true,notifications:true,exactAlarms:true,fullScreen:true,alarmVolume:5,alarmMaxVolume:7,pending:0,stored:0,nextAt:null,lastError:null};
  const plugin={permissionStatus:async()=>status,cancelAll:async()=>calls.push('cancel'),schedule:async({notifications})=>{calls.push(notifications[0].title);if(notifications[0].title==='A')await new Promise(resolve=>{release=resolve;});}};
  const queue=await api(plugin),notification=title=>({id:1,at:localEpoch(20),title,body:'',kind:'wake'});
  const old=queue.queueAlarmSchedule(queue.invalidateAlarmSchedule(),[notification('A')]);
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  const next=queue.queueAlarmSchedule(queue.invalidateAlarmSchedule(),[notification('B')],true);
  release();await Promise.all([old,next]);
  assert.deepEqual(calls,['A','cancel','B']);
});

test('sin permiso cancela la programación sin fingir que quedó activa',async()=>{
  const calls=[];const status={granted:false,notifications:false,exactAlarms:false};
  const queue=await api({permissionStatus:async()=>status,cancelAll:async()=>calls.push('cancel'),schedule:async()=>calls.push('schedule')});
  const result=await queue.queueAlarmSchedule(queue.invalidateAlarmSchedule(),[{id:1,at:localEpoch(20),title:'Aviso',body:'',kind:'reminder'}]);
  assert.deepEqual(calls,['cancel']);assert.equal(result.granted,false);
});

test('desactivar avisos vacía sólo el lote y conserva la prueba de 30 segundos',async()=>{
  const calls=[];const status={granted:true};
  const queue=await api({permissionStatus:async()=>status,cancelAll:async()=>calls.push('cancel-all'),schedule:async({notifications})=>calls.push(['schedule',notifications.length])});
  await queue.queueAlarmSchedule(queue.invalidateAlarmSchedule(),[]);
  assert.deepEqual(calls,[['schedule',0]]);
  await queue.queueAlarmSchedule(queue.invalidateAlarmSchedule(),[],true);
  assert.deepEqual(calls,[['schedule',0],'cancel-all',['schedule',0]]);
});
