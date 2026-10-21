import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const datePolicy=data(compile(await fs.readFile(new URL('../src/lib/datePolicy.ts',import.meta.url),'utf8')));
const training=await import(data(compile(await fs.readFile(new URL('../src/lib/training.ts',import.meta.url),'utf8'))));
const source=compile(await fs.readFile(new URL('../src/lib/trainingAlarms.ts',import.meta.url),'utf8'));
let moduleId=0;
async function api(plugin={},native=true){
  const key=`__trainingAlarmPlugin${++moduleId}`;globalThis[key]=plugin;
  const result=await import(data(source.replace(/import\s*\{[^}]+\}\s*from\s*['"]@capacitor\/core['"];?/,`const Capacitor={isNativePlatform:()=>${native},getPlatform:()=>${JSON.stringify(native?'android':'web')}}; const registerPlugin=()=>globalThis[${JSON.stringify(key)}];`)
    .replace(/from ['"]\.\/datePolicy['"]/,`from '${datePolicy}'`))+`#${moduleId}`);
  delete globalThis[key];return result;
}
const alarms=await api();
const now=new Date(2026,9,21,9).getTime();
const fresh=(patch={})=>({...training.createTrainingSession({id:'gym-one',date:'2026-10-21',week:1,day:1,now}),...patch});
const snapshot=session=>({[session.id]:session});

test('deriva descanso y contador de serie reales sin crear fin de sesión ni modificar registros',()=>{
  const session=fresh({restUntil:now+60_000,setTimerUntil:now+30_000});const original=JSON.stringify(session);
  const result=alarms.buildTrainingTimerAlarms(snapshot(session),now);
  assert.deepEqual(result.map(item=>[item.key,item.kind,item.at]),[['gym-one:set','set',now+30_000],['gym-one:rest','rest',now+60_000]]);
  assert(result[0].body.includes('confirmar los segundos reales'));
  assert.equal(JSON.stringify(session),original);
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(fresh()),now),[]);
});

test('pausar, omitir, reiniciar o finalizar elimina sólo los contadores que ya no están activos',()=>{
  const session=fresh({restUntil:now+60_000,setTimerUntil:now+30_000});
  assert.equal(alarms.buildTrainingTimerAlarms(snapshot(training.pauseTrainingSession(session,now)),now).length,0);
  assert.equal(alarms.buildTrainingTimerAlarms(snapshot(training.finishTrainingSession(session,now)),now).length,0);
  assert.equal(alarms.buildTrainingTimerAlarms(snapshot(training.finishTrainingSession(session,now,'abandoned')),now).length,0);
  const skip={...session,restUntil:null,pausedRestSeconds:null};
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(skip),now).map(item=>item.kind),['set']);
  const reset=training.startTrainingRest(session,90,now+1_000);
  assert.equal(alarms.buildTrainingTimerAlarms(snapshot(reset),now)[1].at,now+91_000);
  const resumed=training.resumeTrainingSession(training.pauseTrainingSession(session,now+10_000),now+20_000);
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(resumed),now+20_000).map(item=>item.at),[now+40_000,now+70_000]);
});

test('explorar otro día no afecta los contadores de hoy; ayer, mañana e importadas no generan avisos',()=>{
  const all={today:fresh({id:'today',restUntil:now+50_000}),past:fresh({id:'past',date:'2026-10-20',restUntil:now+40_000}),future:fresh({id:'future',date:'2026-10-22',restUntil:now+30_000}),imported:fresh({id:'imported',status:'imported',restUntil:now+20_000})};
  assert.deepEqual(alarms.buildTrainingTimerAlarms(all,now).map(item=>item.sessionId),['today']);
});

test('vencimientos ya consumidos, no finitos, mayores de dos horas o al otro lado de medianoche se omiten',()=>{
  for(const at of [now,now-1,NaN,Infinity,now+7_200_001,now+0.5])assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(fresh({restUntil:at})),now),[]);
  const midnight=new Date(2026,9,21,23,59,45).getTime();
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(fresh({restUntil:midnight+30_000})),midnight),[]);
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(fresh({restUntil:midnight+5_000})),midnight+60_000),[]);
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(fresh({restUntil:now+30_000})),NaN),[]);
});

test('editar la carga no cambia identidad ni fecha del aviso ya en marcha',()=>{
  const session=fresh({restUntil:now+60_000});
  const edited=training.updateTrainingSet(session,0,'s0',{loadKg:15});
  assert.deepEqual(alarms.buildTrainingTimerAlarms(snapshot(edited),now),alarms.buildTrainingTimerAlarms(snapshot(session),now));
});

test('la web no solicita permisos ni programa avisos nativos',async()=>{
  const client=await api({replace:()=>assert.fail('No debe llamar Android'),cancelAll:()=>assert.fail('No debe llamar Android')},false);
  assert.deepEqual(await client.syncTrainingTimerAlarms({scope:null,sessions:snapshot(fresh({restUntil:now+1_000})),now}),{native:false,armed:0,warning:null});
  assert.deepEqual(await client.clearTrainingTimerAlarms(),{native:false,armed:0,warning:null});
});

test('un cambio de cuenta gana a una llamada anterior pendiente y cancela antes de reconciliar la nueva',async()=>{
  const calls=[];let release;
  const client=await api({replace:async options=>{calls.push(options.scope);if(options.scope==='account-A')await new Promise(resolve=>{release=resolve;});return {armed:options.timers.length};},cancelAll:async()=>{calls.push('cancel');return {armed:0};}});
  const old=client.syncTrainingTimerAlarms({scope:'account-A',sessions:snapshot(fresh({restUntil:now+60_000})),now});
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  const clear=client.clearTrainingTimerAlarms();
  // Allow the explicit cancellation to run; a newer sync otherwise supersedes a still queued cleanup.
  release();assert.equal((await old).armed,0);await clear;
  const next=await client.syncTrainingTimerAlarms({scope:'account-B',sessions:snapshot(fresh({id:'new-session',restUntil:now+20_000})),now});
  assert.deepEqual(calls,['account-A','cancel','account-B']);assert.equal(next.armed,1);
});

test('la última revisión reemplaza la cuenta anterior aunque una cancelación intermedia quede obsoleta',async()=>{
  const calls=[];let release;
  const client=await api({replace:async options=>{calls.push(options.scope);if(options.scope==='A')await new Promise(resolve=>{release=resolve;});return {armed:options.timers.length};},cancelAll:async()=>{calls.push('cancel');}});
  const old=client.syncTrainingTimerAlarms({scope:'A',sessions:snapshot(fresh({restUntil:now+60_000})),now});
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  const clear=client.clearTrainingTimerAlarms();
  const next=client.syncTrainingTimerAlarms({scope:'B',sessions:{},now});
  release();await Promise.all([old,clear,next]);
  assert.deepEqual(calls,['A','B']);
});

test('los permisos o plugin ausente se muestran como aviso sin afirmar que está armado',async()=>{
  const denied=await api({replace:async()=>({armed:0,warning:'Activá Alarmas y recordatorios.'})});
  assert.deepEqual(await denied.syncTrainingTimerAlarms({scope:null,sessions:{},now}),{native:true,armed:0,warning:'Activá Alarmas y recordatorios.'});
  const oldApk=await api({replace:async()=>{throw new Error('Actualizá la APK para usar los avisos.');}});
  assert.equal((await oldApk.syncTrainingTimerAlarms({scope:'A',sessions:{},now})).warning,'Actualizá la APK para usar los avisos.');
});
