/**
 * Contenido de referencia para comidas y entrenamiento.
 * Comidas: anexo actualizado de cocina martes/viernes (páginas 8-20 del PDF).
 * Desayunos y meriendas: menú base del mismo documento (páginas 3-4).
 * Gimnasio: tres sesiones de referencia, sin cargas ni historial.
 */

export type MealDay = {
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
  mealNote: string;
};

/** Orden de Date.getDay(): domingo = 0, lunes = 1, ... sábado = 6. */
export const menu: MealDay[] = [
  {
    breakfast: 'Yogur con fruta y avena.',
    lunch: 'Hamburguesa casera con puré de papa y zapallo; ensalada o huevo.',
    snack: 'Tostadas con queso y fruta.',
    dinner: 'Salsa de carne con arroz o polenta recién hecha.',
    mealNote: 'Usá las últimas porciones de heladera del viernes. A la noche, pasá las porciones del lunes del freezer a la heladera.',
  },
  {
    breakfast: 'Avena con yogur, banana y canela.',
    lunch: 'Salsa de carne descongelada con pasta, arroz o polenta hecha en el momento.',
    snack: 'Yogur con fruta.',
    dinner: 'Hamburguesa descongelada con una guarnición fresca.',
    mealNote: 'El lunes se resuelve con lo congelado el viernes y bajado a la heladera el domingo. Elegí salsa o hamburguesa según las porciones que hayas reservado.',
  },
  {
    breakfast: '2 huevos revueltos, tostadas y una fruta.',
    lunch: 'Huevos con tostadas y fruta, o yogur con avena y fruta.',
    snack: 'Yogur y un puñado pequeño de maní o nueces.',
    dinner: 'Bowl recién hecho de pollo, arroz y verduras.',
    mealNote: 'En tu tanda de cocina: pollo, arroz, verduras, guiso de lentejas y huevos. Consultá el horario reservado arriba. Congelá hoy el bowl del viernes y el guiso de emergencia.',
  },
  {
    breakfast: 'Yogur, avena, manzana cortada y canela.',
    lunch: 'Pollo al plato con arroz y verduras de la sesión del martes.',
    snack: 'Banana y una tostada con queso.',
    dinner: 'Guiso de lentejas con tomate fresco.',
    mealNote: 'Usá las porciones del martes que quedaron en la heladera. La merienda del plan también sirve como opción previa al entrenamiento.',
  },
  {
    breakfast: 'Omelette de 2 huevos con queso y tomate.',
    lunch: 'Guiso de lentejas con huevo hervido.',
    snack: 'Fruta con yogur.',
    dinner: 'Wrap de pollo y verduras; sumá tomate, hojas y queso al momento.',
    mealNote: 'Terminá las porciones frescas del martes. Pasá a la heladera el bowl que congelaste para el almuerzo del viernes.',
  },
  {
    breakfast: 'Avena con yogur, banana y una cucharadita de mantequilla de maní.',
    lunch: 'Bowl de pollo, arroz y verduras congelado el martes y descongelado desde el jueves.',
    snack: 'Fruta, mate o café y una tostada.',
    dinner: 'Hamburguesa recién hecha, puré mixto y tomate u hojas verdes.',
    mealNote: 'En tu tanda de reposición: salsa de carne, hamburguesas y puré. Consultá el horario reservado arriba. Separá las porciones del lunes y congelalas al terminar la preparación.',
  },
  {
    breakfast: 'Huevos revueltos, tostadas y fruta.',
    lunch: 'Pasta recién hervida con salsa de carne del viernes.',
    snack: 'Yogur con avena o maní.',
    dinner: 'Wrap de hamburguesa casera con verduras y queso.',
    mealNote: 'Usá las bases del viernes que quedaron en la heladera; las terminaciones frescas del plan llevan entre 5 y 12 minutos.',
  },
];

export type BreakfastOption = {
  id: string;
  title: string;
  duration: string;
  /** Either appliance can prepare these alternatives. */
  appliances: ('blender' | 'handBlender')[];
  /** IDs from the existing shopping list; alternatives replace the base breakfast. */
  ingredientIds: string[];
  ingredients: string;
  steps: string[];
};

