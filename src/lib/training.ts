/** The user's original four-week gym plan, with factual session records kept separately. */
export type TrainingDayNumber = 1 | 2 | 3;
export type TrainingWeekNumber = 1 | 2 | 3 | 4;
export type TrainingExerciseStatus = 'pending' | 'done' | 'adjust' | 'skipped';
export interface TrainingVariant { id: string; name: string }
export interface TrainingExerciseDefinition {
  id: string; day: TrainingDayNumber; order: number; name: string; primaryMuscle: string;
  secondaryMuscles: string; instructions: string; hasWarmupSet: boolean; targetSets: number;
  repsMin: number; repsMax: number; secondsTarget: number | null; restSeconds: number;
  restLabel: string; variants: TrainingVariant[];
}
export interface TrainingSet {
  id: string; kind: 'warmup' | 'working'; loadKg: number | null; reps: number | null;
  durationSeconds: number | null; completedAt: number | null;
}
export interface TrainingExerciseLog {
  exerciseId: string; sourceExerciseId: string; variantId: string; name: string;
  primaryMuscle: string; targetSets: number; repsMin: number; repsMax: number;
  secondsTarget: number | null; restSeconds: number; hasWarmupSet: boolean;
  sets: TrainingSet[]; status: TrainingExerciseStatus; rpe: number | null;
  discomfort: number | null; notes: string;
}
export interface TrainingSession {
  id: string; date: string; week: TrainingWeekNumber; day: TrainingDayNumber; title: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned' | 'imported';
  startedAt: number; completedAt: number | null; activeStartedAt: number | null;
  elapsedSeconds: number; restUntil: number | null; pausedRestSeconds: number | null;
  setTimerUntil: number | null; pausedSetSeconds: number | null;
  restPausedBeforeSession?: boolean;
  setPausedBeforeSession?: boolean;
  currentExercise: number; exercises: TrainingExerciseLog[]; notes: string;
  /** Old app stored loads/status but never actual repetitions or session duration. */
  legacySourceId?: string;
  legacyDateUnknown?: boolean;
  legacyEditedAt?: number;
  routineId?: string;
}
export interface TrainingRoutine {
  id: string; name: string; createdAt: number; day: TrainingDayNumber;
  exercises: TrainingExerciseDefinition[];
}
export type TrainingSessions = Record<string, TrainingSession>;

