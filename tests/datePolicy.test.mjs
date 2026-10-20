import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await fs.readFile(new URL('../src/lib/datePolicy.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {localDateKey,getDateAccess,canMutateDateSection:canChange} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = new Date(2026,9,19,12).getTime();
const futureItem = {id:'next',date:'2026-10-20',blockId:'flex-work',title:'Preparar',done:false,estimatedMinutes:null,createdAt:100,completedAt:null,order:0,elapsedSeconds:0,timerStartedAt:null};

test('las copias y vínculos de Calendar conservan las fechas cerradas',()=>{
  for (const section of ['calendarEvents','calendarLinks']) {
    const past={date:'2026-10-18'},today={date:'2026-10-19'},future={date:'2026-10-20'};
    assert.equal(canChange(section,'id',past,undefined,now),false);
    assert.equal(canChange(section,'id',past,{...past,date:future.date},now),false);
    assert.equal(canChange(section,'id',undefined,past,now),false);
    assert.equal(canChange(section,'id',today,{...today,title:'Cambio'},now),true);
    assert.equal(canChange(section,'id',undefined,future,now),true);
  }
});

test('la política distingue consulta pasada, planificación futura y ejecución de hoy',()=>{
  assert.deepEqual(getDateAccess('2026-10-19',now),{date:'2026-10-19',today:'2026-10-19',kind:'today',canPlan:true,canExecute:true,readOnly:false});
  assert.equal(getDateAccess('2026-10-18',now).readOnly,true);
  assert.equal(getDateAccess('2026-10-18',now).canPlan,false);
  assert.equal(getDateAccess('2026-10-20',now).canPlan,true);
  assert.equal(getDateAccess('2026-10-20',now).canExecute,false);
  for (const date of ['2026-02-30','2026-1-19','no-fecha','']) {
    assert.equal(getDateAccess(date,now).kind,'invalid');
    assert.equal(getDateAccess(date,now).readOnly,true);
  }
  assert.equal(getDateAccess('2026-10-19',NaN).canExecute,false);
});

test('la fecha actual se obtiene del calendario local y cambia al cruzar medianoche',()=>{
  const before = new Date(2026,9,19,23,59,59).getTime(), after = new Date(2026,9,20,0,0,1).getTime();
  assert.equal(localDateKey(before),'2026-10-19');
  assert.equal(localDateKey(after),'2026-10-20');
  assert.equal(getDateAccess('2026-10-19',before).canExecute,true);
  assert.equal(getDateAccess('2026-10-19',after).canExecute,false);
  assert.equal(localDateKey(new Date(2026,0,1,0,5)),'2026-01-01');
});

test('checks y diario sólo permiten registros de hoy, incluso al borrarlos',()=>{
  for (const section of ['done','habitChecks']) {
    assert.equal(canChange(section,'2026-10-19:one',false,true,now),true);
    assert.equal(canChange(section,'2026-10-18:one',true,undefined,now),false);
    assert.equal(canChange(section,'2026-10-20:one',undefined,true,now),false);
    assert.equal(canChange(section,'2026-02-30:one',false,true,now),false);
    assert.equal(canChange(section,'sin-fecha',false,true,now),false);
  }
  assert.equal(canChange('journal','2026-10-19',undefined,{freeText:'Hoy'},now),true);
  assert.equal(canChange('journal','2026-10-20',undefined,{intention:'Mañana'},now),false);
  assert.equal(canChange('journal','2026-10-18',{freeText:'Antes'},undefined,now),false);
});

test('compromisos y excepciones futuros se planifican sin desbloquear fechas anteriores',()=>{
  assert.equal(canChange('overrides','2026-10-20',undefined,{skipPewen:true},now),true);
  assert.equal(canChange('overrides','2026-10-18',{skipPewen:true},undefined,now),false);
  const old={id:'old',date:'2026-10-18'}, next={id:'old',date:'2026-10-20'}, recurring={id:'old',days:[1,3]};
  assert.equal(canChange('extras','old',undefined,next,now),true);
  assert.equal(canChange('extras','old',next,{...next,title:'Cambio'},now),true);
  assert.equal(canChange('extras','old',old,next,now),false);
  assert.equal(canChange('extras','old',old,recurring,now),false);
  assert.equal(canChange('extras','old',next,old,now),false);
  assert.equal(canChange('extras','old',old,undefined,now),false);
  assert.equal(canChange('extras','old',recurring,{...recurring,days:[2]},now),true);
});

test('listas futuras permiten crear, editar, ordenar y quitar sin completar ni registrar tiempo',()=>{
  assert.equal(canChange('workItems','next',undefined,futureItem,now),true);
  assert.equal(canChange('workItems','next',futureItem,{...futureItem,title:'Preparar mejor',estimatedMinutes:30,order:2},now),true);
  assert.equal(canChange('workItems','next',futureItem,undefined,now),true);
  for (const patch of [{done:true,completedAt:300},{elapsedSeconds:25},{timerStartedAt:200},{createdAt:200}]) {
    assert.equal(canChange('workItems','next',futureItem,{...futureItem,...patch},now),false);
    if (!('createdAt' in patch)) assert.equal(canChange('workItems','next',undefined,{...futureItem,...patch},now),false);
  }
  const today={...futureItem,date:'2026-10-19'}, old={...futureItem,date:'2026-10-18'};
  assert.equal(canChange('workItems','next',today,{...today,done:true,completedAt:300},now),true);
  assert.equal(canChange('workItems','next',old,{...old,title:'Borrar el pasado'},now),false);
  assert.equal(canChange('workItems','next',old,today,now),false);
  assert.equal(canChange('workItems','next',today,old,now),false);
  assert.equal(canChange('workItems','next',old,undefined,now),false);
  assert.equal(canChange('workItems','next',{...today,elapsedSeconds:30},{...futureItem,elapsedSeconds:30},now),false,'no se puede trasladar tiempo ya trabajado a mañana');
});

test('las sesiones reales se registran sólo hoy y sus rutinas permanecen globales',()=>{
  const current={id:'gym',date:'2026-10-19'}, old={id:'gym',date:'2026-10-18'}, future={id:'gym',date:'2026-10-20'};
  assert.equal(canChange('gymSessions','gym',undefined,current,now),true);
  assert.equal(canChange('gymSessions','gym',current,{...current,status:'completed'},now),true);
  assert.equal(canChange('gymSessions','gym',old,{...old,currentExercise:1},now),false);
  assert.equal(canChange('gymSessions','gym',old,current,now),false);
  assert.equal(canChange('gymSessions','gym',undefined,future,now),false);
  assert.equal(canChange('gymSessions','gym',old,undefined,now),false);
  for (const section of ['settings','profile','gymRoutines','habits','tasks','projects','shopping','review']) {
    assert.equal(canChange(section,'global',undefined,{date:'2026-10-18'},now),true);
  }
});
