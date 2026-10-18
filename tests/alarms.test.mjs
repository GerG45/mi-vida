import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const transpile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const data = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const plannerUrl = data(transpile(await fs.readFile(new URL('../src/lib/planner.ts',import.meta.url),'utf8')));
const planner = await import(plannerUrl);
const alarmsSource = transpile(await fs.readFile(new URL('../src/lib/alarms.ts',import.meta.url),'utf8'));
let moduleId=0;
async function api(plugin={}) {
  globalThis.__alarmPlugin=plugin;
  const source=alarmsSource.replace(/import\s*\{[^}]+\}\s*from\s*['"]@capacitor\/core['"];?/, 'const Capacitor={isNativePlatform:()=>false,getPlatform:()=>"web"}; const registerPlugin=()=>globalThis.__alarmPlugin;').replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`);
  return import(data(source)+`#${++moduleId}`);
}
const alarms=await api();
const settings = {...planner.defaults,scheduleEnabled:true,familyConfirmed:true,cordobaConfirmed:true,recordingConfirmed:true,preparationConfirmed:true};
const localEpoch = (day,hour=0,minute=0) => new Date(2026,9,day,hour,minute).getTime();
const prefs = patch => ({...alarms.defaultAlarmPreferences(),...patch});

test('alarma del lunes B usa el despertar calculado de las 06:45',()=>{
  const batch=alarms.buildAlarmBatch({settings,preferences:prefs({wake:true}),now:localEpoch(19)});
  assert.equal(batch.preview[0].key,'wake:2026-10-19');
  assert.equal(batch.preview[0].at,localEpoch(19,6,45));
  assert.equal(batch.preview[0].kind,'wake');
  assert.equal(batch.notifications.length,14);
  assert.equal(batch.through,'2026-11-01');
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

test('ajustes locales separados por cuenta y valores importados estrictos',()=>{
  const items=new Map();globalThis.localStorage={getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};
  alarms.saveAlarmPreferences('project:A',prefs({wake:true}));
  assert.equal(alarms.loadAlarmPreferences('project:A').wake,true);
  assert.equal(alarms.loadAlarmPreferences('project:B').wake,false);
  assert.equal(alarms.loadAlarmPreferences(null).wake,false);
  const invalid=alarms.normalizeAlarmPreferences({wake:'true',agenda:1,beforeMin:1000,categories:['care','work'],custom:[{id:'x',title:'Imposible',date:'2026-02-31',time:'10:00',kind:'wake'}]});
  assert.equal(invalid.wake,false);assert.equal(invalid.agenda,false);assert.equal(invalid.beforeMin,60);
  assert.deepEqual(invalid.categories,['work']);assert.deepEqual(invalid.custom,[]);
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