type TemplateRow = [TrainingDayNumber, string, string, string, boolean, number, number, number, number | null, string, string, string];
const rows: TemplateRow[] = [
  [1,'Sentadilla goblet / prensa','Cuádriceps / glúteos','Core, espalda baja',true,3,8,10,null,'90 s','S0 liviana antes de las series efectivas','goblet:Sentadilla goblet|leg-press:Prensa'],
  [1,'Peso muerto rumano con mancuernas','Isquios / glúteos','Espalda baja',true,3,8,10,null,'90 s','S0 técnica con menos carga','romanian-dumbbell:Peso muerto rumano con mancuernas'],
  [1,'Hip thrust / puente de glúteos','Glúteos','Isquios',true,3,10,12,null,'75–90 s','S0 de activación','hip-thrust:Hip thrust|glute-bridge:Puente de glúteos'],
  [1,'Extensión de cuádriceps','Cuádriceps','Rodilla estable',false,3,12,15,null,'60 s','Controlá bajada y rango sin dolor','leg-extension:Extensión de cuádriceps'],
  [1,'Curl femoral','Isquios','Gemelos',false,3,10,12,null,'60 s','Sin rebotes','leg-curl:Curl femoral'],
  [1,'Elevación de gemelos','Gemelos','Tobillo',false,3,12,20,null,'45–60 s','Pausa arriba y abajo','calf-raise:Elevación de gemelos'],
  [1,'Plancha frontal','Core','Estabilidad',false,3,0,0,30,'45 s','Respirá sin colapsar lumbar','front-plank:Plancha frontal'],
  [2,'Press de pecho en máquina / mancuernas','Pecho','Tríceps, hombro anterior',true,3,8,10,null,'90 s','S0 liviana y control escapular','machine-chest-press:Press de pecho en máquina|dumbbell-chest-press:Press de pecho con mancuernas'],
  [2,'Press inclinado con mancuernas','Pecho superior','Hombro anterior',true,3,8,10,null,'75–90 s','S0 si vas a cargar fuerte','incline-dumbbell-press:Press inclinado con mancuernas'],
  [2,'Aperturas en máquina / mancuernas','Pecho','Estabilidad escapular',false,3,10,12,null,'60 s','Movimiento amplio pero cómodo','machine-fly:Aperturas en máquina|dumbbell-fly:Aperturas con mancuernas'],
  [2,'Curl bíceps con mancuernas','Bíceps','Antebrazo',false,3,10,12,null,'60 s','Codo fijo, sin balanceo','dumbbell-curl:Curl bíceps con mancuernas'],
  [2,'Curl martillo','Bíceps braquial / braquial','Antebrazo',false,3,10,12,null,'60 s','Muñeca neutra','hammer-curl:Curl martillo'],
  [2,'Elevaciones laterales','Hombro lateral','Trapecio medio',false,3,12,15,null,'45–60 s','Poco peso, control','lateral-raise:Elevaciones laterales'],
  [2,'Dead bug / hollow hold suave','Core','Respiración',false,3,8,12,null,'45 s','Priorizar control lumbo-pélvico','dead-bug:Dead bug|hollow-hold:Hollow hold suave'],
  [3,'Jalón al pecho','Dorsales','Bíceps, romboides',true,3,8,10,null,'90 s','S0 liviana, hombros lejos de orejas','lat-pulldown:Jalón al pecho'],
  [3,'Remo sentado / remo con mancuerna','Espalda media','Dorsales, bíceps',true,3,8,10,null,'90 s','S0 técnica antes de cargar','cable-row:Remo sentado|dumbbell-row:Remo con mancuerna'],
  [3,'Pull-over en polea / máquina','Dorsales','Serrato, core',false,3,10,12,null,'60 s','No doblar de más los codos','cable-pullover:Pull-over en polea|machine-pullover:Pull-over en máquina'],
  [3,'Face pull / pájaros','Deltoide posterior','Trapecio medio',false,3,12,15,null,'45–60 s','Ligero y limpio','face-pull:Face pull|reverse-fly:Pájaros'],
  [3,'Extensión de tríceps con cuerda en polea','Tríceps','Codo controlado',false,3,10,12,null,'60 s','Codo estable, sin dolor','rope-pushdown:Extensión de tríceps con cuerda'],
  [3,'Extensión sobre cabeza con cuerda o mancuerna','Tríceps cabeza larga','Hombro',false,3,10,12,null,'60 s','Liviana si sentís articulación. El plan original permite 2–3 series.','cable-overhead:Extensión sobre cabeza con cuerda|dumbbell-overhead:Extensión sobre cabeza con mancuerna'],
  [3,'Pallof press / plancha lateral','Core','Oblicuos',false,3,10,12,null,'45 s','Anti-rotación, control','pallof-press:Pallof press|side-plank:Plancha lateral'],
];
export const TRAINING_EXERCISES: TrainingExerciseDefinition[] = rows.map((row, index) => ({
  id: `d${row[0]}-e${index % 7 + 1}`, day: row[0], order: index % 7 + 1,
  name: row[1], primaryMuscle: row[2], secondaryMuscles: row[3], hasWarmupSet: row[4],
  targetSets: row[5], repsMin: row[6], repsMax: row[7], secondsTarget: row[8],
  restLabel: row[9], restSeconds: parseTrainingRest(row[9]), instructions: row[10],
  variants: row[11].split('|').map(value => { const [id, name] = value.split(':'); return {id,name}; }),
}));
export const TRAINING_DAYS = ([1,2,3] as const).map((day,index) => ({
  day, title: ['Tren inferior','Pecho y bíceps','Espalda y tríceps'][index],
  focus: ['Piernas, glúteos y core','Pecho, bíceps, hombro lateral y core','Dorsales, espalda media, tríceps, deltoide posterior y core'][index],
  exercises: TRAINING_EXERCISES.filter(exercise => exercise.day === day),
}));
export const TRAINING_WEEKS = ([
  [1,'Base técnica','Usá cargas cómodas, técnica controlada y 2–3 repeticiones en reserva.'],
  [2,'Progresión suave','El plan original propone sumar 1–2 repeticiones o 2,5–5% de carga si la técnica se mantiene. Vos decidís cada ajuste.'],
  [3,'Semana fuerte controlada','El plan original sugiere RPE 8 en la última serie de los básicos, sin romper técnica.'],
  [4,'Deload / consolidación','El plan original propone bajar 10–15% la carga o una serie principal. No se aplican cambios automáticos.'],
] as const).map(([week,focus,guidance])=>({week,focus,guidance}));

