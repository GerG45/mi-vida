import {TRAINING_EXERCISES,type TrainingDayNumber,type TrainingExerciseDefinition,type TrainingRoutine,type TrainingWeekNumber} from './training';

export const ASSISTED_PULLUP_EXERCISE_ID='plan-assisted-pullup';
export const ASSISTED_PULLUP_VARIANT_ID='assisted-machine';
export const OPTIONAL_PLAN_ROUTINE_ID='plan-pullups-optional';

type RoutineInfo={id:string;day:TrainingDayNumber;name:string;optional:boolean;focus:string;minutes:string};
type PlanWeek={week:TrainingWeekNumber;focus:string;guidance:string};
const freezeItems=<T extends object>(items:T[])=>Object.freeze(items.map(item=>Object.freeze(item)));

/** An editable starting point; its monthly review never replaces a saved plan or session. */
export const monthlyTrainingPlan=Object.freeze({
  id:'pullups-core-v1',
  title:'Dominadas y core · primer mes',
  description:'Tres sesiones principales y una opción corta para practicar, cuando haya lugar. El objetivo es trabajar hacia una dominada sin asistencia y sostener el trabajo de abdomen.',
  primaryWeekdays:Object.freeze([2,4,6] as const),
  reviewAfterMonths:1,
  restSeconds:120,
  effort:'Terminá las series con unas 2–3 repeticiones posibles todavía. La técnica y una práctica que puedas sostener orientan los cambios.',
  assistanceCue:'En la máquina de dominadas, más kg significa más asistencia y menor dificultad. Registrá los kg de ayuda; no los compares con el peso de un jalón.',
  optionalCue:'La cuarta sesión es opcional y liviana. Si llegás cansado, podés omitirla; no se acumula como una deuda.',
  sources:freezeItems([
    {label:'ACSM · actualización de entrenamiento de fuerza 2026',url:'https://acsm.org/resistance-training-guidelines-update-2026/'},
    {label:'PureGym · uso de la máquina de dominadas asistidas',url:'https://www.puregym.com/blog/how-to-use-gym-equipment/'},
  ]),
  weeks:freezeItems<PlanWeek>([
    {week:1,focus:'Conocer la ayuda y la técnica',guidance:'Elegí una asistencia que permita repeticiones controladas, sin buscar el fallo. Anotá la máquina, la ayuda y las sensaciones para tener una referencia comparable.'},
    {week:2,focus:'Repetir con control',guidance:'Podés sumar una repetición dentro del rango cuando te quede margen y se mantenga el movimiento. Conservá la asistencia si todavía necesitás afianzar la técnica.'},
    {week:3,focus:'Probar un ajuste pequeño',guidance:'Si completás el rango con control y margen en varias prácticas, podés probar un escalón menos de ayuda. Si cambia la técnica, volvé a la asistencia anterior. No hay aumentos automáticos.'},
    {week:4,focus:'Consolidar y revisar',guidance:'Compará repeticiones, ayuda y sensaciones en la misma máquina. Si hay fatiga, reducí una serie u omití la opcional. La revisión del mes sirve para elegir el siguiente paso, sin prometer una dominada en una fecha fija.'},
  ]),
  routines:freezeItems<RoutineInfo>([
    {id:'plan-pullups-a',day:1,name:'A · Tren inferior y core',optional:false,focus:'Piernas, glúteos y control del abdomen',minutes:'60–80 min orientativos'},
    {id:'plan-pullups-b',day:2,name:'B · Empuje y dominadas',optional:false,focus:'Pecho, hombros, práctica de dominada asistida y core',minutes:'60–80 min orientativos'},
    {id:'plan-pullups-c',day:3,name:'C · Tirón y cuerpo completo',optional:false,focus:'Dominadas, piernas, empuje suave y abdomen',minutes:'60–80 min orientativos'},
    {id:OPTIONAL_PLAN_ROUTINE_ID,day:1,name:'Opcional · Técnica y core',optional:true,focus:'Práctica liviana y control, sin otra sesión pesada',minutes:'20–35 min orientativos'},
  ]),
});

