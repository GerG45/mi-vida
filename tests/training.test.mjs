import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../src/lib/training.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const gym=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=1_792_420_000_000;
const fresh=(options={})=>gym.createTrainingSession({id:'session-one',date:'2026-10-19',week:1,day:1,now,...options});
function record(session,index,setId,{loadKg=20,reps=10,durationSeconds=null}={},time=now+1000){
 return gym.completeTrainingSet(gym.updateTrainingSet(session,index,setId,{loadKg,reps,durationSeconds}),index,setId,time);
}
const legacyExercise=(patch={})=>({id:'w1-d1-e1',name:'Sentadilla goblet / prensa',hasWarmupSet:true,loads:{},status:'Pendiente',notes:'',...patch});
const legacy=(exercises,extra={})=>({version:1,state:{plan:{weeks:[{week:1,days:[{day:1,exercises}]}]},logs:[],customSessions:[],...extra}});

test('una sesión opcional no avanza ni reemplaza la rotación principal',()=>{
  let principal=fresh({id:'main',date:'2026-11-03',day:2});
  principal=record(principal,0,'s0');principal=record(principal,0,'s1');
  let optional=fresh({id:'optional',date:'2026-11-04',day:1});
  optional={...record(record(optional,0,'s0'),0,'s1'),routineId:'plan-pullups-optional'};
  const all={main:principal,optional},original=structuredClone(all);
  assert.equal(gym.getTrainingDaySuggestion(all,'2026-11-05').day,3);
  assert.deepEqual(all,original);
});

test('new sessions use two-minute auto-rests without rewriting historical prescriptions or remembered loads',()=>{
 assert.equal(gym.DEFAULT_TRAINING_REST_SECONDS,120);
 let historical=fresh({restSeconds:null});
 historical=gym.changeTrainingVariant(historical,0,'leg-press');
 historical=record(record(historical,0,'s0',{loadKg:15}),0,'s1',{loadKg:35});
 historical=gym.finishTrainingSession(historical,now+120000);
 historical.notes='Lo que registré sigue acá';historical.exercises[0].notes='Control y comodidad';
 const original=structuredClone(historical),definitions=structuredClone(gym.TRAINING_EXERCISES);
 const all={[historical.id]:historical};
 const next=fresh({id:'session-next',sessions:all,now:now+86400000});
 assert(next.exercises.every(exercise=>exercise.restSeconds===120));
 assert.equal(next.exercises[0].variantId,'leg-press');
 assert.equal(next.exercises[0].sets[0].loadKg,15);
 assert.equal(next.exercises[0].sets[1].loadKg,35);
 assert.equal(next.exercises[0].sets[0].kind,'warmup');
 assert(next.exercises.every(exercise=>exercise.sets.every(set=>set.reps===null&&set.durationSeconds===null&&set.completedAt===null)));
 assert.deepEqual(historical,original);
 assert.deepEqual(gym.normalizeTrainingSession(JSON.parse(JSON.stringify(historical)),historical.id),original,'Restaurar la sesión anterior no migra su descanso');
 assert.deepEqual(gym.TRAINING_EXERCISES,definitions,'El plan de referencia permanece intacto');
 const completed=record(next,0,'s0',{loadKg:15},now+86401000);
 assert.equal(completed.restUntil,now+86401000+60000,'La aproximación usa un minuto');
 const working=record(completed,0,'s1',{loadKg:35},now+86461000);
 assert.equal(working.restUntil,now+86461000+120000,'La serie efectiva usa los dos minutos elegidos');
});