export function parseTrainingRest(label: string): number {
  const minutes=label.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(?:minutos?|mins?|m)\b/);
  if(minutes){
    const seconds=label.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(?:segundos?|secs?|s)\b/);
    return Math.max(0,Math.min(3600,Math.round(Number(minutes[1].replace(',','.'))*60+(seconds?Number(seconds[1].replace(',','.')):0))));
  }
  const values = label.match(/\d+(?:[.,]\d+)?/g);
  return values?.length ? Math.max(0,Math.min(3600,Math.round(Number(values.at(-1)!.replace(',','.'))))) : 60;
}
export function parseTrainingTarget(label:string):{targetSets:number;repsMin:number;repsMax:number;secondsTarget:number|null} {
  const parts=label.toLowerCase().split(/[x×]/);
  const sets=parts[0]?.match(/\d+/g)?.map(Number)??[3];
  const reps=parts[1]?.match(/\d+/g)?.map(Number)??[10,12];
  const timed=/\b(?:s|segundos?|secs?)\b/.test(parts[1]??'');
  return {targetSets:Math.max(1,Math.min(4,sets.at(-1)??3)),repsMin:timed?0:reps[0],repsMax:timed?0:reps.at(-1)??reps[0],secondsTarget:timed?reps[0]:null};
}
export function getTrainingExercise(id: string) { return TRAINING_EXERCISES.find(exercise=>exercise.id===id.replace(/^w[1-4]-/,'')); }
export function isTimedTrainingExercise(exercise: Pick<TrainingExerciseLog,'variantId'|'secondsTarget'>) {
  return exercise.secondsTarget !== null || ['front-plank','hollow-hold','side-plank'].includes(exercise.variantId);
}
export function getPreviousExercise(sessions: TrainingSessions, exerciseId: string, variantId: string, excludeSessionId?: string): TrainingExerciseLog | undefined {
  return Object.values(sessions).filter(session=>session.id!==excludeSessionId && session.status!=='imported')
    .sort((a,b)=>b.startedAt-a.startedAt || b.id.localeCompare(a.id))
    .flatMap(session=>session.exercises)
    .find(exercise=>exercise.exerciseId===exerciseId && exercise.variantId===variantId && exercise.sets.some(set=>set.kind==='working'&&set.completedAt!==null));
}
export function getPreviousTrainingSet(sessions:TrainingSessions,exerciseId:string,variantId:string,setId:string,excludeSessionId?:string):TrainingSet|undefined {
  return Object.values(sessions).filter(session=>session.id!==excludeSessionId&&session.status!=='imported')
    .flatMap(session=>session.exercises.filter(exercise=>exercise.exerciseId===exerciseId&&exercise.variantId===variantId))
    .flatMap(exercise=>exercise.sets.filter(set=>set.id===setId&&set.completedAt!==null))
    .sort((a,b)=>(b.completedAt??0)-(a.completedAt??0))[0];
}
export function createTrainingSession(options: {id:string;date:string;week:TrainingWeekNumber;day:TrainingDayNumber;sessions?:TrainingSessions;now?:number;routine?:TrainingRoutine}): TrainingSession {
  const {id,date,week,day,routine} = options; const now=options.now??Date.now();
  const definitions=routine?.exercises??TRAINING_DAYS[day-1].exercises;
  return {
    id,date,week,day,title:routine?.name??TRAINING_DAYS[day-1].title,status:'active',startedAt:now,completedAt:null,
    activeStartedAt:now,elapsedSeconds:0,restUntil:null,pausedRestSeconds:null,setTimerUntil:null,pausedSetSeconds:null,
    currentExercise:0,notes:'',...(routine?{routineId:routine.id}:{}),
    exercises:definitions.map(definition=>{
      const lastVariant=Object.values(options.sessions??{}).filter(session=>session.status!=='imported')
        .sort((a,b)=>b.startedAt-a.startedAt).flatMap(session=>session.exercises)
        .find(exercise=>exercise.exerciseId===definition.id&&exercise.sets.some(set=>set.completedAt!==null))?.variantId;
      const variant=definition.variants.find(variant=>variant.id===lastVariant)??definition.variants[0];
      const previous=getPreviousExercise(options.sessions??{},definition.id,variant.id,id);
      const makeSet=(index:number):TrainingSet=>{
        const previousSet=getPreviousTrainingSet(options.sessions??{},definition.id,variant.id,`s${index}`,id);
        const fallback=index>0?previous?.sets.find(set=>set.kind==='working'&&set.completedAt!==null):undefined;
        return {id:`s${index}`,kind:index===0?'warmup':'working',loadKg:previousSet?.loadKg??fallback?.loadKg??null,reps:null,durationSeconds:null,completedAt:null};
      };
      return {
        exerciseId:definition.id,sourceExerciseId:routine?`${routine.id}-${definition.id}`:`w${week}-${definition.id}`,
        variantId:variant.id,name:variant.name,primaryMuscle:definition.primaryMuscle,targetSets:definition.targetSets,
        repsMin:definition.repsMin,repsMax:definition.repsMax,secondsTarget:definition.secondsTarget,
        restSeconds:definition.restSeconds,hasWarmupSet:definition.hasWarmupSet,
        sets:[...(definition.hasWarmupSet?[makeSet(0)]:[]),...Array.from({length:definition.targetSets},(_,i)=>makeSet(i+1))],
        status:'pending',rpe:null,discomfort:null,notes:'',
      };
    }),
  };
}
export function getTrainingElapsed(session: TrainingSession, now=Date.now()): number {
  return Math.max(0,Math.floor(session.elapsedSeconds+(session.status==='active'&&session.activeStartedAt!==null?(now-session.activeStartedAt)/1000:0)));
}
export function getRestRemaining(session: TrainingSession, now=Date.now()): number {
  return session.status==='paused'||session.restUntil===null?session.pausedRestSeconds??0:Math.max(0,Math.ceil((session.restUntil-now)/1000));
}
export function getSetRemaining(session: TrainingSession, now=Date.now()): number {
  return session.status==='paused'||session.setTimerUntil===null?session.pausedSetSeconds??0:Math.max(0,Math.ceil((session.setTimerUntil-now)/1000));
}
export function pauseTrainingSession(session: TrainingSession, now=Date.now()): TrainingSession {
  if(session.status!=='active')return session;
  return {...session,status:'paused',elapsedSeconds:getTrainingElapsed(session,now),activeStartedAt:null,
    restPausedBeforeSession:session.restUntil===null&&session.pausedRestSeconds!==null,
    setPausedBeforeSession:session.setTimerUntil===null&&session.pausedSetSeconds!==null,
    pausedRestSeconds:session.restUntil===null?session.pausedRestSeconds:getRestRemaining(session,now),restUntil:null,
    pausedSetSeconds:session.setTimerUntil===null?session.pausedSetSeconds:getSetRemaining(session,now),setTimerUntil:null};
}
export function resumeTrainingSession(session: TrainingSession, now=Date.now()): TrainingSession {
  if(session.status!=='paused')return session;
  return {...session,status:'active',activeStartedAt:now,
    restUntil:session.pausedRestSeconds===null||session.restPausedBeforeSession?null:now+session.pausedRestSeconds*1000,
    pausedRestSeconds:session.restPausedBeforeSession?session.pausedRestSeconds:null,
    setTimerUntil:session.pausedSetSeconds===null||session.setPausedBeforeSession?null:now+session.pausedSetSeconds*1000,
    pausedSetSeconds:session.setPausedBeforeSession?session.pausedSetSeconds:null,
    restPausedBeforeSession:false,setPausedBeforeSession:false};
}
export function startTrainingRest(session:TrainingSession,seconds:number,now=Date.now()):TrainingSession {
  if(!['active','paused'].includes(session.status))return session;
  const duration=Math.max(0,Math.min(3600,Math.round(seconds)));
  return session.status==='paused'?{...session,pausedRestSeconds:duration,restUntil:null}:{...session,restUntil:now+duration*1000,pausedRestSeconds:null};
}
export function startTrainingSetTimer(session:TrainingSession,seconds:number,now=Date.now()):TrainingSession {
  if(!['active','paused'].includes(session.status))return session;
  const duration=Math.max(0,Math.min(7200,Math.round(seconds)));
  return session.status==='paused'?{...session,pausedSetSeconds:duration,setTimerUntil:null}:{...session,setTimerUntil:now+duration*1000,pausedSetSeconds:null};
}
export function updateTrainingSet(session:TrainingSession,exerciseIndex:number,setId:string,patch:Partial<Pick<TrainingSet,'loadKg'|'reps'|'durationSeconds'>>,_now=Date.now()):TrainingSession {
  if(!['active','paused'].includes(session.status))return session;
  const exercise=session.exercises[exerciseIndex]; if(!exercise)return session;
  const validPatch:typeof patch={};
  for(const field of ['loadKg','reps','durationSeconds'] as const){
    const value=patch[field]; const max=field==='loadKg'?2000:field==='reps'?1000:7200;
    if(value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max&&(field==='loadKg'||Number.isInteger(value))))validPatch[field]=value;
  }
  return {...session,exercises:session.exercises.map((value,index)=>index===exerciseIndex?{...value,sets:value.sets.map(set=>set.id===setId?{...set,...validPatch}:set)}:value)};
}
export function canCompleteTrainingSet(exercise:TrainingExerciseLog,set:TrainingSet):boolean {
  return isTimedTrainingExercise(exercise)?(set.durationSeconds??0)>0:(set.reps??0)>0;
}
export function completeTrainingSet(session:TrainingSession,exerciseIndex:number,setId:string,now=Date.now()):TrainingSession {
  if(session.status!=='active')return session;
  const exercise=session.exercises[exerciseIndex];const set=exercise?.sets.find(set=>set.id===setId);
  if(!exercise||!set||set.completedAt!==null||!canCompleteTrainingSet(exercise,set))return session;
  if(set.kind==='working'&&exercise.sets.some(value=>value.kind==='warmup'&&value.completedAt===null))return session;
  const sets=exercise.sets.map(value=>value.id===setId?{...value,completedAt:now}:value);
  const done=sets.filter(set=>set.kind==='working').every(set=>set.completedAt!==null);
  return {...session,restUntil:now+exercise.restSeconds*1000,pausedRestSeconds:null,setTimerUntil:null,pausedSetSeconds:null,
    exercises:session.exercises.map((value,index)=>index===exerciseIndex?{...value,sets,status:done?'done':value.status}:value)};
}
export function finishTrainingSession(session:TrainingSession,now=Date.now(),status:'completed'|'abandoned'='completed'):TrainingSession {
  if(!['active','paused'].includes(session.status))return session;
  return {...session,status,completedAt:now,elapsedSeconds:getTrainingElapsed(session,now),activeStartedAt:null,restUntil:null,pausedRestSeconds:null,setTimerUntil:null,pausedSetSeconds:null,restPausedBeforeSession:false,setPausedBeforeSession:false};
}
export function changeTrainingVariant(session:TrainingSession,index:number,variantId:string,sessions:TrainingSessions={}):TrainingSession {
  const exercise=session.exercises[index]; const definition=exercise&&getTrainingExercise(exercise.exerciseId);
  const variant=definition?.variants.find(value=>value.id===variantId);
  if(!exercise||!variant||exercise.sets.some(set=>set.completedAt!==null)||!['active','paused'].includes(session.status))return session;
  const previous=getPreviousExercise(sessions,exercise.exerciseId,variantId,session.id);
  return {...session,restUntil:null,setTimerUntil:null,pausedRestSeconds:null,pausedSetSeconds:null,
    exercises:session.exercises.map((value,i)=>i===index?{...value,variantId,name:variant.name,
      sets:value.sets.map(set=>({...set,loadKg:getPreviousTrainingSet(sessions,exercise.exerciseId,variantId,set.id,session.id)?.loadKg??previous?.sets.find(previousSet=>previousSet.id===set.id&&previousSet.completedAt!==null)?.loadKg??null,reps:null,durationSeconds:null}))}:value)};
}
export function addTrainingSet(session:TrainingSession,index:number,kind:'warmup'|'working'='working'):TrainingSession {
  const exercise=session.exercises[index];if(!exercise||!['active','paused'].includes(session.status))return session;
  if(kind==='warmup'&&exercise.sets.some(set=>set.kind==='warmup'))return session;
  const working=exercise.sets.filter(set=>set.kind==='working');if(kind==='working'&&working.length>=4)return session;
  const set:TrainingSet={id:kind==='warmup'?'s0':(['s1','s2','s3','s4'].find(id=>!working.some(set=>set.id===id))!),kind,loadKg:null,reps:null,durationSeconds:null,completedAt:null};
  return {...session,exercises:session.exercises.map((value,i)=>i===index?{...value,targetSets:kind==='working'?working.length+1:value.targetSets,hasWarmupSet:kind==='warmup'||value.hasWarmupSet,status:value.status==='done'?'pending':value.status,sets:[...value.sets,set].sort((a,b)=>a.id.localeCompare(b.id))}:value)};
}
export function removeTrainingSet(session:TrainingSession,index:number,setId:string):TrainingSession {
  const exercise=session.exercises[index];const set=exercise?.sets.find(set=>set.id===setId);
  if(!exercise||!set||set.completedAt!==null||!['active','paused'].includes(session.status)||(set.kind==='working'&&exercise.sets.filter(value=>value.kind==='working').length<=1))return session;
  return {...session,exercises:session.exercises.map((value,i)=>i===index?{...value,targetSets:set.kind==='working'?value.sets.filter(set=>set.kind==='working').length-1:value.targetSets,hasWarmupSet:set.kind==='warmup'?false:value.hasWarmupSet,sets:value.sets.filter(value=>value.id!==setId)}:value)};
}
export function getTrainingSummary(session:TrainingSession) {
  const sets=session.exercises.flatMap(exercise=>exercise.sets);
  const completed=sets.filter(set=>set.completedAt!==null);
  const working=completed.filter(set=>set.kind==='working');
  const numeric=(values:(number|null)[])=>values.filter((value):value is number=>value!==null);
  const mean=(values:number[])=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null;
  return {completedSets:working.length,targetSets:sets.filter(set=>set.kind==='working').length,
    warmupSets:completed.filter(set=>set.kind==='warmup').length,
    completedExercises:session.exercises.filter(exercise=>exercise.status==='done').length,totalExercises:session.exercises.length,
    reps:working.reduce((total,set)=>total+(set.reps??0),0),durationSeconds:working.reduce((total,set)=>total+(set.durationSeconds??0),0),
    volumeKg:working.reduce((total,set)=>total+(set.loadKg??0)*(set.reps??0),0),
    bestLoadKg:working.some(set=>set.loadKg!==null)?Math.max(...working.flatMap(set=>set.loadKg===null?[]:[set.loadKg])):null,
    averageRpe:mean(numeric(session.exercises.map(exercise=>exercise.rpe))),averageDiscomfort:mean(numeric(session.exercises.map(exercise=>exercise.discomfort))),
  };
}

