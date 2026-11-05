import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const trainingUrl=data(compile(await fs.readFile(new URL('../src/lib/training.ts',import.meta.url),'utf8')));
const gym=await import(trainingUrl);
const reportSource=compile(await fs.readFile(new URL('../src/lib/trainingReport.ts',import.meta.url),'utf8'))
  .replace(/from ['"]\.\/training['"]/,`from '${trainingUrl}'`);
const {trainingReport}=await import(data(reportSource));
const stamp=date=>Date.parse(`${date}T09:00:00-03:00`);
const inline=value=>typeof value==='string'?value:'';
const quote=value=>`> ${value}`;
function session({id,date,sets,variant='assisted-machine',assisted=true,warmup=true}){
  const definition={...structuredClone(gym.TRAINING_EXERCISES[0]),id:assisted?'plan-assisted-pullup':'custom-resistance',name:assisted?'Dominada asistida':'Remo con carga',hasWarmupSet:warmup,variants:[{id:variant,name:assisted?'Dominada asistida':'Remo con carga'}]};
  const routine={id:'report-routine',name:'Rutina registrada',createdAt:stamp(date),day:1,exercises:[definition]};
  let value=gym.createTrainingSession({id,date,day:1,week:1,now:stamp(date),routine});
  const complete=(setId,loadKg,reps,offset)=>{
    value=gym.updateTrainingSet(value,0,setId,{loadKg,reps});
    value=gym.completeTrainingSet(value,0,setId,stamp(date)+offset);
  };
  if(warmup)complete('s0',90,8,1000);
  sets.forEach((set,index)=>complete(`s${index+1}`,set[0],set[1],2000+index*1000));
  return gym.finishTrainingSession(value,stamp(date)+100000);
}
const report=(records,date='2026-11-05')=>trainingReport(records,[date],stamp(date)+120000,inline,quote).lines.join('\n');

test('assistance report labels factual kg and compares lower assistance with the actual repetitions',()=>{
  const previous=session({id:'prior',date:'2026-11-03',sets:[[60,8],[40,10]]});
  const current=session({id:'current',date:'2026-11-05',sets:[[50,8],[30,6],[30,8]]});
  const records={prior:previous,current},original=structuredClone(records);
  const text=report(records);
  assert.match(text,/S0 · Aproximación: \*\*90 kg de asistencia\*\* · 8 repeticiones/);
  assert.match(text,/S1 · Serie efectiva: \*\*50 kg de asistencia\*\* · 8 repeticiones/);
  assert.match(text,/Menor asistencia efectiva registrada en esta sesión: \*\*30 kg de asistencia\*\* \(6, 8 repeticiones registradas en esas series\)/);
  assert.match(text,/Registro anterior de la misma variante \(2026-11-03\): \*\*40 kg de asistencia\*\* \(10 repeticiones registradas/);
  assert.match(text,/Diferencia de asistencia: \*\*-10 kg\*\*/);
  assert.match(text,/Menos asistencia no implica una ganancia automática de fuerza/);
  assert.match(text,/Series efectivas completadas: \*\*3\*\*\. Aproximaciones completadas: \*\*1\*\*/);
  assert.doesNotMatch(text,/Mayor carga efectiva|Diferencia: \*\*\+|mejoró|más fuerte/);
  assert.deepEqual(records,original,'El reporte no convierte ni reescribe kilos de asistencia');
});

test('assistance comparisons require the same variant and never treat missing assistance as zero',()=>{
  const different=session({id:'different',date:'2026-11-04',sets:[[20,8]],variant:'other-machine'});
  const current=session({id:'current',date:'2026-11-05',sets:[[null,8]],warmup:false});
  const text=report({different,current});
  assert.match(text,/Serie efectiva: \*\*Sin asistencia registrada\*\* · 8 repeticiones/);
  assert.doesNotMatch(text,/Menor asistencia efectiva|Registro anterior de la misma variante|\*\*0 kg/);
  const withLoad=session({id:'loaded',date:'2026-11-05',sets:[[30,8]],warmup:false});
  assert.doesNotMatch(report({different,loaded:withLoad}),/Menor asistencia efectiva|Registro anterior de la misma variante/,'Una máquina diferente no da una comparación');
});

test('ordinary resistance report keeps the existing maximum-load comparison wording and raw values',()=>{
  const previous=session({id:'prior',date:'2026-11-03',sets:[[10,10]],assisted:false,variant:'machine'});
  const current=session({id:'current',date:'2026-11-05',sets:[[12,8],[15,6]],assisted:false,variant:'machine'});
  const records={prior:previous,current},original=structuredClone(records),text=report(records);
  assert.match(text,/S1 · Serie efectiva: \*\*12 kg\*\* · 8 repeticiones/);
  assert.ok(text.includes('- Mayor carga efectiva registrada en esta sesión: **15 kg**. Registro anterior de la misma variante (2026-11-03): **10 kg**. Diferencia: **+5 kg**; revisar junto a las repeticiones y sensaciones.'));
  assert.doesNotMatch(text,/kg de asistencia|Menor asistencia efectiva/);
  assert.deepEqual(records,original);
});