test('custom new sessions get two-minute rests while saved routines and explicit import prescriptions remain intact',()=>{
 const routine={id:'custom-routine',name:'Mi rutina',createdAt:now,day:1,exercises:structuredClone(gym.TRAINING_DAYS[0].exercises).map(exercise=>({...exercise,restSeconds:35,restLabel:'35 s'}))};
 const original=structuredClone(routine);
 const next=fresh({routine});
 assert.equal(next.routineId,routine.id);
 assert(next.exercises.every(exercise=>exercise.restSeconds===120));
 assert.deepEqual(routine,original);
 assert.deepEqual(gym.normalizeTrainingRoutine(JSON.parse(JSON.stringify(routine)),routine.id),original);
 assert(fresh({routine,restSeconds:150}).exercises.every(exercise=>exercise.restSeconds===150));
 assert(fresh({routine,restSeconds:null}).exercises.every(exercise=>exercise.restSeconds===35));
 for(const restSeconds of [NaN,Infinity,-1,3601,1.5])assert(fresh({restSeconds}).exercises.every(exercise=>exercise.restSeconds===120));
});

test('S0 gets at most one minute only on explicit completion, while effective sets retain the selected rest',()=>{
 assert.equal(gym.DEFAULT_WARMUP_REST_SECONDS,60);
 for(const restSeconds of [0,45,60,90,120,150]){
  const session=fresh({restSeconds}),original=structuredClone(session);
  const warmup=record(session,0,'s0',{},now+1000);
  assert.equal(warmup.restUntil,now+1000+Math.min(restSeconds,60)*1000);
  assert.equal(warmup.exercises[0].restSeconds,restSeconds,'La prescripción guardada no se reescribe');
  const working=record(warmup,0,'s1',{},now+2000);
  assert.equal(working.restUntil,now+2000+restSeconds*1000);
  assert.deepEqual(session,original,'La sesión de entrada permanece intacta');
 }
});

test('assisted pull-up keeps factual assistance and reps but excludes it from lifted-load metrics',()=>{
 assert(gym.isTrainingAssistanceExercise({exerciseId:'plan-assisted-pullup'}));
 assert.equal(gym.isTrainingAssistanceExercise({exerciseId:'d3-e1'}),false);
 const assistance={...structuredClone(gym.TRAINING_EXERCISES[0]),id:'plan-assisted-pullup',name:'Dominada asistida',variants:[{id:'assisted-machine',name:'Dominada asistida'}]};
 const ordinary=structuredClone(gym.TRAINING_EXERCISES[0]);
 const routine={id:'assistance-routine',name:'Mi rutina mixta',createdAt:now,day:1,exercises:[assistance,ordinary]};
 let session=fresh({routine});
 session=record(record(session,0,'s0',{loadKg:60,reps:8}),0,'s1',{loadKg:50,reps:8});
 session=record(record(session,1,'s0',{loadKg:5,reps:8}),1,'s1',{loadKg:10,reps:12});
 const original=structuredClone(session),summary=gym.getTrainingSummary(session);
 assert.equal(summary.completedSets,2);assert.equal(summary.warmupSets,2);assert.equal(summary.reps,20);
 assert.equal(summary.volumeKg,120,'Sólo cuentan los 10 kg × 12 repeticiones de resistencia');
 assert.equal(summary.bestLoadKg,10,'50 kg de asistencia no se presentan como mayor carga levantada');
 assert.equal(session.exercises[0].sets.find(set=>set.id==='s1').loadKg,50,'El dato de asistencia no se borra ni transforma');
 assert.deepEqual(session,original);
 assert.deepEqual(gym.normalizeTrainingSession(JSON.parse(JSON.stringify(session)),session.id),original);
 const onlyAssistance={...session,exercises:[session.exercises[0]]};
 const assistedSummary=gym.getTrainingSummary(onlyAssistance);
 assert.equal(assistedSummary.completedSets,1);assert.equal(assistedSummary.reps,8);
 assert.equal(assistedSummary.volumeKg,0);assert.equal(assistedSummary.bestLoadKg,null);
 const legacy=record(record(fresh({restSeconds:null}),0,'s0',{loadKg:10}),0,'s1',{loadKg:20});
 assert.equal(gym.getTrainingSummary(legacy).volumeKg,200,'Los ejercicios anteriores conservan el mismo cálculo');
 assert.equal(gym.getTrainingSummary(legacy).bestLoadKg,20);
});

