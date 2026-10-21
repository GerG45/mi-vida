/**
 * Original guidance adapted from the user's six-step specification and checked against
 * Silo, La mirada interna XV.1–2 (Obras completas I, supplied PDF page 26).
 * This is the experience of peace only, not the separate "pasaje de la Fuerza".
 */
export type MeditationStep = { id: string; title: string; guidance: string };
export type MeditationContent = {
  id: string;
  title: string;
  subtitle: string;
  attribution: string;
  sourceType: 'adaptacion_no_transcripcion_literal';
  source: { label: string; chapter: string; pdfPages: number[]; book: 'silo-v1' };
  intro: string;
  suggestedMinutes: [number,number];
  steps: MeditationStep[];
  completionButton: string;
  manualCompletionButton: string;
  pendingTodayLabel: string;
  completedTodayLabel: string;
  optionalReflection: {title: string; prompt: string; required: false; storeAnswerByDefault: false};
};

export const meditationContent: MeditationContent = {
  id:'experiencia-de-paz',
  title:'Experiencia de Paz',
  subtitle:'Un momento para vos, cuando puedas',
  attribution:'Práctica adaptada de La mirada interna, de Silo, capítulo XV, fragmentos 1–2. No es una transcripción literal.',
  sourceType:'adaptacion_no_transcripcion_literal',
  source:{label:'Silo · Obras completas, volumen I · PDF pág. 26',chapter:'La mirada interna · XV. La experiencia de paz y el pasaje de la Fuerza · fragmentos 1–2',pdfPages:[26],book:'silo-v1'},
  intro:'No hay nada que cumplir ni demostrar. Si hoy encontrás unos minutos, podés dedicártelos. Podés pausar o cerrar cuando quieras.',
  suggestedMinutes:[10,15],
  steps:[
    {id:'relajar',title:'Encontrar calma',guidance:'Buscá una postura cómoda. Aflojá, de a poco, las tensiones del cuerpo y dejá que la mente se aquiete, sin pelear con los pensamientos.'},
    {id:'esfera',title:'La esfera luminosa',guidance:'Imaginá una esfera transparente y luminosa que se acerca suavemente y encuentra un lugar en el centro de tu pecho, a la altura del corazón.'},
    {id:'sensacion',title:'De imagen a sensación',guidance:'Llevá la atención a cómo se siente esa esfera en el pecho. No necesitás verla con nitidez ni sentir algo especial; podés acompañar lo que registres.'},
    {id:'expansion',title:'Expandir la paz',guidance:'Permití que esa sensación se extienda lentamente desde el corazón hacia el resto del cuerpo, hasta sus límites. Dejá que la respiración siga su propio ritmo, sin forzarla.'},
    {id:'permanecer',title:'Permanecer',guidance:'Quedate un momento con esa sensación, el tiempo que te resulte adecuado. No hace falta buscar un resultado. Si te distraés, podés volver con amabilidad.'},
    {id:'cierre',title:'Volver',guidance:'Imaginá que la sensación vuelve suavemente hacia el corazón y que la esfera se retira. Volvé a notar el lugar en el que estás y terminá con calma, cuando lo sientas oportuno.'},
  ],
  completionButton:'Finalizar y registrar',
  manualCompletionButton:'Ya medité',
  pendingTodayLabel:'Por hacer',
  completedTodayLabel:'Realizada hoy',
  optionalReflection:{title:'Una pregunta para hoy',prompt:'¿Qué puedo comprender mejor de lo que estoy viviendo?',required:false,storeAnswerByDefault:false},
};
