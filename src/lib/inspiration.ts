/**
 * Conceptos parafraseados de los seis PDF aportados por el usuario.
 * Las reflexiones, los títulos y las preguntas son redacción original para la app:
 * no deben mostrarse como citas textuales ni atribuirse literalmente a los autores.
 * `bookQuotes` contiene, por separado, citas breves verificadas literalmente.
 * `pages` usa páginas del archivo PDF, contadas desde 1 y comprobadas con pypdf.
 * Los archivos originales no se incluyen en la web.
 */
export type BookId = 'monje' | 'atomicos' | 'riqueza' | 'club' | 'silo-v1' | 'silo-v2';
export type InspirationBook = { id: BookId; title: string; author: string; pdfPages: number; fileName: string };
export type Inspiration = {
  id: string;
  book: BookId;
  title: string;
  theme: string;
  reflection: string;
  idea: string;
  prompt: string;
  pages: number[];
  sourceContext?: string;
};
export type BookQuote = { id: string; book: BookId; quote: string; pages: number[]; sourceContext?: string };

export const books: InspirationBook[] = [
  { id: 'monje', title: 'El monje que vendió su Ferrari', author: 'Robin Sharma', pdfPages: 128, fileName: 'EL-MONJE-QUE-VENDIO-SU-FERRARI-AUTOR-ROBIN-SHARMA.pdf' },
  { id: 'atomicos', title: 'Hábitos atómicos', author: 'James Clear', pdfPages: 207, fileName: 'Habitos-atomicos.pdf' },
  { id: 'riqueza', title: 'La riqueza que el dinero no puede comprar', author: 'Robin Sharma', pdfPages: 396, fileName: '_OceanofPDF.com_La_riqueza_que_el_dinero_no_puede_comprar_Spanish_Edition_-_Robin_Sharma.pdf' },
  { id: 'club', title: 'El club de las 5 de la mañana', author: 'Robin Sharma', pdfPages: 387, fileName: 'El_club_de_las_5_de_la_manana_Robin_Sharma.pdf' },
  { id: 'silo-v1', title: 'Obras completas · Volumen I', author: 'Silo', pdfPages: 514, fileName: '3-Obras_completas_I.pdf' },
  { id: 'silo-v2', title: 'Obras completas · Volumen II', author: 'Silo', pdfPages: 369, fileName: '2-Silo_OC2_es.pdf' },
];

/** Fragmentos literales comprobados en los PDF; se normalizaron sólo espacios. */
export const bookQuotes: BookQuote[] = [
  { id: 'monje-perseverancia', book: 'monje', quote: 'La perseverancia es la madre del cambio personal.', pages: [39] },
  { id: 'silo-no-forzar', book: 'silo-v1', quote: 'Cuando fuerzas algo hacia un fin produces lo contrario.', pages: [23], sourceContext: 'Humanizar la Tierra · La mirada interna · XIII. Los Principios, principio 2' },
  { id: 'atomicos-semilla-literal', book: 'atomicos', quote: 'La semilla de cada hábito es una pequeña decisión.', pages: [18] },
  { id: 'silo-atencion-literal', book: 'silo-v2', quote: 'La atención es una aptitud de la conciencia que permite observar los fenómenos internos y externos.', pages: [18], sourceContext: 'Apuntes de Psicología · Psicología I · 3. Conciencia · Atención, presencia y copresencia' },
  { id: 'riqueza-salud', book: 'riqueza', quote: 'La salud es un tipo de riqueza.', pages: [64] },
  { id: 'silo-tiempo-paz', book: 'silo-v1', quote: 'En ella puedes permanecer el tiempo que te parezca adecuado.', pages: [26], sourceContext: 'Humanizar la Tierra · La mirada interna · XV. La experiencia de paz y el pasaje de la Fuerza, fragmento 2' },
  { id: 'club-descanso', book: 'club', quote: 'Trabajar sin descanso agota la grandeza.', pages: [331] },
  { id: 'silo-accion-literal', book: 'silo-v2', quote: 'Está claro que no es indiferente la acción que se realiza en el mundo.', pages: [126], sourceContext: 'Apuntes de Psicología · Psicología III · 1. La acción en el mundo como forma transferencial' },
];

