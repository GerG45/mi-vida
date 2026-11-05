import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import {spawnSync} from 'node:child_process';
const source=ts.transpileModule(await fs.readFile(new URL('../src/lib/trainingPlanReview.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {trainingPlanAnniversary,getTrainingPlanReview,getTrainingPlanReviewDates,getTrainingPlanWeek}=await import(url);
const plan={trainingPlanId:'new-plan',trainingPlanStartedOn:'2026-11-05',trainingPlanReviewedOn:'',trainingPlanReviewEnabled:true,trainingPlanReviewTime:'09:00'};

test('la semana propuesta avanza por fecha y queda en consolidación después de la cuarta',()=>{
  for(const [date,week] of [['2026-11-05',1],['2026-11-11',1],['2026-11-12',2],['2026-11-19',3],['2026-11-26',4],['2026-12-15',4]])assert.equal(getTrainingPlanWeek('2026-11-05',date),week);
  assert.equal(getTrainingPlanWeek('2026-11-05','2026-11-01'),1);
  assert.equal(getTrainingPlanWeek(undefined,'2026-11-05'),1);
});

test('un plan empieza a avisar un mes después y el aviso no modifica sus metadatos',()=>{
  const before=structuredClone(plan);
  assert.deepEqual(getTrainingPlanReview(plan,'2026-11-05'),{dueOn:'2026-12-05',nextOn:'2026-12-05',overdue:false});
  assert.deepEqual(getTrainingPlanReview(plan,'2026-12-05'),{dueOn:'2026-12-05',nextOn:'2026-12-05',overdue:true});
  assert.deepEqual(getTrainingPlanReview(plan,'2027-02-10'),{dueOn:'2026-12-05',nextOn:'2027-03-05',overdue:true});
  assert.deepEqual(getTrainingPlanReviewDates(plan,'2027-02-10'),['2027-03-05','2027-04-05','2027-05-05']);
  assert.deepEqual(plan,before);
});
test('los aniversarios parten siempre del inicio y febrero no desplaza el resto del año',()=>{
  assert.equal(trainingPlanAnniversary('2027-01-31',1),'2027-02-28');
  assert.equal(trainingPlanAnniversary('2027-01-31',2),'2027-03-31');
  assert.equal(trainingPlanAnniversary('2027-01-31',3),'2027-04-30');
  assert.equal(trainingPlanAnniversary('2028-01-31',1),'2028-02-29');
  assert.deepEqual(getTrainingPlanReviewDates({...plan,trainingPlanStartedOn:'2027-01-31'},'2027-02-10'),['2027-02-28','2027-03-31','2027-04-30']);
});
test('una revisión cubre su mes y conserva el día de aniversario original, incluso si se adelantó',()=>{
  const reviewed={...plan,trainingPlanStartedOn:'2027-01-31',trainingPlanReviewedOn:'2027-02-28'};
  assert.deepEqual(getTrainingPlanReview(reviewed,'2027-02-28'),{dueOn:'2027-03-31',nextOn:'2027-03-31',overdue:false});
  assert.equal(getTrainingPlanReview({...reviewed,trainingPlanReviewedOn:'2027-02-15'},'2027-02-15').dueOn,'2027-03-31');
  assert.equal(getTrainingPlanReview({...reviewed,trainingPlanReviewedOn:'2027-03-05'},'2027-03-05').dueOn,'2027-04-30');
  assert.equal(getTrainingPlanReview({...reviewed,trainingPlanReviewedOn:'2027-04-30'},'2027-02-28').dueOn,'2027-02-28','Una revisión futura no oculta avisos actuales');
});
test('copias antiguas, plan desactivado y fechas inválidas no generan avisos',()=>{
  for(const value of [{},{...plan,trainingPlanId:''},{...plan,trainingPlanId:'../bad'},{...plan,trainingPlanStartedOn:''},{...plan,trainingPlanStartedOn:'2026-02-30'},{...plan,trainingPlanReviewEnabled:false}]){
    assert.equal(getTrainingPlanReview(value,'2026-11-05'),null);
    assert.deepEqual(getTrainingPlanReviewDates(value,'2026-11-05'),[]);
  }
  assert.equal(getTrainingPlanReview(plan,'bad'),null);
  assert.deepEqual(getTrainingPlanReviewDates(plan,'2026-11-05',0),[]);
});
test('la cadencia usa fechas de calendario sin conversión de zona horaria',()=>{
  const input=`import assert from 'node:assert/strict';const {getTrainingPlanReviewDates}=await import(${JSON.stringify(url)});assert.deepEqual(getTrainingPlanReviewDates(${JSON.stringify(plan)},'2026-12-06'),['2027-01-05','2027-02-05','2027-03-05']);`;
  for(const TZ of ['America/Argentina/Buenos_Aires','Pacific/Kiritimati']){
    const result=spawnSync(process.execPath,['--input-type=module'],{input,env:{...process.env,TZ},encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stderr||result.error?.message);
  }
});
