import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const trainingUrl=url(compile(await fs.readFile(new URL('../src/lib/training.ts',import.meta.url),'utf8')));
const training=await import(trainingUrl);
const plan=await import(url(compile(await fs.readFile(new URL('../src/lib/trainingPlan.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/training['"]/,`from '${trainingUrl}'`)));
const now=Date.parse('2026-11-05T12:00:00-03:00');

test('monthly plan provides three compatible primary routines and a separate light optional routine',()=>{
  const routines=plan.getMonthlyTrainingRoutines(now);
  assert.equal(plan.monthlyTrainingPlan.id,'pullups-core-v1');
  assert.deepEqual(plan.monthlyTrainingPlan.primaryWeekdays,[2,4,6]);
  assert.equal(plan.monthlyTrainingPlan.reviewAfterMonths,1);
  assert.equal(routines.length,4);
  assert.equal(new Set(routines.map(routine=>routine.id)).size,4);
  assert.deepEqual(routines.map(routine=>routine.exercises.length),[6,6,6,4]);
  assert.deepEqual(routines.map(routine=>routine.exercises.reduce((sum,item)=>sum+item.targetSets,0)),[14,13,13,8]);
  for(const [index,routine] of routines.entries()){
    assert.deepEqual(training.normalizeTrainingRoutine(routine,routine.id),routine);
    assert(routine.exercises.every(exercise=>exercise.restSeconds===120));
    assert(routine.exercises.some(exercise=>exercise.primaryMuscle.includes('Core')||['d1-e7','d2-e7','d3-e7'].includes(exercise.id)), 'Cada sesión principal y opcional incluye core');
    const session=training.createTrainingSession({id:`check-${index}`,date:'2026-11-05',week:1,day:routine.day,routine,now});
    assert.deepEqual(training.normalizeTrainingSession(session,session.id),session);
    assert(session.exercises.every(exercise=>exercise.sets.every(set=>set.completedAt===null&&set.reps===null&&set.durationSeconds===null)));
  }
  assert.equal(plan.getPlanRoutineForDay(1,now).id,'plan-pullups-a');
  assert.equal(plan.getPlanRoutineForDay(2,now).id,'plan-pullups-b');
  assert.equal(plan.getPlanRoutineForDay(3,now).id,'plan-pullups-c');
  assert.equal(plan.monthlyTrainingPlan.routines.filter(routine=>routine.optional).length,1);
  assert.equal(plan.monthlyTrainingPlan.routines.find(routine=>routine.optional).id,plan.OPTIONAL_PLAN_ROUTINE_ID);
});

test('creating and editing copies does not mutate original exercise templates or catalog metadata',()=>{
  const originals=structuredClone(training.TRAINING_EXERCISES);
  const first=plan.getMonthlyTrainingRoutines(now),before=structuredClone(first);
  const second=plan.getMonthlyTrainingRoutines(now+1000);
  first[0].exercises[0].name='Nombre de esta copia';
  first[0].exercises[0].variants[0].name='Variante de esta copia';
  assert.equal(second[0].exercises[0].name,before[0].exercises[0].name);
  assert.equal(second[0].exercises[0].variants[0].name,before[0].exercises[0].variants[0].name);
  assert.deepEqual(training.TRAINING_EXERCISES,originals);
  assert.equal(second[0].createdAt,now+1000);
  assert.deepEqual(second.map(routine=>routine.id),before.map(routine=>routine.id));
  assert.throws(()=>{plan.monthlyTrainingPlan.weeks[0].focus='Cambiar globalmente';},TypeError);
  assert.throws(()=>{plan.monthlyTrainingPlan.routines[0].name='Cambiar globalmente';},TypeError);
});

test('existing exercise and variant identities carry remembered loads without changing any old records',()=>{
  let old=training.createTrainingSession({id:'old',date:'2026-11-02',week:1,day:1,now:now-3*86400000,restSeconds:null});
  old=training.changeTrainingVariant(old,0,'leg-press');
  old=training.completeTrainingSet(training.updateTrainingSet(old,0,'s0',{loadKg:20,reps:8}),0,'s0',old.startedAt+1000);
  old=training.completeTrainingSet(training.updateTrainingSet(old,0,'s1',{loadKg:70,reps:10}),0,'s1',old.startedAt+2000);
  old.notes='Una nota anterior';old.exercises[0].notes='Misma máquina';
  const all={old},snapshot=structuredClone(all),originalDefinitions=structuredClone(training.TRAINING_EXERCISES);
  const routine=plan.getPlanRoutineForDay(1,now);
  const next=training.createTrainingSession({id:'next',date:'2026-11-05',week:1,day:1,routine,sessions:all,now});
  assert.equal(next.exercises[0].exerciseId,'d1-e1');
  assert.equal(next.exercises[0].variantId,'leg-press');
  assert.equal(next.exercises[0].sets.find(set=>set.id==='s0').loadKg,20);
  assert.equal(next.exercises[0].sets.find(set=>set.id==='s1').loadKg,70);
  assert(next.exercises[0].sets.every(set=>set.reps===null&&set.completedAt===null));
  assert.equal(next.exercises[0].hasWarmupSet,true);
  assert.deepEqual(all,snapshot);
  assert.deepEqual(training.TRAINING_EXERCISES,originalDefinitions);
});

test('assisted pull-up has separate assistance identity, no inferred load from lat pulldowns, and no automatic progression',()=>{
  let old=training.createTrainingSession({id:'lat-pulldown',date:'2026-11-04',week:1,day:3,now:now-86400000});
  old=training.completeTrainingSet(training.updateTrainingSet(old,0,'s0',{loadKg:20,reps:8}),0,'s0',old.startedAt+1000);
  old=training.completeTrainingSet(training.updateTrainingSet(old,0,'s1',{loadKg:45,reps:10}),0,'s1',old.startedAt+2000);
  const routine=plan.getPlanRoutineForDay(3,now),session=training.createTrainingSession({id:'new',date:'2026-11-05',week:3,day:3,routine,sessions:{[old.id]:old},now});
  const assisted=session.exercises.find(exercise=>exercise.exerciseId===plan.ASSISTED_PULLUP_EXERCISE_ID);
  assert.equal(assisted.variantId,plan.ASSISTED_PULLUP_VARIANT_ID);
  assert(assisted.sets.every(set=>set.loadKg===null));
  assert.equal(session.exercises.find(exercise=>exercise.exerciseId==='d3-e1').sets.find(set=>set.id==='s1').loadKg,45);
  const exposures=plan.getMonthlyTrainingRoutines(now).filter(routine=>routine.exercises.some(exercise=>exercise.id===plan.ASSISTED_PULLUP_EXERCISE_ID));
  assert.equal(exposures.length,3);
  assert(exposures.every(routine=>routine.exercises.find(exercise=>exercise.id===plan.ASSISTED_PULLUP_EXERCISE_ID).hasWarmupSet));
  assert.match(plan.monthlyTrainingPlan.assistanceCue,/más kg significa más asistencia/i);
  assert.match(plan.monthlyTrainingPlan.weeks[2].guidance,/No hay aumentos automáticos/);
  assert.match(plan.monthlyTrainingPlan.weeks[3].guidance,/sin prometer una dominada/);
});