/** Optional homemade alternatives, separate from the source document's base menu. */
export const breakfastOptions: BreakfastOption[] = [
  {
    id: 'licuado-banana-avena',
    title: 'Licuado de banana y avena',
    duration: 'Unos 5 minutos',
    appliances: ['blender', 'handBlender'],
    ingredientIds: ['fruta', 'yogur', 'avena', 'condimentos'],
    ingredients: 'Banana, yogur, avena, agua y canela a gusto.',
    steps: [
      'Poné la banana, el yogur y la avena en el vaso. Sumá un poco de agua para ajustar la textura.',
      'Licuá o procesá con la minipimer hasta integrar. Agregá canela si te gusta.',
    ],
  },
  {
    id: 'panqueques-banana-avena',
    title: 'Panqueques de banana y avena',
    duration: 'Unos 12 minutos',
    appliances: ['blender', 'handBlender'],
    ingredientIds: ['fruta', 'huevos', 'avena', 'aceite'],
    ingredients: 'Banana, huevo, avena y unas gotas de aceite para la sartén.',
    steps: [
      'Procesá banana, huevo y avena hasta formar una mezcla espesa.',
      'Cociná panqueques pequeños en una sartén apenas aceitada, de ambos lados, hasta que el centro quede completamente cocido.',
    ],
  },
  {
    id: 'bowl-yogur-mani',
    title: 'Bowl cremoso de yogur y maní',
    duration: 'Unos 5 minutos',
    appliances: ['blender', 'handBlender'],
    ingredientIds: ['yogur', 'mantequilla-mani', 'fruta', 'avena'],
    ingredients: 'Yogur, mantequilla de maní, fruta y avena.',
    steps: [
      'Integrá el yogur con la mantequilla de maní usando la licuadora o la minipimer.',
      'Serví en un bowl y agregá fruta cortada y avena por encima.',
    ],
  },
];

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  group: 'Despensa' | 'Martes' | 'Viernes';
};

/**
 * Cada producto aparece una sola vez. Las reposiciones del viernes completan
 * el total semanal indicado: no se suman otra vez como una compra completa.
 * Cantidades de referencia del PDF para una persona; revisar lo que ya hay.
 */
export const shopping: ShoppingItem[] = [
  { id: 'arroz', name: 'Arroz', quantity: 'Paquete de 1 kg, solo si falta.', group: 'Despensa' },
  { id: 'pasta', name: 'Pasta', quantity: '500 g, solo si falta.', group: 'Despensa' },
  { id: 'avena', name: 'Avena', quantity: '500 g, solo si falta; también se usa para unir las hamburguesas.', group: 'Despensa' },
  { id: 'lentejas', name: 'Lentejas secas', quantity: 'Paquete de 500 g si falta; la receta usa 350 g.', group: 'Despensa' },
  { id: 'tomate-triturado', name: 'Tomate triturado', quantity: '2 envases según el plan; revisá que alcancen para 400 g el martes y 700 g el viernes (1,1 kg total).', group: 'Despensa' },
  { id: 'polenta', name: 'Polenta instantánea', quantity: 'Opcional, solo si falta.', group: 'Despensa' },
  { id: 'pan-tortillas', name: 'Pan o tortillas', quantity: 'Solo lo que falte; fraccioná y congelá el excedente. El viernes revisá primero lo congelado.', group: 'Despensa' },
  { id: 'aceite', name: 'Aceite', quantity: 'Reponer solo si falta.', group: 'Despensa' },
  { id: 'mostaza', name: 'Mostaza', quantity: 'Opcional; reponer solo si falta.', group: 'Despensa' },
  { id: 'condimentos', name: 'Pimentón, orégano, pimienta, comino y curry suave', quantity: 'Revisar los frascos antes de comprar; canela para los desayunos del menú base.', group: 'Despensa' },
  { id: 'mani-nueces', name: 'Maní o nueces', quantity: 'Puñados pequeños para las meriendas del menú; revisar lo que ya hay.', group: 'Despensa' },
  { id: 'mantequilla-mani', name: 'Mantequilla de maní', quantity: 'Una cucharadita en el desayuno del viernes; solo si no hay.', group: 'Despensa' },
  { id: 'pollo', name: 'Pollo deshuesado', quantity: '1 kg para la sesión del martes.', group: 'Martes' },
  { id: 'huevos', name: 'Huevos', quantity: '6 el martes. El viernes contá los que quedan y completá hasta 10-12 en total para la semana.', group: 'Martes' },
  { id: 'zucchini', name: 'Zucchini o zapallito', quantity: '4 unidades semanales: 2 el martes y 2 el viernes.', group: 'Martes' },
  { id: 'zanahoria', name: 'Zanahoria', quantity: '500 g el martes; el viernes completá 1 kg semanal (no compres otro kilo).', group: 'Martes' },
  { id: 'morron', name: 'Morrón', quantity: '2 unidades semanales: 1 el martes y 1 el viernes.', group: 'Martes' },
  { id: 'papa', name: 'Papa', quantity: '2 medianas el martes; el viernes completá 1,2-1,5 kg en total semanal. La receta de puré usa 700 g.', group: 'Martes' },
  { id: 'limon', name: 'Limón', quantity: '1 unidad el martes; revisar si ya hay.', group: 'Martes' },
  { id: 'yogur', name: 'Yogur', quantity: '4 porciones el martes y 3-4 el viernes, descontando lo que quede: 7-8 semanales de referencia.', group: 'Martes' },
  { id: 'fruta', name: 'Fruta', quantity: '5-7 unidades firmes el martes; el viernes reponé lo que falte para 10-14 semanales.', group: 'Martes' },
  { id: 'cebolla', name: 'Cebolla', quantity: 'Opcional: 1 en total, media para el guiso y media para la salsa.', group: 'Martes' },
  { id: 'carne', name: 'Carne picada magra', quantity: '1,2 kg el viernes: 650 g para salsa y 550 g para hamburguesas.', group: 'Viernes' },
  { id: 'queso', name: 'Queso', quantity: '250-350 g semanales según uso; revisá existencias antes del viernes y adelantá solo lo que necesites.', group: 'Viernes' },
  { id: 'zapallo', name: 'Zapallo', quantity: '1 kg en la compra de referencia; la receta de puré usa 500 g. Se puede comprar el martes.', group: 'Viernes' },
  { id: 'tomate', name: 'Tomate fresco', quantity: '4-6 unidades de referencia; el viernes reponé los frescos para el fin de semana. Si vas a usar antes, adelantá parte de ese total.', group: 'Viernes' },
  { id: 'hojas', name: 'Hojas verdes', quantity: '1 paquete pequeño; comprar el viernes para el fin de semana. Si hacés wraps el jueves, adelantá solo esa parte.', group: 'Viernes' },
];