export const inspirations: Inspiration[] = [
  {
    id: 'monje-jardin', book: 'monje', title: 'Cuidar lo que recibe tu atención', theme: 'Atención',
    reflection: 'Dale un rincón de tu atención a algo que te haga bien. También eso puede crecer.',
    idea: 'La imagen del jardín representa el cuidado de la vida interior. La adaptación para hoy es elegir con intención qué lectura, conversación o pensamiento querés alimentar.',
    prompt: '¿Qué te está ocupando la cabeza y qué te gustaría invitar a ese espacio hoy?', pages: [53, 127],
  },
  {
    id: 'atomicos-sistema', book: 'atomicos', title: 'Armar un camino repetible', theme: 'Sistemas',
    reflection: 'Tu proyecto encuentra lugar cuando le preparás un comienzo al que puedas volver.',
    idea: 'Clear distingue el resultado deseado del proceso que lo vuelve posible. En música, el ejemplo del libro es concreto: cómo ensayás, practicás pasajes y recibís devolución.',
    prompt: '¿Qué parte de tu proceso podrías acomodar hoy para que mañana sea más fácil empezar?', pages: [18, 19],
  },
  {
    id: 'riqueza-crecimiento', book: 'riqueza', title: 'Aprender también enriquece', theme: 'Crecimiento',
    reflection: 'Una idea que entendés un poco mejor ya ensancha el mundo en el que vivís.',
    idea: 'El crecimiento personal aparece como una de las ocho formas de riqueza: desarrollar capacidades y reconocer talentos propios. Podés traducirlo en una curiosidad concreta para este día.',
    prompt: '¿Qué te gustaría comprender o practicar un poquito mejor, sin exigirte dominarlo hoy?', pages: [12],
  },
  {
    id: 'club-comienzo', book: 'club', title: 'Un comienzo que se parezca a vos', theme: 'Rituales',
    reflection: 'La mañana puede tener tu ritmo y, aun así, regalarte un momento propio.',
    idea: 'La fórmula del libro combina movimiento, reflexión y aprendizaje. También propone personalizar la rutina. Acá tomamos esos componentes como opciones: elegí uno que entre en tu día, cuidando tu descanso.',
    prompt: '¿Qué gesto al empezar el día te ayudaría a sentirte un poco más presente?', pages: [254, 261, 273],
  },
  {
    id: 'silo-pausa-propia', book: 'silo-v1', title: 'Una pausa con tu tiempo', theme: 'Calma',
    reflection: 'Podés hacer una pausa sin convertirla en otra cosa que tenés que lograr.',
    idea: 'La experiencia de paz propone aquietarse, atender una imagen que pasa a sentirse en el pecho y concluir con calma. Esta adaptación toma el permiso de permanecer un rato, sin exigir una sensación especial.',
    prompt: '¿Qué cambia cuando te regalás unos minutos sin pedirte un resultado?', pages: [26], sourceContext: 'La mirada interna · XV, fragmentos 1–2',
  },
  {
    id: 'monje-faro', book: 'monje', title: 'Una intención que oriente', theme: 'Propósito',
    reflection: 'Entre tantas cosas por resolver, podés elegir una que hoy tenga sentido para vos.',
    idea: 'El faro simboliza una dirección personal y prioridades claras. Una intención pequeña puede servir como referencia cuando aparecen pedidos, pendientes y distracciones.',
    prompt: '¿Qué querés cuidar especialmente hoy y qué decisión concreta lo mostraría?', pages: [53, 65],
  },
  {
    id: 'atomicos-identidad', book: 'atomicos', title: 'Practicar quién querés ser', theme: 'Identidad',
    reflection: 'Podés ensayar la persona que querés ser en un gesto sencillo de este día.',
    idea: 'El enfoque de hábitos basados en identidad comienza por la persona que querés llegar a ser, además de lo que querés conseguir. Llevá esa intención a una acción observable y posible.',
    prompt: '¿Qué cualidad querés cultivar en vos y cómo podrías practicarla hoy?', pages: [27],
  },
  {
    id: 'riqueza-bienestar', book: 'riqueza', title: 'Cuidar tu energía', theme: 'Bienestar',
    reflection: 'Tu bienestar merece un lugar en la agenda, incluso cuando la agenda está llena.',
    idea: 'El libro considera el bienestar físico, mental y emocional una forma de riqueza, y cuestiona sacrificarlo por los logros. Esta pregunta invita a registrar lo que necesitás hoy.',
    prompt: '¿Qué te pide el cuerpo y qué espacio real podrías darle a ese cuidado?', pages: [13, 64],
  },
  {
    id: 'club-intencion', book: 'club', title: 'Hacer una pausa para elegir', theme: 'Reflexión',
    reflection: 'Un momento de quietud puede ayudarte a recordar cómo querés estar en el mundo hoy.',
    idea: 'La fase de reflexión invita a contemplar los propios valores, la manera de actuar y lo importante del día. Podés hacerlo escribiendo unas líneas en el horario que te resulte posible.',
    prompt: '¿Qué valor querés que se note en tu manera de trabajar, de cuidar y de hablar hoy?', pages: [261, 262],
  },
  {
    id: 'silo-atender', book: 'silo-v2', title: 'Notar dónde estás', theme: 'Atención',
    reflection: 'Hay un sonido, una sensación o un detalle de este momento al que podés acercarte despacio.',
    idea: 'Silo distingue el foco de atención de lo que queda en su entorno. Para hoy, la propuesta es reconocer un detalle externo y una sensación propia, sin intentar atender a todo a la vez.',
    prompt: '¿Qué notás a tu alrededor y qué registrás en vos al detenerte un momento?', pages: [18], sourceContext: 'Apuntes de Psicología · Psicología I · Atención, presencia y copresencia',
  },
  {
    id: 'monje-kaizen', book: 'monje', title: 'Mejorar una cosa pequeña', theme: 'Aprendizaje',
    reflection: 'Hay días en que crecer tiene el tamaño de un detalle hecho con más cuidado.',
    idea: 'La figura del luchador de sumo introduce el kaizen, entendido en el libro como mejora continua. La propuesta es elegir una práctica concreta y revisarla con curiosidad.',
    prompt: '¿Qué detalle de tu rutina podrías mejorar un poco, usando lo que ya aprendiste?', pages: [65, 127],
  },
  {
    id: 'atomicos-semilla', book: 'atomicos', title: 'Darle tiempo al proceso', theme: 'Paciencia',
    reflection: 'Algunas cosas que hoy cuidás todavía están echando raíces.',
    idea: 'Clear describe que el esfuerzo y los resultados visibles pueden avanzar a ritmos distintos. Esa distancia invita a mirar qué estás practicando, además de lo que todavía falta conseguir.',
    prompt: '¿Qué esfuerzo valioso estás haciendo que merece ser reconocido aunque aún no se vea mucho?', pages: [18],
  },
  {
    id: 'riqueza-familia', book: 'riqueza', title: 'Estar de verdad', theme: 'Vínculos',
    reflection: 'A veces, el regalo más grande es un rato en el que alguien siente que estás ahí.',
    idea: 'La familia y los vínculos queridos aparecen como una forma de riqueza propia. Podés llevar esta idea a un momento de atención, escucha o compañía elegido para hoy.',
    prompt: '¿Con quién te gustaría compartir un rato de presencia y cómo podrías hacerle lugar?', pages: [13, 111],
  },
  {
    id: 'club-diario', book: 'club', title: 'Escribir lo que traés', theme: 'Diario',
    reflection: 'En esta página hay lugar para lo que agradecés y para lo que todavía pesa.',
    idea: 'El diario del libro reúne compromisos, gratitud y experiencias difíciles. Esta versión permite escribir tanto lo agradable como lo incómodo, sin tener que resolverlo todo en una entrada.',
    prompt: '¿Qué necesitás dejar escrito hoy, tal como te sale, antes de seguir con el día?', pages: [268],
  },
  {
    id: 'silo-en-conjunto', book: 'silo-v1', title: 'Que tu día haga conjunto', theme: 'Coherencia',
    reflection: 'Tu descanso, tu trabajo y tus vínculos también pueden ser parte de una misma decisión.',
    idea: 'Los Principios invitan a considerar cómo se relacionan las cosas y qué actos dejan una sensación de unidad. La adaptación para tu agenda es revisar una elección junto con aquello que también querés cuidar.',
    prompt: '¿Qué ajuste haría que lo que pensás, sentís y hacés se acerquen un poco más hoy?', pages: [23], sourceContext: 'La mirada interna · XIII. Los Principios, principios 4 y 12',
  },
  {
    id: 'monje-disciplina', book: 'monje', title: 'Una promesa posible', theme: 'Constancia',
    reflection: 'Una promesa chiquita que podés cuidar hoy también construye confianza en vos.',
    idea: 'El cable de muchos hilos representa pequeñas prácticas que se reúnen con el tiempo. Para esta app, la adaptación es elegir un compromiso que entre en tu realidad y volver a revisarlo cuando cambie.',
    prompt: '¿Qué compromiso pequeño podés asumir hoy con vos, sin sobrecargarte?', pages: [94, 127],
  },
  {
    id: 'atomicos-senal', book: 'atomicos', title: 'Encontrar tu señal', theme: 'Hábitos',
    reflection: 'Eso que ya hacés todos los días puede abrirle la puerta a algo nuevo.',
    idea: 'La acumulación de hábitos relaciona una práctica nueva con otra que ya existe. Elegí una señal concreta y una acción breve para que el comienzo sea fácil de reconocer.',
    prompt: 'Cuando termine de hacer algo cotidiano, ¿qué pequeño gesto me gustaría sumar?', pages: [56],
  },
  {
    id: 'riqueza-trabajo', book: 'riqueza', title: 'Encontrar el aporte de tu trabajo', theme: 'Trabajo con sentido',
    reflection: 'En lo que hacés también puede haber una manera tuya de aportar belleza y cuidado.',
    idea: 'El trabajo se presenta como un espacio para desarrollar capacidades y contribuir. La pregunta se centra en una parte concreta de lo que hacés, sin pedir que todo tu trabajo se sienta extraordinario.',
    prompt: '¿Qué parte de lo que hacés ayuda a alguien o expresa algo valioso de vos?', pages: [13],
  },
  {
    id: 'club-aprender', book: 'club', title: 'Llevarte una idea', theme: 'Curiosidad',
    reflection: 'Guardá una pregunta abierta: puede acompañarte más lejos que una respuesta apurada.',
    idea: 'La fase de crecimiento propone leer, estudiar y ampliar los conocimientos. Podés adaptarla eligiendo una sola idea que quieras explorar y relacionar con tu vida.',
    prompt: '¿Qué idea te dejó pensando últimamente y dónde podrías ponerla a prueba?', pages: [273, 274],
  },
  {
    id: 'silo-aprender-haciendo', book: 'silo-v2', title: 'Escuchar lo que deja tu hacer', theme: 'Aprendizaje',
    reflection: 'Además de terminar una tarea, podés mirar cómo te quedás después de hacerla.',
    idea: 'Al describir la acción en el mundo, Silo considera el registro interno y la realimentación que permite aprender. Podés revisar una acción concreta y elegir qué sostener o ajustar, sin convertir el registro en un juicio sobre vos.',
    prompt: '¿Qué acción de hoy te dejó más en acuerdo con vos y qué aprendiste al hacerla?', pages: [125, 126], sourceContext: 'Apuntes de Psicología · Psicología III · La acción en el mundo como forma transferencial',
  },
  {
    id: 'monje-tiempo', book: 'monje', title: 'Elegir a qué darle tu tiempo', theme: 'Prioridades',
    reflection: 'El tiempo que reservás para lo querido también cuenta entre las cosas que construís.',
    idea: 'El cronógrafo simboliza la importancia del tiempo; más adelante, el libro relaciona la sencillez con disfrutar de la vida cotidiana. Podés revisar un compromiso que esté desplazando algo importante para vos.',
    prompt: '¿Qué ocupa tu agenda por costumbre y qué te gustaría volver a hacerle lugar?', pages: [103, 108],
  },
  {
    id: 'atomicos-entorno', book: 'atomicos', title: 'Prepararte el escenario', theme: 'Entorno',
    reflection: 'Dejá cerca lo que querés cuidar. A veces, empezar necesita que le despejes un lugar.',
    idea: 'El ambiente y las señales visibles influyen en las conductas que repetimos. La aplicación práctica es dejar a mano lo necesario para el hábito y revisar qué obstáculos podés reducir.',
    prompt: '¿Qué podrías dejar preparado hoy para que tu próximo comienzo tenga menos vueltas?', pages: [64, 65],
  },
  {
    id: 'riqueza-dinero', book: 'riqueza', title: 'Recordar para qué querés más libertad', theme: 'Libertad',
    reflection: 'También vale preguntarte qué clase de vida querés que tus recursos ayuden a cuidar.',
    idea: 'El dinero aparece entre las ocho formas de riqueza, relacionado con libertad y generosidad. Podés usar esta idea para aclarar tus valores y reconocer qué aspectos de tu vida querés sostener.',
    prompt: '¿Qué tiempo, experiencia o vínculo te gustaría cuidar con los recursos que tenés?', pages: [13],
  },
  {
    id: 'club-foco', book: 'club', title: 'Un espacio para una sola cosa', theme: 'Concentración',
    reflection: 'Darle toda tu atención a una cosa puede volver más liviano el próximo paso.',
    idea: 'La burbuja de concentración del libro propone proteger un período de trabajo de interrupciones. Adaptalo a un bloque que entre en tu agenda y a las responsabilidades de cuidado de ese momento.',
    prompt: '¿Qué tarea merece un rato de atención y qué distracción podrías apartar mientras la hacés?', pages: [309],
  },
  {
    id: 'silo-agradecer', book: 'silo-v1', title: 'Reconocer un momento bueno', theme: 'Gratitud',
    reflection: 'Si hoy hubo un momento de alegría o de cercanía, podés guardarle unas palabras.',
    idea: 'El cierre de Los Principios invita al agradecimiento cuando se reconoce alegría, bondad o libertad interior. Acá lo llevamos al diario como una invitación opcional: registrar algo valioso que ocurrió, sin obligarte a sentir gratitud.',
    prompt: '¿Hubo un momento que te hizo bien y que quisieras recordar como fue?', pages: [23], sourceContext: 'La mirada interna · XIII. Los Principios, párrafo final',
  },
  {
    id: 'monje-presente', book: 'monje', title: 'Notar un detalle de hoy', theme: 'Presencia',
    reflection: 'Este día también tiene algo que merece ser mirado despacio.',
    idea: 'El sendero de diamantes representa disfrutar el presente y advertir lo valioso de lo cotidiano mientras se siguen teniendo proyectos. Elegí un detalle que hoy no quieras pasar por alto.',
    prompt: '¿Qué momento sencillo de hoy te gustaría recordar cuando vuelvas a esta página?', pages: [117, 118],
  },
  {
    id: 'atomicos-dos-minutos', book: 'atomicos', title: 'Elegir la puerta de entrada', theme: 'Comienzos pequeños',
    reflection: 'El primer paso puede ser lo bastante pequeño como para caber en el día que tenés.',
    idea: 'La regla de los dos minutos reduce un hábito a una versión fácil de empezar. Es una puerta de entrada a la práctica, y podés quedarte con esa versión mínima cuando la necesites.',
    prompt: '¿Cuál es la versión de hasta dos minutos de algo que venís queriendo empezar?', pages: [125],
  },
  {
    id: 'riqueza-comunidad', book: 'riqueza', title: 'Hacer lugar a tu gente', theme: 'Comunidad',
    reflection: 'Hay conversaciones que te devuelven un poco de aire. También podés buscarlas.',
    idea: 'La comunidad se plantea como una riqueza ligada a relaciones, conversaciones y aprendizajes compartidos. Podés reconocer quiénes te acompañan y cómo cuidar ese vínculo con reciprocidad.',
    prompt: '¿Quién te hace bien y qué forma de encuentro o conversación te gustaría proponer?', pages: [13, 302],
  },
  {
    id: 'club-recarga', book: 'club', title: 'Reservar un rato de recuperación', theme: 'Descanso',
    reflection: 'Podés dejar algo de espacio para recuperar el aire que usaste al dar lo mejor de vos.',
    idea: 'Los ciclos del libro alternan períodos de concentración con recuperación. Esta adaptación invita a reservar descanso dentro del día, sin exigir rendir siempre al máximo.',
    prompt: '¿Qué descanso te devolvería energía y en qué momento real podrías hacerlo hoy?', pages: [311, 329, 331],
  },
  {
    id: 'silo-otra-mirada', book: 'silo-v2', title: 'Volver a mirar lo vivido', theme: 'Comprensión',
    reflection: 'Una experiencia conocida puede mostrarte un detalle nuevo cuando la mirás con otra pregunta.',
    idea: 'Apuntes de Psicología describe cómo dirigir la atención hacia el recuerdo permite advertir aspectos que antes pasaron de largo. La invitación de hoy es releer una situación con curiosidad, admitiendo también lo que no recordás con claridad.',
    prompt: '¿Qué situación de hoy podrías mirar de nuevo para comprenderla un poco mejor?', pages: [17, 90], sourceContext: 'Apuntes de Psicología · Psicología I, Conciencia; Psicología II, apercepción en la evocación',
  },
  {
    id: 'atomicos-volver', book: 'atomicos', title: 'Preparar la próxima oportunidad', theme: 'Volver a empezar',
    reflection: 'Podés volver desde el día que tenés hoy, con lo que ahora está a tu alcance.',
    idea: 'Clear reconoce que los hábitos se interrumpen y propone pensar cómo retomarlos. En esta app la adaptación evita castigos por rachas: mirá qué pasó y elegí un próximo paso posible.',
    prompt: '¿Qué dificultó una práctica que querías sostener y qué podrías ajustar para retomarla?', pages: [154],
  },
  {
    id: 'riqueza-aventura', book: 'riqueza', title: 'Guardar un poco de asombro', theme: 'Aventura',
    reflection: 'A veces alcanza con mirar una calle distinta para que el día tenga una pequeña aventura.',
    idea: 'La aventura se asocia con explorar y vivir experiencias que despierten gratitud y asombro. Podés buscar una novedad que entre en tus posibilidades y en tu barrio.',
    prompt: '¿Qué experiencia pequeña y diferente te gustaría regalarte esta semana?', pages: [13],
  },
  {
    id: 'atomicos-registro', book: 'atomicos', title: 'Reconocer lo que sí hiciste', theme: 'Registro amable',
    reflection: 'Dejá una señal de lo que hiciste por vos. Los pasos pequeños también merecen memoria.',
    idea: 'El registro de hábitos permite ver la práctica y reconocer el esfuerzo. El libro también advierte que no hace falta medir todo: elegí un registro sencillo que te resulte útil.',
    prompt: '¿Qué hiciste hoy que quieras reconocer, aunque haya sido más pequeño de lo planeado?', pages: [153, 154],
  },
  {
    id: 'riqueza-servicio', book: 'riqueza', title: 'Ofrecer algo de lo tuyo', theme: 'Amabilidad',
    reflection: 'Un gesto tuyo puede hacer más amable un pedacito del día de alguien.',
    idea: 'El servicio se presenta como contribuir a la vida de otras personas. Una adaptación cotidiana es elegir una ayuda concreta que puedas ofrecer dentro de tus posibilidades.',
    prompt: '¿Qué gesto de ayuda o amabilidad te gustaría ofrecer hoy, cuidando también tus límites?', pages: [14, 341],
  },
];

/** Rotación por fecha, estable entre dispositivos y sin depender de la hora local. */
export function getDailyInspiration(date: string): Inspiration {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  const day = Number.isFinite(timestamp) ? Math.floor(timestamp / 86400000) : 0;
  const index = ((day % inspirations.length) + inspirations.length) % inspirations.length;
  return inspirations[index]!;
}

/** Una cita breve por día; las seis fuentes se alternan en un ciclo estable. */
export function getDailyQuote(date: string): BookQuote {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  const day = Number.isFinite(timestamp) ? Math.floor(timestamp / 86400000) : 0;
  const index = ((day % bookQuotes.length) + bookQuotes.length) % bookQuotes.length;
  return bookQuotes[index]!;
}