const obj=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const str=(value:unknown,max=500):value is string=>typeof value==='string'&&value.length<=max;
const num=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const optionalNum=(value:unknown,max=Number.MAX_SAFE_INTEGER):value is number|null=>value===null||num(value,0,max);
const keys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
const safeId=(value:unknown)=>str(value,200)&&/^[a-zA-Z0-9_-]+$/.test(value as string);
function validDate(value:unknown):value is string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function validDefinition(value:unknown):value is TrainingExerciseDefinition {
  if(!obj(value)||!keys(value,['id','day','order','name','primaryMuscle','secondaryMuscles','instructions','hasWarmupSet','targetSets','repsMin','repsMax','secondsTarget','restSeconds','restLabel','variants']))return false;
  return safeId(value.id)&&[1,2,3].includes(value.day as number)&&num(value.order,1,30)&&str(value.name,200)&&!!value.name&&str(value.primaryMuscle,200)&&str(value.secondaryMuscles,300)&&str(value.instructions,3000)&&typeof value.hasWarmupSet==='boolean'&&num(value.targetSets,1,4)&&Number.isInteger(value.targetSets)&&num(value.repsMin,0,1000)&&Number.isInteger(value.repsMin)&&num(value.repsMax,value.repsMin as number,1000)&&Number.isInteger(value.repsMax)&&optionalNum(value.secondsTarget,7200)&&(value.secondsTarget===null||Number.isInteger(value.secondsTarget))&&num(value.restSeconds,0,3600)&&str(value.restLabel,100)&&Array.isArray(value.variants)&&value.variants.length>0&&value.variants.length<=10&&new Set(value.variants.map(variant=>obj(variant)?variant.id:undefined)).size===value.variants.length&&value.variants.every(variant=>obj(variant)&&keys(variant,['id','name'])&&safeId(variant.id)&&str(variant.name,200)&&!!variant.name);
}
export function normalizeTrainingRoutine(value:unknown,key?:string):TrainingRoutine|undefined {
  if(!obj(value)||!keys(value,['id','name','createdAt','day','exercises'])||!safeId(value.id)||(key!==undefined&&value.id!==key)||!str(value.name,200)||!value.name||!num(value.createdAt)||![1,2,3].includes(value.day as number)||!Array.isArray(value.exercises)||!value.exercises.length||value.exercises.length>30||!value.exercises.every(validDefinition))return;
  if(new Set(value.exercises.map(exercise=>exercise.id)).size!==value.exercises.length)return;
  return structuredClone(value) as unknown as TrainingRoutine;
}
export function normalizeTrainingSession(value:unknown,key?:string):TrainingSession|undefined {
  if(!obj(value)||!keys(value,['id','date','week','day','title','status','startedAt','completedAt','activeStartedAt','elapsedSeconds','restUntil','pausedRestSeconds','setTimerUntil','pausedSetSeconds','restPausedBeforeSession','setPausedBeforeSession','currentExercise','exercises','notes','legacySourceId','legacyDateUnknown','legacyEditedAt','routineId']))return;
  if(!safeId(value.id)||(key!==undefined&&value.id!==key)||!validDate(value.date)||![1,2,3,4].includes(value.week as number)||![1,2,3].includes(value.day as number)||!str(value.title,200)||!['active','paused','completed','abandoned','imported'].includes(value.status as string)||!num(value.startedAt)||!optionalNum(value.completedAt)||!optionalNum(value.activeStartedAt)||!num(value.elapsedSeconds,0,31536000)||!optionalNum(value.restUntil)||!optionalNum(value.pausedRestSeconds,3600)||!optionalNum(value.setTimerUntil)||!optionalNum(value.pausedSetSeconds,7200)||!num(value.currentExercise,0,29)||!Number.isInteger(value.currentExercise)||!str(value.notes,5000)||!Array.isArray(value.exercises)||!value.exercises.length||value.exercises.length>30)return;
  if(value.currentExercise>=value.exercises.length)return;
  if((value.legacySourceId!==undefined&&!str(value.legacySourceId,200))||(value.routineId!==undefined&&!safeId(value.routineId)))return;
  if(value.legacyDateUnknown!==undefined&&typeof value.legacyDateUnknown!=='boolean')return;
  if(value.legacyEditedAt!==undefined&&!num(value.legacyEditedAt))return;
  if((value.restPausedBeforeSession!==undefined&&typeof value.restPausedBeforeSession!=='boolean')||(value.setPausedBeforeSession!==undefined&&typeof value.setPausedBeforeSession!=='boolean'))return;
  if(value.status==='active'&&value.activeStartedAt===null)return;
  if(value.status!=='active'&&value.activeStartedAt!==null)return;
  if(['completed','abandoned'].includes(value.status as string)&&value.completedAt===null)return;
  for(const exercise of value.exercises){
    if(!obj(exercise)||!keys(exercise,['exerciseId','sourceExerciseId','variantId','name','primaryMuscle','targetSets','repsMin','repsMax','secondsTarget','restSeconds','hasWarmupSet','sets','status','rpe','discomfort','notes'])||!safeId(exercise.exerciseId)||!safeId(exercise.sourceExerciseId)||!safeId(exercise.variantId)||!str(exercise.name,200)||!str(exercise.primaryMuscle,200)||!num(exercise.targetSets,1,4)||!Number.isInteger(exercise.targetSets)||!num(exercise.repsMin,0,1000)||!num(exercise.repsMax,exercise.repsMin as number,1000)||!optionalNum(exercise.secondsTarget,7200)||!num(exercise.restSeconds,0,3600)||typeof exercise.hasWarmupSet!=='boolean'||!['pending','done','adjust','skipped'].includes(exercise.status as string)||!optionalNum(exercise.rpe,10)||!optionalNum(exercise.discomfort,10)||!str(exercise.notes,5000)||!Array.isArray(exercise.sets)||!exercise.sets.length||exercise.sets.length>5)return;
    const definition=getTrainingExercise(exercise.exerciseId as string);
    if(definition&&!definition.variants.some(variant=>variant.id===exercise.variantId)&&exercise.variantId!=='legacy-unspecified')return;
    if(new Set(exercise.sets.map(set=>obj(set)?set.id:undefined)).size!==exercise.sets.length)return;
    let warmups=0;
    for(const set of exercise.sets){
      if(!obj(set)||!keys(set,['id','kind','loadKg','reps','durationSeconds','completedAt'])||!/^s[0-4]$/.test(String(set.id))||!['warmup','working'].includes(set.kind as string)||!optionalNum(set.loadKg,2000)||!optionalNum(set.reps,1000)||(set.reps!==null&&!Number.isInteger(set.reps))||!optionalNum(set.durationSeconds,7200)||(set.durationSeconds!==null&&!Number.isInteger(set.durationSeconds))||!optionalNum(set.completedAt))return;
      if((set.id==='s0')!==(set.kind==='warmup'))return;
      if(set.kind==='warmup')warmups++;
      if(value.status!=='imported'&&set.completedAt!==null&&!((set.reps as number)>0||(set.durationSeconds as number)>0))return;
      if(set.completedAt!==null&&((set.completedAt as number)<(value.startedAt as number)||(value.completedAt!==null&&(set.completedAt as number)>(value.completedAt as number))))return;
    }
    if(warmups>1||warmups!==Number(exercise.hasWarmupSet)||!exercise.sets.some(set=>obj(set)&&set.kind==='working'))return;
  }
  if(new Set(value.exercises.map(exercise=>obj(exercise)?exercise.exerciseId:undefined)).size!==value.exercises.length)return;
  return structuredClone(value) as unknown as TrainingSession;
}