export type PrepSession = {
  title: string;
  duration: string;
  steps: string[];
  freeze: string;
};

export const prepSessions: { tuesday: PrepSession; friday: PrepSession } = {
  tuesday: {
    title: 'Martes · pollo, arroz y lentejas',
    duration: '85-105 minutos',
    steps: [
      'Antes de empezar, revisá heladera y despensa; prepará recipientes y etiquetas.',
      '0-10 min: lavá y cortá las verduras. Poné el guiso de lentejas en la olla grande y el arroz en la pequeña.',
      '10-25 min: cortá y condimentá 1 kg de pollo. Doralo en la plancha en dos tandas.',
      '25-40 min: apagá el arroz y dejalo reposar tapado. Seguí con el pollo; revolvé el guiso y revisá el líquido.',
      '40-55 min: retirado el pollo, salteá las verduras en la plancha. Reutilizá la olla del arroz para hervir 4 huevos.',
      '55-70 min: revisá las lentejas y la papa. Guardá los huevos con cáscara y pelá solo los que uses. Repartí arroz y guiso en recipientes bajos.',
      '70-90 min: armá los bowls, etiquetá fecha y destino. Dejá la cena del martes y las porciones de miércoles y jueves a mano.',
      'Cuando las preparaciones pierdan el calor intenso, tapá y llevá a frío. Recalentá solo la porción que vayas a comer; lavá las ollas para cerrar la cocina.',
    ],
    freeze: 'El martes congelá 1 bowl de pollo, arroz y verduras para el viernes, y 1 guiso de emergencia. El jueves pasá el bowl del viernes a la heladera. El anexo reserva la heladera para lo de los próximos tres días.',
  },
  friday: {
    title: 'Viernes · salsa, hamburguesas y puré',
    duration: 'Aproximadamente 90 minutos',
    steps: [
      'Antes de comprar, contá huevos, yogur, fruta, queso y verduras. Comprá la diferencia hasta el total semanal.',
      '0-10 min: dividí 1,2 kg de carne picada: 650 g para salsa y 550 g para 4 hamburguesas. Poné papa y zapallo a hervir en la olla pequeña.',
      '10-25 min: dorá la carne de la salsa en la olla grande; agregá 700 g de tomate triturado y las verduras ralladas.',
      '25-40 min: formá las 4 hamburguesas con 2 cucharadas de avena y los condimentos del plan. Cocinalas en la plancha en dos tandas.',
      '40-55 min: colá papa y zapallo, reservando agua de cocción. Hacé el puré y revisá la salsa.',
      '55-70 min: retiradas las hamburguesas, salteá zucchini o morrón. Prepará tomate y zanahoria para las terminaciones frescas.',
      '70-90 min: separá primero las porciones del lunes y congelalas cuando hayan perdido el calor fuerte. Etiquetá lo del fin de semana.',
      'Serví hamburguesa con puré y tomate. Dejá pasta, arroz, polenta y wraps para terminar en el momento, según la comida.',
    ],
    freeze: 'Congelá el viernes la salsa o hamburguesa destinada al lunes; si vas a usar ambas, reservá ambas porciones. Pasalas del freezer a la heladera el domingo a la noche. No esperes al domingo para congelar.',
  },
};