test('explicitly adjusting unfinished exercises keeps recorded sets, notes and running countdown deadlines',()=>{
 let session=fresh({restSeconds:null});
 session=record(record(session,0,'s0',{loadKg:10}),0,'s1',{loadKg:25});
 session={...session,notes:'Sesión con avances',restUntil:now+42000,setTimerUntil:now+19000};
 session.exercises[0].rpe=7;session.exercises[0].notes='Ya hice una serie';
 session.exercises[1].status='done';session.exercises[2].status='skipped';
 session.exercises[3].sets=session.exercises[3].sets.map(set=>({...set,loadKg:10,reps:10,completedAt:now+1000}));
 const original=structuredClone(session);
 const adjusted=gym.setPendingTrainingRest(session);
 assert.equal(adjusted.exercises[0].restSeconds,120,'La próxima serie del ejercicio actual recibe el nuevo descanso');
 assert.equal(adjusted.exercises[4].restSeconds,120);
 for(const index of [1,2,3])assert.deepEqual(adjusted.exercises[index],original.exercises[index],'Hechos, saltados y ejercicios sin series pendientes no cambian');
 const expected=structuredClone(original);
 for(const index of [0,4,5,6])expected.exercises[index].restSeconds=120;
 assert.deepEqual(adjusted,expected,'Únicamente se modifica la prescripción pendiente');
 assert.deepEqual(session,original,'El registro de entrada no se muta');
 assert.equal(adjusted.exercises[0].sets,session.exercises[0].sets,'Series y cargas permanecen exactamente en el mismo objeto');
 assert.equal(gym.setPendingTrainingRest(adjusted),adjusted,'La operación repetida no agrega datos');
});

test('rest adjustment respects paused timers and never rewrites ended or imported sessions',()=>{
 let active=fresh({restSeconds:null});active=gym.startTrainingRest(active,90,now);active=gym.startTrainingSetTimer(active,30,now);
 const paused=gym.pauseTrainingSession(active,now+10000);
 const adjusted=gym.setPendingTrainingRest(paused);
 assert.equal(adjusted.status,'paused');assert.equal(adjusted.restUntil,null);assert.equal(adjusted.setTimerUntil,null);
 assert.equal(adjusted.pausedRestSeconds,80);assert.equal(adjusted.pausedSetSeconds,20);
 assert.equal(adjusted.elapsedSeconds,paused.elapsedSeconds);
 for(const session of [gym.finishTrainingSession(active,now+10000),gym.finishTrainingSession(active,now+10000,'abandoned'),{...active,status:'imported',activeStartedAt:null}])assert.equal(gym.setPendingTrainingRest(session),session);
 for(const seconds of [NaN,Infinity,-1,3601,1.5])assert.equal(gym.setPendingTrainingRest(active,seconds),active);
});

function rotationSession({id='rotation',date='2026-11-04',day=3,status='active'}={}) {
 const start=Date.parse(`${date}T09:00:00-03:00`);
 let session=fresh({id,date,day,week:4,now:start});
 if(session.exercises[0].hasWarmupSet)session=record(session,0,'s0',{},start+1000);
 session=record(session,0,'s1',{},start+2000);
 if(status==='completed'||status==='abandoned')session=gym.finishTrainingSession(session,start+100000,status);
 if(status==='paused')session=gym.pauseTrainingSession(session,start+100000);
 return session;
}

test('rotation advances from a past unclosed session with actual working sets without closing or changing it',()=>{
 const previous=rotationSession();previous.notes='Quedó abierta pero registré las series';
 const all={[previous.id]:previous},original=structuredClone(all);
 assert.deepEqual(gym.getTrainingDaySuggestion(all,'2026-11-05'),{day:1,previousDate:'2026-11-04',previousTitle:'Espalda y tríceps',previousUnclosed:true});
 assert.deepEqual(gym.getTrainingDaySuggestion(all,'2026-11-04'),{day:3},'La misma fecha retoma la sesión abierta');
 assert.deepEqual(all,original,'La sugerencia no escribe un cierre ni altera cargas, notas o semana');
 assert.equal(all[previous.id].week,4,'No se avanza de semana automáticamente');
});