const cloneDefinition=(id:string,day:TrainingDayNumber,order:number,patch:Partial<TrainingExerciseDefinition>={}):TrainingExerciseDefinition=>{
  const original=TRAINING_EXERCISES.find(exercise=>exercise.id===id);
  if(!original)throw new Error(`Ejercicio de referencia no disponible: ${id}`);
  return {...original,day,order,restSeconds:120,restLabel:'2 min',...patch,variants:original.variants.map(variant=>({...variant}))};
};
const assisted=(day:TrainingDayNumber,order:number,sets:number,warmup=true):TrainingExerciseDefinition=>({
  id:ASSISTED_PULLUP_EXERCISE_ID,day,order,name:'Dominada asistida en máquina',primaryMuscle:'Espalda y control escapular',secondaryMuscles:'Bíceps y core',
  instructions:'Elegí suficiente ayuda para subir y bajar con control, sin balancearte. Mantené el cuerpo estable y llevá los codos hacia el suelo. Los kg son ASISTENCIA: más kg hacen el movimiento más fácil. Usá siempre la misma máquina al comparar. Si la máquina no está disponible, omití este ejercicio; el jalón tiene su propio registro.',
  hasWarmupSet:warmup,targetSets:sets,repsMin:5,repsMax:8,secondsTarget:null,restSeconds:120,restLabel:'2 min',
  variants:[{id:ASSISTED_PULLUP_VARIANT_ID,name:'Dominada asistida en máquina'}],
});

function definitions(index:number,day:TrainingDayNumber):TrainingExerciseDefinition[] {
  if(index===0)return [
    cloneDefinition('d1-e1',day,1,{targetSets:3}),
    cloneDefinition('d1-e2',day,2,{targetSets:3}),
    cloneDefinition('d1-e3',day,3,{targetSets:2}),
    cloneDefinition('d1-e5',day,4,{targetSets:2}),
    cloneDefinition('d2-e7',day,5,{targetSets:2,repsMin:8,repsMax:10}),
    cloneDefinition('d1-e7',day,6,{targetSets:2,secondsTarget:25}),
  ];
  if(index===1)return [
    assisted(day,1,2),
    cloneDefinition('d2-e1',day,2,{targetSets:3}),
    cloneDefinition('d3-e2',day,3,{targetSets:2,repsMin:10,repsMax:12}),
    cloneDefinition('d2-e6',day,4,{targetSets:2}),
    cloneDefinition('d3-e5',day,5,{targetSets:2}),
    cloneDefinition('d3-e7',day,6,{targetSets:2,repsMin:8,repsMax:12}),
  ];
  if(index===2)return [
    assisted(day,1,3),
    cloneDefinition('d3-e1',day,2,{targetSets:2}),
    cloneDefinition('d1-e1',day,3,{targetSets:2,repsMin:10,repsMax:12,instructions:'Una variante de sentadilla o prensa con carga cómoda, dejando margen. Conservá la modalidad y la misma forma de contar los kilos para comparar.'}),
    cloneDefinition('d1-e5',day,4,{targetSets:2}),
    cloneDefinition('d2-e1',day,5,{targetSets:2,repsMin:10,repsMax:12,instructions:'Empuje complementario con carga cómoda y margen, sin convertirlo en otra sesión pesada de pecho. Mantené la variante para comparar tus registros.'}),
    cloneDefinition('d2-e7',day,6,{targetSets:2,repsMin:8,repsMax:10}),
  ];
  return [
    assisted(day,1,2),
    cloneDefinition('d3-e4',day,2,{targetSets:2,instructions:'Movimiento liviano y controlado, sin buscar fatiga alta. La sesión opcional acompaña a las principales.'}),
    cloneDefinition('d2-e7',day,3,{targetSets:2,repsMin:8,repsMax:10}),
    cloneDefinition('d3-e7',day,4,{targetSets:2,repsMin:8,repsMax:10}),
  ];
}

/** Fresh copies only: no mutation of the original catalog or any stored routine/session. */
export function getMonthlyTrainingRoutines(now=Date.now()):TrainingRoutine[] {
  const createdAt=Number.isSafeInteger(now)&&now>=0?now:Date.now();
  return monthlyTrainingPlan.routines.map((info,index)=>({id:info.id,name:info.name,day:info.day,createdAt,exercises:definitions(index,info.day)}));
}
export function getPlanRoutineForDay(day:TrainingDayNumber,now=Date.now()):TrainingRoutine|undefined {
  return getMonthlyTrainingRoutines(now).find(routine=>routine.day===day&&routine.id!==OPTIONAL_PLAN_ROUTINE_ID);
}