export type WorkoutReference = {
  title: string;
  exercises: string[];
  note: string;
};

export const workouts: WorkoutReference[] = [
  {
    title: 'Día 1 · Tren inferior',
    exercises: [
      'Sentadilla goblet / prensa · 3 × 8-10 · descanso 90 s. Serie de entrada liviana antes de las series efectivas.',
      'Peso muerto rumano con mancuernas · 3 × 8-10 · descanso 90 s. Serie de entrada técnica con menos carga.',
      'Hip thrust / puente de glúteos · 3 × 10-12 · descanso 75-90 s. Serie de entrada de activación.',
      'Extensión de cuádriceps · 3 × 12-15 · descanso 60 s. Controlá la bajada y el rango sin dolor.',
      'Curl femoral · 3 × 10-12 · descanso 60 s. Sin rebotes.',
      'Elevación de gemelos · 3 × 12-20 · descanso 45-60 s. Pausa arriba y abajo.',
      'Plancha frontal · 3 × 30-45 s · descanso 45 s. Respirá sin colapsar la zona lumbar.',
    ],
    note: 'Rutina original: piernas, glúteos y core. La semana de base técnica indica cargas cómodas y dejar 2-3 repeticiones en reserva. Esta referencia empieza sin cargas registradas ni ejercicios marcados como hechos.',
  },
  {
    title: 'Día 2 · Pecho y bíceps',
    exercises: [
      'Press de pecho en máquina / mancuernas · 3 × 8-10 · descanso 90 s. Serie de entrada liviana y control escapular.',
      'Press inclinado con mancuernas · 3 × 8-10 · descanso 75-90 s. Serie de entrada si vas a cargar fuerte.',
      'Aperturas en máquina / mancuernas · 3 × 10-12 · descanso 60 s. Movimiento amplio pero cómodo.',
      'Curl bíceps con mancuernas · 3 × 10-12 · descanso 60 s. Codo fijo, sin balanceo.',
      'Curl martillo · 3 × 10-12 · descanso 60 s. Muñeca neutra.',
      'Elevaciones laterales · 3 × 12-15 · descanso 45-60 s. Poco peso y control.',
      'Dead bug / hollow hold suave · 3 × 8-12 · descanso 45 s. Priorizá el control de la zona lumbar y la pelvis.',
    ],
    note: 'Rutina original: pecho, bíceps, hombro lateral y core. El plan de 4 semanas propone progresión suave solo si la técnica se mantiene limpia; los registros de carga quedan para tu entrenamiento real.',
  },
  {
    title: 'Día 3 · Espalda y tríceps',
    exercises: [
      'Jalón al pecho · 3 × 8-10 · descanso 90 s. Serie de entrada liviana; hombros lejos de las orejas.',
      'Remo sentado / remo con mancuerna · 3 × 8-10 · descanso 90 s. Serie de entrada técnica antes de cargar.',
      'Pull-over en polea / máquina · 3 × 10-12 · descanso 60 s. No dobles de más los codos.',
      'Face pull / pájaros · 3 × 12-15 · descanso 45-60 s. Ligero y limpio.',
      'Extensión de tríceps con cuerda en polea · 3 × 10-12 · descanso 60 s. Codo estable, sin dolor.',
      'Extensión sobre cabeza con cuerda o mancuerna · 2-3 × 10-12 · descanso 60 s. Liviana si sentís la articulación.',
      'Pallof press / plancha lateral · 3 × 10-12 · descanso 45 s. Antirrotación y control.',
    ],
    note: 'Rutina original: dorsales, espalda media, tríceps, deltoide posterior y core. En el plan, la semana 4 baja la carga 10-15% o una serie en los ejercicios principales para priorizar control.',
  },
];