export interface LegacyTrainingImport {sessions:TrainingSessions;routines:Record<string,TrainingRoutine>;importedCount:number;warnings:string[]}
/** Accepts the original gym-training-tracker:v1 JSON backup, without inventing reps or dates. */
export function importLegacyTraining(input:unknown,now=Date.now()):LegacyTrainingImport {
  const parsed=typeof input==='string'?JSON.parse(input):input;
  if(obj(parsed)&&parsed.version!==undefined&&parsed.version!==1)throw new Error('Versión de copia de gym no compatible.');
  const state=obj(parsed)&&obj(parsed.state)?parsed.state:parsed;
  if(!obj(state)||!obj(state.plan)||!Array.isArray(state.plan.weeks)||!state.plan.weeks.length||state.plan.weeks.length>4)throw new Error('El archivo no corresponde a la app de gym anterior.');
  const sessions:TrainingSessions={};const routines:Record<string,TrainingRoutine>={};const warnings:string[]=[];
  const logs=Array.isArray(state.logs)?state.logs.filter(obj):[];
  const seen=new Set<string>();
  let count=0;
  for(const week of state.plan.weeks){
    if(!obj(week)||!Array.isArray(week.days))throw new Error('Semana de entrenamiento inválida.');
    for(const day of week.days){
      if(!obj(day)||!Array.isArray(day.exercises))throw new Error('Día de entrenamiento inválido.');
      for(const original of day.exercises){
        if(!obj(original)||typeof original.id!=='string'||!/^w[1-4]-d[1-3]-e[1-7]$/.test(original.id))throw new Error('Ejercicio de la app anterior inválido.');
        const sourceId=original.id;const definition=getTrainingExercise(sourceId)!;
        if(seen.has(sourceId))throw new Error('Ejercicio duplicado en la copia de gym.');seen.add(sourceId);
        if(!['Pendiente','Hecho','Ajustar','Saltado'].includes(String(original.status))||(original.rpe!==undefined&&!num(original.rpe,0,10))||(original.discomfort!==undefined&&!num(original.discomfort,0,10)))throw new Error('Estado o esfuerzo de entrenamiento inválido.');
        const loads=obj(original.loads)?original.loads:{};
        if(Object.entries(loads).some(([key,value])=>!/^s[0-4]$/.test(key)||!num(value,0,2000)))throw new Error('Carga de entrenamiento inválida.');
        const log=logs.find(log=>log.sourceExerciseId===sourceId);
        const seed=sourceId==='w1-d1-e1'&&original.status==='Hecho'&&original.hasWarmupSet===false&&['s0','s1','s2','s3'].every(key=>loads[key]===60)&&Object.keys(loads).length===4&&!original.notes&&!original.rpe&&!original.discomfort&&!log;
        if(seed){warnings.push('Se omitió el ejemplo inicial de 60 kg de la app anterior.');continue;}
        const hasInput=Object.keys(loads).length||original.status!=='Pendiente'||original.notes||original.rpe||original.discomfort;
        if(!hasInput)continue;
        const timestamp=log&&typeof log.completedAt==='string'?Date.parse(log.completedAt):NaN;
        const validTimestamp=Number.isFinite(timestamp)?timestamp:now;
        const id=`legacy-${sourceId}`;
        const localDate=new Date(validTimestamp);
        const date=`${localDate.getFullYear()}-${String(localDate.getMonth()+1).padStart(2,'0')}-${String(localDate.getDate()).padStart(2,'0')}`;
        const base=createTrainingSession({id,date,week:Number(sourceId[1]) as TrainingWeekNumber,day:definition.day,now:validTimestamp});
        const exercise=base.exercises.find(exercise=>exercise.exerciseId===definition.id)!;
        const hasWarmup=typeof original.hasWarmupSet==='boolean'?original.hasWarmupSet:definition.hasWarmupSet;
        const statusMap:Record<string,TrainingExerciseStatus>={Pendiente:'pending',Hecho:'done',Ajustar:'adjust',Saltado:'skipped'};
        const imported:TrainingExerciseLog={...exercise,variantId:definition.variants.length>1?'legacy-unspecified':definition.variants[0].id,
          name:typeof original.name==='string'?original.name.slice(0,200):definition.name,hasWarmupSet:hasWarmup,
          sets:[...(hasWarmup?[{id:'s0',kind:'warmup' as const,loadKg:typeof loads.s0==='number'?loads.s0:null,reps:null,durationSeconds:null,completedAt:null}]:[]),
            ...Array.from({length:Math.max(definition.targetSets,loads.s4!==undefined?4:0)},(_,index)=>({id:`s${index+1}`,kind:'working' as const,loadKg:typeof loads[`s${index+1}`]==='number'?loads[`s${index+1}`] as number:null,reps:null,durationSeconds:null,completedAt:null}))],
          status:statusMap[String(original.status)]??'pending',rpe:num(original.rpe,0,10)?original.rpe:null,discomfort:num(original.discomfort,0,10)?original.discomfort:null,
          notes:(typeof original.notes==='string'?original.notes.slice(0,4500):'')+'\nFecha de entrenamiento no verificable.'+(Number.isFinite(timestamp)?` Última edición del registro: ${new Date(timestamp).toISOString()}.`:''),
        };
        const session:TrainingSession={...base,status:'imported',activeStartedAt:null,elapsedSeconds:0,currentExercise:0,exercises:[imported],legacySourceId:sourceId,legacyDateUnknown:true,...(Number.isFinite(timestamp)?{legacyEditedAt:timestamp}:{}),
          notes:'Registro de la app anterior: cargas, estado, RPE, molestias y notas. Sin repeticiones reales ni duración verificable.'};
        const normalized=normalizeTrainingSession(session,id);if(!normalized)throw new Error('Registro histórico inválido.');
        sessions[id]=normalized;count++;
      }
    }
  }
  if(Array.isArray(state.customSessions))for(const original of state.customSessions){
    if(!obj(original)||!safeId(original.id)||!str(original.name,200)||!Array.isArray(original.exercises)||!original.exercises.length||original.exercises.length>30)throw new Error('Rutina personalizada inválida.');
    const day:TrainingDayNumber=original.block==='Tren inferior'?1:original.block==='Pecho y bíceps (+ otros)'?2:3;
    const createdAt=typeof original.createdAt==='string'?Date.parse(original.createdAt):now;
    const routine:TrainingRoutine={id:`legacy-${original.id}`,name:original.name as string,day,createdAt:Number.isFinite(createdAt)?createdAt:now,
      exercises:original.exercises.map((exercise,index)=>{
        if(!obj(exercise)||!safeId(exercise.id)||!str(exercise.name,200))throw new Error('Ejercicio personalizado inválido.');
        const target=parseTrainingTarget(String(exercise.targetSetsReps??'3 x 10–12'));
        const definition:TrainingExerciseDefinition={id:exercise.id as string,day,order:index+1,name:exercise.name as string,
          primaryMuscle:typeof exercise.primaryMuscle==='string'?exercise.primaryMuscle.slice(0,200):'',secondaryMuscles:typeof exercise.secondaryMuscles==='string'?exercise.secondaryMuscles.slice(0,300):'',
          hasWarmupSet:exercise.hasWarmupSet===true,...target,
          restSeconds:num(exercise.restSeconds,0,3600)?exercise.restSeconds:parseTrainingRest(String(exercise.restLabel??'60 s')),
          restLabel:typeof exercise.restLabel==='string'?exercise.restLabel.slice(0,100):'60 s',instructions:typeof exercise.instructions==='string'?exercise.instructions.slice(0,3000):'',
          variants:[{id:'custom',name:exercise.name as string}]};return definition;
      })};
    const normalized=normalizeTrainingRoutine(routine,routine.id);if(!normalized)throw new Error('Rutina personalizada inválida.');routines[routine.id]=normalized;
  }
  warnings.push('Las cargas históricas no se mezclan entre alternativas ni se cuentan como series nuevas.');
  return {sessions,routines,importedCount:count,warnings};
}
