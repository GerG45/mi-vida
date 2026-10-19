/** Tutorials verified against YouTube's public oEmbed metadata on 2026-10-19.
 * Original plan preserved; videos are external demonstrations, never auto-played.
 */
export interface TrainingTutorial {
  id: string; label: string; videoId: string; title: string; channel: string;
  url: string; thumbnail: string; language: 'es' | 'en'; languageLabel: string;
  illustration: string;
}

export interface TrainingMedia {
  exerciseId: string; illustration: string; posterAlt: string; tutorials: TrainingTutorial[];
}

export const TRAINING_MEDIA: Record<string, TrainingMedia> = {
  "d1-e1": {
    "exerciseId": "d1-e1",
    "illustration": "./training/goblet.svg",
    "posterAlt": "Sentadilla goblet · ilustración orientativa",
    "tutorials": [
      {
        "id": "goblet",
        "label": "Sentadilla goblet",
        "videoId": "tCQcDTZhZ4k",
        "title": "Te explico como hacer SENTADILLA GOBLET con buena técnica",
        "channel": "Fitness with Pablo",
        "url": "https://www.youtube.com/watch?v=tCQcDTZhZ4k",
        "thumbnail": "https://i.ytimg.com/vi/tCQcDTZhZ4k/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/goblet.svg"
      },
      {
        "id": "leg-press",
        "label": "Prensa",
        "videoId": "WvLsUYH8v5g",
        "title": "Prensa de piernas (Leg Press) | Técnica perfecta, rango seguro y errores comunes",
        "channel": "Ramona Gorraiz",
        "url": "https://www.youtube.com/watch?v=WvLsUYH8v5g",
        "thumbnail": "https://i.ytimg.com/vi/WvLsUYH8v5g/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/leg-press.svg"
      }
    ]
  },
  "d1-e2": {
    "exerciseId": "d1-e2",
    "illustration": "./training/romanian-dumbbell.svg",
    "posterAlt": "Peso muerto rumano con mancuernas · ilustración orientativa",
    "tutorials": [
      {
        "id": "romanian-dumbbell",
        "label": "Peso muerto rumano con mancuernas",
        "videoId": "hQgFixeXdZo",
        "title": "Dumbbell Romanian (RDL) Deadlift |TECHNIQUE for Beginners",
        "channel": "Mike | J2FIT Strength & Conditioning",
        "url": "https://www.youtube.com/watch?v=hQgFixeXdZo",
        "thumbnail": "https://i.ytimg.com/vi/hQgFixeXdZo/hqdefault.jpg",
        "language": "en",
        "languageLabel": "Inglés",
        "illustration": "./training/romanian-dumbbell.svg"
      }
    ]
  },
  "d1-e3": {
    "exerciseId": "d1-e3",
    "illustration": "./training/hip-thrust.svg",
    "posterAlt": "Hip thrust · ilustración orientativa",
    "tutorials": [
      {
        "id": "hip-thrust",
        "label": "Hip thrust",
        "videoId": "SEdqd1n0cvg",
        "title": "How To: Hip Thrust",
        "channel": "ScottHermanFitness",
        "url": "https://www.youtube.com/watch?v=SEdqd1n0cvg",
        "thumbnail": "https://i.ytimg.com/vi/SEdqd1n0cvg/hqdefault.jpg",
        "language": "en",
        "languageLabel": "Inglés",
        "illustration": "./training/hip-thrust.svg"
      },
      {
        "id": "glute-bridge",
        "label": "Puente de glúteos",
        "videoId": "wPM8icPu6H8",
        "title": "How To Do A Glute Bridge | The Right Way | Well+Good",
        "channel": "Well+Good",
        "url": "https://www.youtube.com/watch?v=wPM8icPu6H8",
        "thumbnail": "https://i.ytimg.com/vi/wPM8icPu6H8/hqdefault.jpg",
        "language": "en",
        "languageLabel": "Inglés",
        "illustration": "./training/glute-bridge.svg"
      }
    ]
  },
  "d1-e4": {
    "exerciseId": "d1-e4",
    "illustration": "./training/leg-extension.svg",
    "posterAlt": "Extensión de cuádriceps · ilustración orientativa",
    "tutorials": [
      {
        "id": "leg-extension",
        "label": "Extensión de cuádriceps",
        "videoId": "YyvSfVjQeL0",
        "title": "How To: Leg Extension (Cybex)",
        "channel": "ScottHermanFitness",
        "url": "https://www.youtube.com/watch?v=YyvSfVjQeL0",
        "thumbnail": "https://i.ytimg.com/vi/YyvSfVjQeL0/hqdefault.jpg",
        "language": "en",
        "languageLabel": "Inglés",
        "illustration": "./training/leg-extension.svg"
      }
    ]
  },
  "d1-e5": {
    "exerciseId": "d1-e5",
    "illustration": "./training/leg-curl.svg",
    "posterAlt": "Curl femoral · ilustración orientativa",
    "tutorials": [
      {
        "id": "leg-curl",
        "label": "Curl femoral",
        "videoId": "RQveaxgomSA",
        "title": "¿Cómo hacer el curl femoral tumbado CORRECTAMENTE? | LEG CURL en MÁQUINA para ISQUIO",
        "channel": "APTA Vital Sport",
        "url": "https://www.youtube.com/watch?v=RQveaxgomSA",
        "thumbnail": "https://i.ytimg.com/vi/RQveaxgomSA/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/leg-curl.svg"
      }
    ]
  },
  "d1-e6": {
    "exerciseId": "d1-e6",
    "illustration": "./training/calf-raise.svg",
    "posterAlt": "Elevación de gemelos · ilustración orientativa",
    "tutorials": [
      {
        "id": "calf-raise",
        "label": "Elevación de gemelos",
        "videoId": "3DW2rm90F6A",
        "title": "768. Elevación de gemelos",
        "channel": "Proet Ejercicio Terapéutico",
        "url": "https://www.youtube.com/watch?v=3DW2rm90F6A",
        "thumbnail": "https://i.ytimg.com/vi/3DW2rm90F6A/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/calf-raise.svg"
      }
    ]
  },
  "d1-e7": {
    "exerciseId": "d1-e7",
    "illustration": "./training/front-plank.svg",
    "posterAlt": "Plancha frontal · ilustración orientativa",
    "tutorials": [
      {
        "id": "front-plank",
        "label": "Plancha frontal",
        "videoId": "kpZg8IIM-to",
        "title": "Plancha Frontal - ABDOMEN - TÉCNICA CORRECTA",
        "channel": "Manuel Escalera",
        "url": "https://www.youtube.com/watch?v=kpZg8IIM-to",
        "thumbnail": "https://i.ytimg.com/vi/kpZg8IIM-to/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/front-plank.svg"
      }
    ]
  },
  "d2-e1": {
    "exerciseId": "d2-e1",
    "illustration": "./training/machine-chest-press.svg",
    "posterAlt": "Press de pecho en máquina · ilustración orientativa",
    "tutorials": [
      {
        "id": "machine-chest-press",
        "label": "Press de pecho en máquina",
        "videoId": "lw4uUkBl_HE",
        "title": "Press de pecho en máquina | Técnica perfecta + ajustes del asiento (Chest Press)",
        "channel": "Ramona Gorraiz",
        "url": "https://www.youtube.com/watch?v=lw4uUkBl_HE",
        "thumbnail": "https://i.ytimg.com/vi/lw4uUkBl_HE/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/machine-chest-press.svg"
      },
      {
        "id": "dumbbell-chest-press",
        "label": "Press de pecho con mancuernas",
        "videoId": "LTcJKepLZMg",
        "title": "✅ PRESS de BANCA PLANO con MANCUERNAS, Bench Press",
        "channel": "Vida en Forma",
        "url": "https://www.youtube.com/watch?v=LTcJKepLZMg",
        "thumbnail": "https://i.ytimg.com/vi/LTcJKepLZMg/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/dumbbell-chest-press.svg"
      }
    ]
  },
  "d2-e2": {
    "exerciseId": "d2-e2",
    "illustration": "./training/incline-dumbbell-press.svg",
    "posterAlt": "Press inclinado con mancuernas · ilustración orientativa",
    "tutorials": [
      {
        "id": "incline-dumbbell-press",
        "label": "Press inclinado con mancuernas",
        "videoId": "oTD5g77GgSA",
        "title": "Cómo Hacer Press Inclinado Con Mancuernas (Tutorial Paso a Paso)",
        "channel": "Your House Fitness",
        "url": "https://www.youtube.com/watch?v=oTD5g77GgSA",
        "thumbnail": "https://i.ytimg.com/vi/oTD5g77GgSA/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/incline-dumbbell-press.svg"
      }
    ]
  },
  "d2-e3": {
    "exerciseId": "d2-e3",
    "illustration": "./training/machine-fly.svg",
    "posterAlt": "Aperturas en máquina · ilustración orientativa",
    "tutorials": [
      {
        "id": "machine-fly",
        "label": "Aperturas en máquina",
        "videoId": "NfQJyaxAJX8",
        "title": "✅ APERTURAS en MÁQUINA para PECTORAL // Peck Deck Pectoral",
        "channel": "Manuel Escalera",
        "url": "https://www.youtube.com/watch?v=NfQJyaxAJX8",
        "thumbnail": "https://i.ytimg.com/vi/NfQJyaxAJX8/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/machine-fly.svg"
      },
      {
        "id": "dumbbell-fly",
        "label": "Aperturas con mancuernas",
        "videoId": "-AQ0sJv4e8k",
        "title": "Apertura con Mancuernas en Banco Plano",
        "channel": "portalfitness",
        "url": "https://www.youtube.com/watch?v=-AQ0sJv4e8k",
        "thumbnail": "https://i.ytimg.com/vi/-AQ0sJv4e8k/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/dumbbell-fly.svg"
      }
    ]
  },
  "d2-e4": {
    "exerciseId": "d2-e4",
    "illustration": "./training/dumbbell-curl.svg",
    "posterAlt": "Curl bíceps con mancuernas · ilustración orientativa",
    "tutorials": [
      {
        "id": "dumbbell-curl",
        "label": "Curl bíceps con mancuernas",
        "videoId": "vyrtAfr1JBY",
        "title": "Curl de bíceps con mancuernas: técnica paso a paso",
        "channel": "BuhoSalud",
        "url": "https://www.youtube.com/watch?v=vyrtAfr1JBY",
        "thumbnail": "https://i.ytimg.com/vi/vyrtAfr1JBY/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/dumbbell-curl.svg"
      }
    ]
  },
  "d2-e5": {
    "exerciseId": "d2-e5",
    "illustration": "./training/hammer-curl.svg",
    "posterAlt": "Curl martillo · ilustración orientativa",
    "tutorials": [
      {
        "id": "hammer-curl",
        "label": "Curl martillo",
        "videoId": "RHdacbwKbTo",
        "title": "Cómo Hacer Curl Martillo Con Mancuerna (Tutorial Paso a Paso)",
        "channel": "Your House Fitness",
        "url": "https://www.youtube.com/watch?v=RHdacbwKbTo",
        "thumbnail": "https://i.ytimg.com/vi/RHdacbwKbTo/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/hammer-curl.svg"
      }
    ]
  },
  "d2-e6": {
    "exerciseId": "d2-e6",
    "illustration": "./training/lateral-raise.svg",
    "posterAlt": "Elevaciones laterales · ilustración orientativa",
    "tutorials": [
      {
        "id": "lateral-raise",
        "label": "Elevaciones laterales",
        "videoId": "b6KtNTSHA54",
        "title": "ELEVACIONES LATERALES: TUTORIAL Y TÉCNICA PASO A PASO para HOMBROS GRANDES Y REDONDOS 3D 🥥",
        "channel": "Sergio M. Coach",
        "url": "https://www.youtube.com/watch?v=b6KtNTSHA54",
        "thumbnail": "https://i.ytimg.com/vi/b6KtNTSHA54/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/lateral-raise.svg"
      }
    ]
  },
  "d2-e7": {
    "exerciseId": "d2-e7",
    "illustration": "./training/dead-bug.svg",
    "posterAlt": "Dead bug · ilustración orientativa",
    "tutorials": [
      {
        "id": "dead-bug",
        "label": "Dead bug",
        "videoId": "BZYaCzbP09M",
        "title": "Dead Bug",
        "channel": "E3 Rehab Exercise Library",
        "url": "https://www.youtube.com/watch?v=BZYaCzbP09M",
        "thumbnail": "https://i.ytimg.com/vi/BZYaCzbP09M/hqdefault.jpg",
        "language": "en",
        "languageLabel": "Inglés",
        "illustration": "./training/dead-bug.svg"
      },
      {
        "id": "hollow-hold",
        "label": "Hollow hold suave",
        "videoId": "jkP1OjD8geE",
        "title": "Antes de hacer abdominales… aprende Hollow Hold",
        "channel": "GreyMotion",
        "url": "https://www.youtube.com/watch?v=jkP1OjD8geE",
        "thumbnail": "https://i.ytimg.com/vi/jkP1OjD8geE/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/hollow-hold.svg"
      }
    ]
  },
  "d3-e1": {
    "exerciseId": "d3-e1",
    "illustration": "./training/lat-pulldown.svg",
    "posterAlt": "Jalón al pecho · ilustración orientativa",
    "tutorials": [
      {
        "id": "lat-pulldown",
        "label": "Jalón al pecho",
        "videoId": "t7ubydcxLoU",
        "title": "¿Cómo hacer JALÓN al PECHO CORRECTAMENTE? - Tutorial Principiantes Gimnasio",
        "channel": "Entrenador Personal - Malagaentrena",
        "url": "https://www.youtube.com/watch?v=t7ubydcxLoU",
        "thumbnail": "https://i.ytimg.com/vi/t7ubydcxLoU/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/lat-pulldown.svg"
      }
    ]
  },
  "d3-e2": {
    "exerciseId": "d3-e2",
    "illustration": "./training/cable-row.svg",
    "posterAlt": "Remo sentado · ilustración orientativa",
    "tutorials": [
      {
        "id": "cable-row",
        "label": "Remo sentado",
        "videoId": "nwdptbhYjTw",
        "title": "Remo Sentado con Polea - Técnica Correcta y Músculos Involucrados",
        "channel": "DrVíctorLópez",
        "url": "https://www.youtube.com/watch?v=nwdptbhYjTw",
        "thumbnail": "https://i.ytimg.com/vi/nwdptbhYjTw/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/cable-row.svg"
      },
      {
        "id": "dumbbell-row",
        "label": "Remo con mancuerna",
        "videoId": "TXWrtDQ8UgI",
        "title": "Remo con Mancuerna | Técnica Correcta (!)",
        "channel": "ReFUERZAtte",
        "url": "https://www.youtube.com/watch?v=TXWrtDQ8UgI",
        "thumbnail": "https://i.ytimg.com/vi/TXWrtDQ8UgI/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/dumbbell-row.svg"
      }
    ]
  },
  "d3-e3": {
    "exerciseId": "d3-e3",
    "illustration": "./training/cable-pullover.svg",
    "posterAlt": "Pull-over en polea · ilustración orientativa",
    "tutorials": [
      {
        "id": "cable-pullover",
        "label": "Pull-over en polea",
        "videoId": "8PURkIVF-7U",
        "title": "Pullover en Polea ✅Técnica Correcta",
        "channel": "ERRE Academy",
        "url": "https://www.youtube.com/watch?v=8PURkIVF-7U",
        "thumbnail": "https://i.ytimg.com/vi/8PURkIVF-7U/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/cable-pullover.svg"
      },
      {
        "id": "machine-pullover",
        "label": "Pull-over en máquina",
        "videoId": "SBBMysrSGSI",
        "title": "How To Do A SEATED MACHINE PULLOVER (Hammer Strength) | Exercise Demonstration Video and Guide",
        "channel": "Live Lean TV Daily Exercises",
        "url": "https://www.youtube.com/watch?v=SBBMysrSGSI",
        "thumbnail": "https://i.ytimg.com/vi/SBBMysrSGSI/hqdefault.jpg",
        "language": "en",
        "languageLabel": "Inglés",
        "illustration": "./training/machine-pullover.svg"
      }
    ]
  },
  "d3-e4": {
    "exerciseId": "d3-e4",
    "illustration": "./training/face-pull.svg",
    "posterAlt": "Face pull · ilustración orientativa",
    "tutorials": [
      {
        "id": "face-pull",
        "label": "Face pull",
        "videoId": "tIuXc_X8T4I",
        "title": "Cómo Hacer el Face Pull (Tutorial Paso a Paso)",
        "channel": "Your House Fitness",
        "url": "https://www.youtube.com/watch?v=tIuXc_X8T4I",
        "thumbnail": "https://i.ytimg.com/vi/tIuXc_X8T4I/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/face-pull.svg"
      },
      {
        "id": "reverse-fly",
        "label": "Pájaros",
        "videoId": "JKeltymtT1c",
        "title": "PÁJAROS CON MANCUERNAS | Técnica ejercicios",
        "channel": "Aaron Martinez",
        "url": "https://www.youtube.com/watch?v=JKeltymtT1c",
        "thumbnail": "https://i.ytimg.com/vi/JKeltymtT1c/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/reverse-fly.svg"
      }
    ]
  },
  "d3-e5": {
    "exerciseId": "d3-e5",
    "illustration": "./training/rope-pushdown.svg",
    "posterAlt": "Extensión de tríceps con cuerda · ilustración orientativa",
    "tutorials": [
      {
        "id": "rope-pushdown",
        "label": "Extensión de tríceps con cuerda",
        "videoId": "joEdWjMORbI",
        "title": "EXTENSIONES DE TRÍCEPS EN POLEA CON CUERDA. Movimiento correcto",
        "channel": "APTA Vital Sport",
        "url": "https://www.youtube.com/watch?v=joEdWjMORbI",
        "thumbnail": "https://i.ytimg.com/vi/joEdWjMORbI/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/rope-pushdown.svg"
      }
    ]
  },
  "d3-e6": {
    "exerciseId": "d3-e6",
    "illustration": "./training/cable-overhead.svg",
    "posterAlt": "Extensión sobre cabeza con cuerda · ilustración orientativa",
    "tutorials": [
      {
        "id": "cable-overhead",
        "label": "Extensión sobre cabeza con cuerda",
        "videoId": "WUCCX2LCB-c",
        "title": "Extensiones de tríceps sobre la cabeza con cuerda",
        "channel": "Luis Carballo",
        "url": "https://www.youtube.com/watch?v=WUCCX2LCB-c",
        "thumbnail": "https://i.ytimg.com/vi/WUCCX2LCB-c/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/cable-overhead.svg"
      },
      {
        "id": "dumbbell-overhead",
        "label": "Extensión sobre cabeza con mancuerna",
        "videoId": "tBvA2q2WaPE",
        "title": "Extensión tríceps con mancuerna de pie por encima de la cabeza",
        "channel": "Entrenamiento Sputnik",
        "url": "https://www.youtube.com/watch?v=tBvA2q2WaPE",
        "thumbnail": "https://i.ytimg.com/vi/tBvA2q2WaPE/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/dumbbell-overhead.svg"
      }
    ]
  },
  "d3-e7": {
    "exerciseId": "d3-e7",
    "illustration": "./training/pallof-press.svg",
    "posterAlt": "Pallof press · ilustración orientativa",
    "tutorials": [
      {
        "id": "pallof-press",
        "label": "Pallof press",
        "videoId": "cDo8Rt2BNDo",
        "title": "PRESS PALLOF: TODO LO QUE DEBES SABER SOBRE ESTE EJERCICIO",
        "channel": "Training Life",
        "url": "https://www.youtube.com/watch?v=cDo8Rt2BNDo",
        "thumbnail": "https://i.ytimg.com/vi/cDo8Rt2BNDo/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/pallof-press.svg"
      },
      {
        "id": "side-plank",
        "label": "Plancha lateral",
        "videoId": "zfiOU4yxLKo",
        "title": "Cómo hacer la Plancha Lateral",
        "channel": "Gabriel Pieren - ES",
        "url": "https://www.youtube.com/watch?v=zfiOU4yxLKo",
        "thumbnail": "https://i.ytimg.com/vi/zfiOU4yxLKo/hqdefault.jpg",
        "language": "es",
        "languageLabel": "Español",
        "illustration": "./training/side-plank.svg"
      }
    ]
  }
};

function canonicalExerciseId(exerciseId: string): string {
  return exerciseId.replace(/^w[1-4]-/, '');
}

export function getTrainingMedia(exerciseId: string): TrainingMedia | undefined {
  const id = canonicalExerciseId(exerciseId);
  return Object.hasOwn(TRAINING_MEDIA, id) ? TRAINING_MEDIA[id] : undefined;
}

export function getTrainingTutorial(exerciseId: string, variantId?: string): TrainingTutorial | undefined {
  const tutorials = getTrainingMedia(exerciseId)?.tutorials;
  return variantId ? tutorials?.find(tutorial => tutorial.id === variantId) : tutorials?.[0];
}

export function getTrainingIllustration(exerciseId: string, variantId?: string): string {
  return getTrainingTutorial(exerciseId, variantId)?.illustration ?? getTrainingMedia(exerciseId)?.illustration ?? './training/strength.svg';
}
