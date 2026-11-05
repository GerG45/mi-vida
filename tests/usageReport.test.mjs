import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

const modules=new Map();
async function sourceUrl(file){
  if(modules.has(file))return modules.get(file);
  const loading=(async()=>{
    let compiled=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
    for(const match of [...compiled.matchAll(/from\s+(['"])(\.[^'"]+)\1/g)]){
      const dependency=await sourceUrl(path.resolve(path.dirname(file),`${match[2]}.ts`));
      compiled=compiled.replace(match[0],`from '${dependency}'`);
    }
    return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  })();modules.set(file,loading);return loading;
}
const reportUrl=await sourceUrl(fileURLToPath(new URL('../src/lib/usageReport.ts',import.meta.url)));
const {buildUsageReport}=await import(reportUrl);
const training=await import(await sourceUrl(fileURLToPath(new URL('../src/lib/training.ts',import.meta.url))));
const work=await import(await sourceUrl(fileURLToPath(new URL('../src/lib/workChecklist.ts',import.meta.url))));
const backup=sections=>({version:1,exportedAt:'2026-11-05T14:00:00.000Z',sections});
function session(id,date,{status='completed',minutes=60,working=true,warmup=true,title='Tren inferior'}={}){
  const now=new Date(`${date}T08:30:00-03:00`).getTime();
  let value=training.createTrainingSession({id,date,week:1,day:1,now});
  value.title=title;
  if(warmup){value=training.updateTrainingSet(value,0,'s0',{loadKg:10,reps:8});value=training.completeTrainingSet(value,0,'s0',now+1_000);}
  if(working){value=training.updateTrainingSet(value,0,'s1',{loadKg:20,reps:10});value=training.completeTrainingSet(value,0,'s1',now+2_000);}
  return status==='active'?value:training.finishTrainingSession(value,now+minutes*60_000,status);
}

test('el período es inclusivo, valida fechas y no desplaza sus claves por zona horaria',()=>{
  const result=buildUsageReport(backup({}),'2026-11-05');
  assert.equal(result.summary.start,'2026-10-09');assert.equal(result.summary.end,'2026-11-05');assert.equal(result.summary.days,28);
  assert.equal(buildUsageReport(backup({}),'2027-01-02',7).summary.start,'2026-12-27');
  for(const date of ['2026-02-30','2026-11-5','not-a-date','2026-11-05T00:00:00Z'])assert.throws(()=>buildUsageReport(backup({}),date),/fecha válida/);
  for(const days of [0,91,1.5,NaN,Infinity])assert.throws(()=>buildUsageReport(backup({}),'2026-11-05',days),/entre 1 y 90/);
  for(const timezone of ['America/Argentina/Buenos_Aires','Pacific/Kiritimati','America/Los_Angeles']){
    const code=`import assert from 'node:assert/strict';const {buildUsageReport}=await import(${JSON.stringify(reportUrl)});assert.equal(buildUsageReport({sections:{}},'2026-11-05',28).summary.start,'2026-10-09');`;
    const result=spawnSync(process.execPath,['--input-type=module'],{input:code,env:{...process.env,TZ:timezone},encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stderr||result.error?.message);
  }
});

test('respaldo antiguo vacío no inventa datos ni telemetría',()=>{
  const result=buildUsageReport(backup({}),'2026-11-05',7);
  for(const [field,value] of Object.entries(result.summary))if(!['start','end','days'].includes(field))assert.equal(value,0,field);
  assert.match(result.markdown,/no mide aperturas/);
  assert.match(result.markdown,/Sin registro significa que falta información/);
  assert.match(result.markdown,/No hay sesiones con series efectivas confirmadas/);
  assert.doesNotMatch(result.markdown,/GTD|cumplimiento:|racha de/);
});

test('las marcas y el contenido se cuentan por fechas válidas, sin duplicar días ni escribir textos privados',()=>{
  const pending=work.createWorkItem({id:'item',date:'2026-11-03',blockId:'flex-work',title:'Trabajo privado',now:1});
  const original=backup({
    journal:{'2026-11-01':{freeText:'Mi texto privado',mood:''},'2026-11-02':{energy:4},'2026-11-03':{energy:0},'2026-11-04':{unknown:'No contar'},'2026-11-06':{freeText:'Fuera de rango'}},
    done:{'2026-11-01:breakfast':true,'2026-11-01:gym':true,'2026-11-02:work':false,'2026-02-30:bad':true,bad:true,'2026-11-06:future':true},
    habits:{water:{id:'water',name:'Agua'}},
    habitChecks:{'2026-11-01:water':true,'2026-11-02:water':true,'2026-11-02:meditation':true,'2026-11-03:meditation':false,'2026-11-04:deleted':true},
    workItems:{item:pending,bad:{...pending,id:'different'}},
  });
  const before=structuredClone(original),result=buildUsageReport(original,'2026-11-05',7);
  assert.equal(result.summary.blockMarks,2);assert.equal(result.summary.journalDays,2);
  assert.equal(result.summary.habitMarks,2);assert.equal(result.summary.meditationDays,1);
  assert.equal(result.summary.workItems,1);assert.equal(result.summary.workItemMarks,0);
  assert.equal(result.summary.registeredDays,3);
  assert.doesNotMatch(result.markdown,/Mi texto privado|Fuera de rango|Trabajo privado|deleted/);
  assert.deepEqual(original,before);
});

test('series efectivas, aproximaciones solas y borradores se distinguen de asistencia y cronómetros',()=>{
  const first=session('first','2026-11-02',{minutes:4});
  const second=session('second','2026-11-03',{status:'active'});second.elapsedSeconds=123456;
  const third=session('third','2026-11-03',{status:'abandoned',minutes:70});
  const warm=session('warm','2026-11-04',{working:false});
  const draft=session('draft','2026-11-05',{working:false,warmup:false});
  const legacy={...session('legacy','2026-11-05'),status:'imported',legacyDateUnknown:true};
  const future=session('future','2026-11-06');
  const result=buildUsageReport(backup({gymSessions:{first,second,third,warm,draft,legacy,future}}),'2026-11-05',7);
  assert.equal(result.summary.trainingSessions,3);assert.equal(result.summary.trainingDays,2);
  assert.equal(result.summary.closedTrainingSessions,2);assert.equal(result.summary.unclosedTrainingSessions,1);
  assert.equal(result.summary.registeredDays,4);
  assert.match(result.markdown,/\| Lunes \| 1 \| 1 \|/);assert.match(result.markdown,/\| Martes \| 2 \| 1 \|/);
  assert.match(result.markdown,/Registros con sólo aproximaciones: \*\*1\*\*/);assert.match(result.markdown,/Borradores o cierres sin series confirmadas: \*\*1\*\*/);
  assert.match(result.markdown,/4 min · menor a 10 min/);assert.match(result.markdown,/70 min/);
  assert.match(result.markdown,/Sin cierre: no se suman minutos/);assert.doesNotMatch(result.markdown,/2057|123456|future|legacy|2026-11-06/);
  assert.match(result.markdown,/descansos reales medidos/);
});

test('las sesiones inválidas se omiten y un cierre temporal incoherente no genera duración',()=>{
  const good=session('good','2026-11-02');
  const inconsistent=session('inconsistent','2026-11-03',{warmup:false,working:false});
  // A completed set is valid in isolation, but its session clock must not turn backwards.
  inconsistent.exercises[0].sets[0].reps=8;inconsistent.exercises[0].sets[0].completedAt=inconsistent.startedAt;
  inconsistent.completedAt=inconsistent.startedAt-1;
  const bad={...good,id:'bad',accessToken:'do-not-export'};
  const result=buildUsageReport(backup({gymSessions:{good,bad,inconsistent,mismatch:good}}),'2026-11-05',7);
  assert.equal(result.summary.trainingSessions,1);
  assert.doesNotMatch(result.markdown,/do-not-export|accessToken/);
});

test('ningún perfil, ubicación, nota, identificador de cuenta o enlace se filtra al archivo',()=>{
  const value=session('private-session-id','2026-11-02',{title:'Rutina | fuerte https://share.google/casa'});
  value.notes='Nota privada de sesión';value.exercises[0].notes='Nota privada del ejercicio';
  const result=buildUsageReport(backup({gymSessions:{[value.id]:value},profile:{name:'Nombre privado',uid:'uid-secreto'},settings:{homeMapsUrl:'https://share.google/secreto',apiKey:'clave-secreta'},calendarEvents:{one:{title:'Compromiso secreto'}},journal:{'2026-11-01':{freeText:'Diario privado'}}}),'2026-11-05',7);
  for(const forbidden of ['private-session-id','Nota privada','Nombre privado','uid-secreto','clave-secreta','share.google','Compromiso secreto','Diario privado'])assert(!result.markdown.includes(forbidden),forbidden);
  assert.match(result.markdown,/Rutina \\\| fuerte/);assert.match(result.markdown,/enlace omitido/);
});