test('rotation uses actual working sets from completed, partial, paused and unclosed past sessions',()=>{
 for(const status of ['active','paused','completed','abandoned']){
  const session=rotationSession({status,day:2});const original=structuredClone(session);
  const suggestion=gym.getTrainingDaySuggestion({one:session},'2026-11-05');
  assert.equal(suggestion.day,3,status);
  assert.equal(suggestion.previousUnclosed,status==='active'||status==='paused');
  assert.equal(suggestion.previousDate,'2026-11-04');
  assert.deepEqual(session,original);
 }
});

test('rotation ignores empty drafts, warmup-only, future, imported and unverified-date records',()=>{
 const actual=rotationSession({id:'actual',date:'2026-10-30',day:1,status:'completed'});
 const empty=fresh({id:'empty',date:'2026-11-04',day:3,now:Date.parse('2026-11-04T14:00:00Z')});
 const warmup=record(fresh({id:'warmup',date:'2026-11-04',day:3,now:Date.parse('2026-11-04T12:00:00Z')}),0,'s0',{},Date.parse('2026-11-04T12:00:01Z'));
 const future=rotationSession({id:'future',date:'2026-11-06',day:3});
 const imported={...rotationSession({id:'imported',date:'2026-11-03',day:3}),status:'imported',activeStartedAt:null};
 const unknown={...rotationSession({id:'unknown',date:'2026-11-04',day:3,status:'completed'}),legacyDateUnknown:true};
 const all={actual,empty,warmup,future,imported,unknown},original=structuredClone(all);
 assert.deepEqual(gym.getTrainingDaySuggestion(all,'2026-11-05'),{day:2,previousDate:'2026-10-30',previousTitle:'Tren inferior',previousUnclosed:false});
 assert.deepEqual(all,original);
});

test('rotation resumes a selected-date draft before suggesting another block and advances completed same-day work',()=>{
 const completed=rotationSession({id:'completed',date:'2026-11-05',day:2,status:'completed'});
 assert.equal(gym.getTrainingDaySuggestion({completed},'2026-11-05').day,3);
 for(const status of ['active','paused']){
  let draft=fresh({id:'today-draft',date:'2026-11-05',day:1,now:Date.parse('2026-11-05T14:00:00Z')});
  if(status==='paused')draft=gym.pauseTrainingSession(draft,draft.startedAt+1000);
  assert.deepEqual(gym.getTrainingDaySuggestion({completed,draft},'2026-11-05'),{day:1});
 }
 assert.deepEqual(gym.getTrainingDaySuggestion({},'2026-11-05'),{day:1});
 assert.deepEqual(gym.getTrainingDaySuggestion({completed},'2026-02-30'),{day:1});
 assert.deepEqual(gym.getTrainingDaySuggestion({completed},'2026-11-04'),{day:1},'No se consulta un entrenamiento del futuro');
});

test('an active session from a closed day stops accumulating projected time after midnight',()=>{
 const start=new Date(2026,9,19,23,59,30).getTime();
 const session=fresh({date:'2026-10-19',now:start});const snapshot=JSON.stringify(session);
 assert.equal(gym.getTrainingElapsed(session,new Date(2026,9,20,0,2).getTime()),30);
 assert.equal(gym.getTrainingElapsed(session,new Date(2026,9,21,12).getTime()),30);
 assert.equal(JSON.stringify(session),snapshot);
});

test('retains original four weeks, three days, all 21 exercises and original source IDs without seeded 60kg data',()=>{
 assert.equal(gym.TRAINING_WEEKS.length,4);assert.equal(gym.TRAINING_DAYS.length,3);assert.equal(gym.TRAINING_EXERCISES.length,21);
 const session=fresh();assert.equal(session.exercises[0].sourceExerciseId,'w1-d1-e1');
 assert.equal(session.exercises[0].sets[0].kind,'warmup');
 assert(session.exercises.every(exercise=>exercise.sets.every(set=>set.loadKg===null&&set.completedAt===null)));
 assert.deepEqual(gym.normalizeTrainingSession(session,session.id),session);
});
test('records real repetitions and weight, approximation stays separate from work volume and must come first',()=>{
 let session=fresh();session=record(session,0,'s1');assert.equal(session.exercises[0].sets[1].completedAt,null);
 session=record(session,0,'s0',{loadKg:10,reps:8});session=record(session,0,'s1',{loadKg:20,reps:10});
 assert.equal(gym.getTrainingSummary(session).warmupSets,1);assert.equal(gym.getTrainingSummary(session).completedSets,1);
 assert.equal(gym.getTrainingSummary(session).volumeKg,200);assert.equal(session.exercises[0].status,'pending');
 session=record(record(session,0,'s2'),0,'s3');assert.equal(session.exercises[0].status,'done');
 assert.equal(gym.getTrainingSummary(session).reps,30);
});
test('a complete button never invents repetitions and cannot be counted twice',()=>{
 const session=fresh();assert.equal(gym.completeTrainingSet(session,0,'s0',now+1),session);
 const done=record(session,0,'s0');assert.equal(gym.completeTrainingSet(done,0,'s0',now+2),done);
 const decimal=gym.updateTrainingSet(session,0,'s0',{reps:2.5,loadKg:12.5});assert.equal(decimal.exercises[0].sets[0].reps,null);assert.equal(decimal.exercises[0].sets[0].loadKg,12.5);
});
test('next session remembers the actual variant and previous load without increasing or marking new sets done',()=>{
 let old=gym.changeTrainingVariant(fresh(),0,'leg-press');old=record(record(old,0,'s0',{loadKg:30}),0,'s1',{loadKg:60});
 const next=fresh({id:'session-two',week:2,sessions:{[old.id]:old},now:now+86400000});
 assert.equal(next.exercises[0].variantId,'leg-press');assert.equal(next.exercises[0].sets[1].loadKg,60);
 assert.equal(next.exercises[0].sets[1].reps,null);assert.equal(next.exercises[0].sets[1].completedAt,null);
 const goblet=gym.changeTrainingVariant(next,0,'goblet',{[old.id]:old});assert.equal(goblet.exercises[0].sets[1].loadKg,null);
 assert.equal(gym.changeTrainingVariant(old,0,'goblet'),old);
});
test('timestamps survive reload/background and pause freezes session, rest and timed exercise',()=>{
 let session=fresh();session=gym.startTrainingRest(session,90,now);session=gym.startTrainingSetTimer(session,45,now);
 assert.equal(gym.getTrainingElapsed(JSON.parse(JSON.stringify(session)),now+30000),30);
 assert.equal(gym.getRestRemaining(session,now+30000),60);assert.equal(gym.getSetRemaining(session,now+30000),15);
 session=gym.pauseTrainingSession(session,now+30000);assert.equal(gym.getTrainingElapsed(session,now+999999),30);
 assert.equal(gym.getRestRemaining(session,now+999999),60);assert.equal(gym.getSetRemaining(session,now+999999),15);
 session=gym.resumeTrainingSession(session,now+999999);assert.equal(gym.getRestRemaining(session,now+1009999),50);
 assert.equal(gym.getSetRemaining(session,now+1009999),5);assert.equal(gym.getTrainingElapsed(session,now+1009999),40);
 assert(gym.normalizeTrainingSession(session));
 const finished=gym.finishTrainingSession(session,now+1009999);assert.equal(gym.getTrainingElapsed(finished,now+2000000),40);
 assert.equal(gym.getRestRemaining(finished),0);assert.equal(gym.getSetRemaining(finished),0);
});
test('independently paused rest and set timers retain remaining time across serialization',()=>{
 const session={...fresh(),pausedRestSeconds:34,pausedSetSeconds:12};
 assert.equal(gym.getRestRemaining(session,now+999999),34);assert.equal(gym.getSetRemaining(session,now+999999),12);
 assert(gym.normalizeTrainingSession(session));
 const paused=gym.pauseTrainingSession(session,now+1000);const resumed=gym.resumeTrainingSession(paused,now+999999);
 assert.equal(resumed.restUntil,null);assert.equal(resumed.setTimerUntil,null);
 assert.equal(gym.getRestRemaining(resumed,now+1999999),34);assert.equal(gym.getSetRemaining(resumed,now+1999999),12);
 assert(gym.normalizeTrainingSession(resumed));
});
test('timed core sets record actual seconds, optional S0 and S4 stay supported',()=>{
 let session=fresh();session=gym.updateTrainingSet(session,6,'s1',{durationSeconds:37});session=gym.completeTrainingSet(session,6,'s1',now+40000);
 assert.equal(gym.getTrainingSummary(session).durationSeconds,37);assert.equal(gym.getTrainingSummary(session).reps,0);
 assert.equal(gym.getTrainingSummary(session).bestLoadKg,null);
 session=gym.addTrainingSet(session,6,'warmup');session=gym.addTrainingSet(session,6);assert.equal(session.exercises[6].sets.length,5);
 assert.equal(gym.addTrainingSet(session,6),session);assert.equal(gym.addTrainingSet(session,6,'warmup'),session);
 assert.equal(gym.removeTrainingSet(session,6,'s1'),session);
 session=gym.removeTrainingSet(session,6,'s4');assert.equal(session.exercises[6].sets.length,4);
 assert(gym.normalizeTrainingSession(session));
});
test('adding a set fills a removed slot and never creates invalid S5',()=>{
 let session=gym.addTrainingSet(fresh(),0);session=gym.removeTrainingSet(session,0,'s2');session=gym.addTrainingSet(session,0);
 assert.deepEqual(session.exercises[0].sets.map(set=>set.id),['s0','s1','s2','s3','s4']);
 assert.equal(session.exercises[0].targetSets,4);assert(gym.normalizeTrainingSession(session));
});
test('a warmup-only later attempt cannot erase earlier factual working loads',()=>{
 let old=record(record(fresh(),0,'s0',{loadKg:15}),0,'s1',{loadKg:35});
 let warmup=fresh({id:'warmup-only',sessions:{[old.id]:old},now:now+86400000});warmup=record(warmup,0,'s0',{loadKg:10,reps:8},now+86401000);
 const next=fresh({id:'next',sessions:{[old.id]:old,[warmup.id]:warmup},now:now+172800000});
 assert.equal(next.exercises[0].sets[1].loadKg,35);
 assert.equal(next.exercises[0].sets[0].loadKg,10);
});
test('strict records reject foreign keys, mismatched IDs, impossible marks and invalid variants',()=>{
 const session=fresh();assert.equal(gym.normalizeTrainingSession(session,'foreign'),undefined);
 assert.equal(gym.normalizeTrainingSession({...session,uid:'private'}),undefined);
 assert.equal(gym.normalizeTrainingSession({...session,date:'2026-02-30'}),undefined);
 const invalid=structuredClone(session);invalid.exercises[0].variantId='other-machine';assert.equal(gym.normalizeTrainingSession(invalid),undefined);
 const fake=structuredClone(session);fake.exercises[0].sets[0].completedAt=now;assert.equal(gym.normalizeTrainingSession(fake),undefined);
 const early=record(session,0,'s0',{},now-1);assert.equal(gym.normalizeTrainingSession(early),undefined);
});
test('custom routines normalize, create executable sessions, and preserve their own exercise identities',()=>{
 const routine={id:'my-routine',name:'Mi sesión',createdAt:now,day:1,exercises:[{...gym.TRAINING_EXERCISES[0],id:'custom-squat',variants:[{id:'custom',name:'Mi sentadilla'}]}]};
 assert.deepEqual(gym.normalizeTrainingRoutine(routine,routine.id),routine);
 const session=fresh({routine});assert.equal(session.title,'Mi sesión');assert.equal(session.exercises.length,1);assert.equal(session.routineId,routine.id);
 assert(gym.normalizeTrainingSession(session));
 assert.equal(gym.normalizeTrainingRoutine({...routine,exercises:[routine.exercises[0],routine.exercises[0]]}),undefined);
});
test('legacy import omits seeded demo, keeps factual loads/effort/notes without making up reps or workouts',()=>{
 const seed=legacyExercise({hasWarmupSet:false,loads:{s0:60,s1:60,s2:60,s3:60},status:'Hecho'});
 assert.equal(gym.importLegacyTraining(legacy([seed]),now).importedCount,0);
 const input=legacy([legacyExercise({loads:{s1:37.5},status:'Hecho',rpe:7.5,discomfort:0,notes:'Técnica cómoda'})]);
 const result=gym.importLegacyTraining(JSON.stringify(input),now);assert.equal(result.importedCount,1);
 const session=Object.values(result.sessions)[0];assert.equal(session.status,'imported');assert.equal(session.legacyDateUnknown,true);
 assert.equal(session.exercises[0].variantId,'legacy-unspecified');assert.equal(session.exercises[0].sets[1].loadKg,37.5);
 assert.equal(session.exercises[0].rpe,7.5);assert.equal(session.exercises[0].sets[1].reps,null);assert.equal(gym.getTrainingSummary(session).completedSets,0);
 const next=fresh({sessions:result.sessions});assert.equal(next.exercises[0].sets[1].loadKg,null);
});
test('legacy edit dates are retained separately from unverified training dates; custom routines execute and malformed data rejects atomically',()=>{
 const input=legacy([legacyExercise({loads:{s1:20},status:'Ajustar'})],{
  logs:[{sourceExerciseId:'w1-d1-e1',completedAt:'2026-10-18T22:00:00.000Z'}],
  customSessions:[{id:'session-a',name:'Extra',createdAt:'2026-10-18T12:00:00Z',block:'Tren inferior',exercises:[{id:'exercise-a',name:'Mi ejercicio',primaryMuscle:'Piernas',secondaryMuscles:'Core',targetSetsReps:'2–3 x 10–12',restLabel:'2 min',hasWarmupSet:true,instructions:'Control'}]}]
 });
 const result=gym.importLegacyTraining(input,now);assert.equal(Object.values(result.sessions)[0].legacyDateUnknown,true);
 assert.equal(Object.values(result.sessions)[0].legacyEditedAt,Date.parse('2026-10-18T22:00:00.000Z'));
 const routine=Object.values(result.routines)[0];assert.equal(routine.exercises[0].targetSets,3);assert.equal(routine.exercises[0].repsMin,10);assert.equal(routine.exercises[0].restSeconds,120);
 assert(gym.normalizeTrainingSession(fresh({routine})));
 const malformed=structuredClone(input);malformed.state.plan.weeks[0].days[0].exercises.push(legacyExercise({id:'w1-d1-e2',loads:{s1:-20}}));
 assert.throws(()=>gym.importLegacyTraining(malformed));assert.throws(()=>gym.importLegacyTraining({...input,version:9}));assert.throws(()=>gym.importLegacyTraining({state:{plan:{weeks:[]}}}));
});
test('rest and target parsers preserve original range and minute notation',()=>{
 assert.equal(gym.parseTrainingRest('75–90 s'),90);assert.equal(gym.parseTrainingRest('1 min 30 s'),90);assert.equal(gym.parseTrainingRest('2 minutos'),120);
 assert.deepEqual(gym.parseTrainingTarget('2–3 x 10–12'),{targetSets:3,repsMin:10,repsMax:12,secondsTarget:null});
 assert.deepEqual(gym.parseTrainingTarget('3 x 30–45 s'),{targetSets:3,repsMin:0,repsMax:0,secondsTarget:30});
});
