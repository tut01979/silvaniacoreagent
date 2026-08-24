export interface EvaExercise {
  id: string;
  category: "R" | "S" | "L" | "D_T" | "VOCALES" | "TRABALENGUAS";
  name: string;
  targetText: string;
  level: "Inicial" | "Intermedio" | "Avanzado";
  description: string;
  tips: string;
  expectedMarMin?: number;
  expectedMarMax?: number;
}

export interface EvaLessonStage {
  step: number;
  title: string;
  durationMinutes: number;
  instruction: string;
  exercise: EvaExercise;
}

export interface EvaLesson {
  id: string;
  title: string;
  totalDurationMinutes: number;
  description: string;
  category: string;
  stages: EvaLessonStage[];
}

export const EVA_EXERCISES_DATABASE: EvaExercise[] = [
  // --- ROTACISMO (R / RR) ---
  {
    id: "r-01",
    category: "R",
    name: "La R Suave en Posición Intervocálica",
    targetText: "El loro y la mariposa vuelan sobre el faro de arena.",
    level: "Inicial",
    description: "Practica el roce suave de la punta de la lengua contra el paladar.",
    tips: "Toca ligeramente los alveolos con la punta de la lengua sin hacer presión fuerte."
  },
  {
    id: "r-02",
    category: "R",
    name: "Sínfones con T y D (Tr / Dr)",
    targetText: "El tren del dragón cruza la pradera de cristal.",
    level: "Intermedio",
    description: "Ideal para preparar la articulación antes de la R vibrante.",
    tips: "Pronuncia la 'T' o 'D' y deja escapar el aire rápidamente para arrastrar la R."
  },
  {
    id: "r-03",
    category: "R",
    name: "La R Doble Vibrante Fuerte",
    targetText: "El ferrocarril lleva un carro cargado de arroz y torres de madera.",
    level: "Avanzado",
    description: "Vibración múltiple de la punta de la lengua.",
    tips: "Proyecta el aire con fuerza desde el diafragma manteniendo la lengua relajada pero firme."
  },
  {
    id: "r-04",
    category: "R",
    name: "Trabalenguas de la R",
    targetText: "El perro de San Roque no tiene rabo porque Ramón Ramírez se lo ha robado.",
    level: "Avanzado",
    description: "Desafío de agilidad para la R vibrante continua.",
    tips: "Comienza despacio marcando cada sílaba y acelera gradualmente."
  },

  // --- SIGMATISMO (S / Z) ---
  {
    id: "s-01",
    category: "S",
    name: "Siseo Inicial Suave",
    targetText: "El sol de la mañana ilumina la silla y la sombrilla.",
    level: "Inicial",
    description: "Control de la salida de aire central por los dientes.",
    tips: "Mantén los dientes ligeramente juntos y sopla suavemente por el centro."
  },
  {
    id: "s-02",
    category: "S",
    name: "S Trabada y Combinada",
    targetText: "En la cesta del castillo hay pasteles de frutas y almendras.",
    level: "Intermedio",
    description: "Articulación de la S al final de sílaba.",
    tips: "Evita arrastrar la S; haz un corte limpio al final de la palabra."
  },
  {
    id: "s-03",
    category: "S",
    name: "Trabalenguas del Sigmatismo",
    targetText: "Si Sansón no sana su salsa con sal, Sansón no saboreará su salsa salada.",
    level: "Avanzado",
    description: "Repetición acelerada del fonema S.",
    tips: "Mantén una ligera sonrisa fonética durante todo el trabalenguas."
  },

  // --- LAMBDACISMO Y DELTACISMO (L / D / T) ---
  {
    id: "l-01",
    category: "L",
    name: "Lateralización de la L",
    targetText: "La lámpara del salón alumbra el libro azul de Lalo.",
    level: "Inicial",
    description: "Escape del aire por los laterales de la lengua.",
    tips: "Apoya la punta de la lengua arriba y deja que el aire salga por los lados."
  },
  {
    id: "d-01",
    category: "D_T",
    name: "Control Dental de D y T",
    targetText: "El dado de David cayó en la tienda del teniente Daniel.",
    level: "Intermedio",
    description: "Contacto entre los incisivos superiores y la punta lingual.",
    tips: "No muerdas la lengua; solo tócala con la punta de los dientes."
  },

  // --- VOCALIZACIÓN Y GESTICULACIÓN POR CÁMARA (A, E, I, O, U) ---
  {
    id: "vocal-01",
    category: "VOCALES",
    name: "Apertura Máxima para la A y O",
    targetText: "Ana la arpa toca mientras Carlos canta bajo la luna.",
    level: "Inicial",
    description: "Entrenamiento de apertura vertical de mandíbula (MAR > 0.35).",
    tips: "Abre la boca como si fueras a bostezar. La cámara evaluará el ratio MAR.",
    expectedMarMin: 0.30
  },
  {
    id: "vocal-02",
    category: "VOCALES",
    name: "Proyección de Labios para O y U",
    targetText: "El oso Bruno busca uvas dulces en el bosque profundo.",
    level: "Intermedio",
    description: "Redondeo labial proyectado hacia adelante.",
    tips: "Forma un círculo perfecto con los labios proyectados hacia afuera.",
    expectedMarMin: 0.15,
    expectedMarMax: 0.30
  },

  // --- TRABALENGUAS EXTREMOS ---
  {
    id: "tb-01",
    category: "TRABALENGUAS",
    name: "Tres Tristes Tigres",
    targetText: "Tres tristes tigres tragaban trigo en un trigal, en un trigal tragaban trigo tres tristes tigres.",
    level: "Avanzado",
    description: "Combinación de TR, S y G para máxima agilidad verbal.",
    tips: "Enfócate en articular claramente la sílaba 'TRI' en cada repetición."
  },
  {
    id: "tb-02",
    category: "TRABALENGUAS",
    name: "Lado, Ledo, Lido",
    targetText: "Lado, ledo, lido, lodo, ludo, decirlo al revés lo dudo. Ludo, lodo, lido, ledo, lado, ¡qué trabajo me ha costado!",
    level: "Avanzado",
    description: "Inversión fonética rápida.",
    tips: "Modula la voz aumentando la velocidad en la segunda frase."
  }
];

export const EVA_LESSONS: EvaLesson[] = [
  {
    id: "lesson-r-25min",
    title: "Dominando la R Vibrante y la Dicción",
    totalDurationMinutes: 25,
    category: "Rotacismo",
    description: "Clase completa de 25 minutos para superar el rotacismo y lograr una R potente y fluida.",
    stages: [
      {
        step: 1,
        title: "Calentamiento Bucofacial y Praxias Linguales",
        durationMinutes: 4,
        instruction: "Realiza masajes suaves en los labios y haz vibrar la lengua suelta imitando el sonido de un motor.",
        exercise: EVA_EXERCISES_DATABASE[0]
      },
      {
        step: 2,
        title: "Preparación Fonética con Tr y Dr",
        durationMinutes: 6,
        instruction: "Practica combinaciones auxiliares para ablandar la punta de la lengua.",
        exercise: EVA_EXERCISES_DATABASE[1]
      },
      {
        step: 3,
        title: "La R Doble Vibrante en Frases",
        durationMinutes: 10,
        instruction: "Articula frases completas expulsando el aire con potencia desde el abdomen.",
        exercise: EVA_EXERCISES_DATABASE[2]
      },
      {
        step: 4,
        title: "Desafío de Trabalenguas y Evaluación",
        durationMinutes: 5,
        instruction: "Lee el trabalenguas a máxima velocidad reteniendo la claridad fonética.",
        exercise: EVA_EXERCISES_DATABASE[3]
      }
    ]
  },
  {
    id: "lesson-s-20min",
    title: "Fluidez, Claridad y Control de la S",
    totalDurationMinutes: 20,
    category: "Sigmatismo",
    description: "Elimina el siseo excesivo y logra una S nítida y profesional.",
    stages: [
      {
        step: 1,
        title: "Control del Canal de Aire Central",
        durationMinutes: 4,
        instruction: "Sopla aire de forma continua juntando ligeramente los incisivos.",
        exercise: EVA_EXERCISES_DATABASE[4]
      },
      {
        step: 2,
        title: "Articulación de la S en Frases Limpias",
        durationMinutes: 6,
        instruction: "Pronuncia las consonantes trabadas asegurando el corte limpio al final.",
        exercise: EVA_EXERCISES_DATABASE[5]
      },
      {
        step: 3,
        title: "Trabalenguas y Agilidad Verbal",
        durationMinutes: 10,
        instruction: "Supera el reto de Sansón articulando a ritmo rápido.",
        exercise: EVA_EXERCISES_DATABASE[6]
      }
    ]
  },
  {
    id: "lesson-camera-20min",
    title: "Vocalización y Proyección Labial con Cámara",
    totalDurationMinutes: 20,
    category: "Visión & Cámara",
    description: "Usa la cámara y la inteligencia artificial para medir y perfeccionar la apertura de tu boca.",
    stages: [
      {
        step: 1,
        title: "Apertura Máxima de Mandíbula (Vocales Abiertas)",
        durationMinutes: 8,
        instruction: "Activa la cámara y abre la boca hasta alcanzar un ratio MAR superior a 0.30.",
        exercise: EVA_EXERCISES_DATABASE[9]
      },
      {
        step: 2,
        title: "Redondeo y Proyección Labial",
        durationMinutes: 12,
        instruction: "Mantén los labios redondeados frente a la cámara al vocalizar las palabras clave.",
        exercise: EVA_EXERCISES_DATABASE[10]
      }
    ]
  },
  {
    id: "lesson-speed-25min",
    title: "Trabalenguas Extremos y Velocidad de Habla",
    totalDurationMinutes: 25,
    category: "Agilidad",
    description: "Entrenamiento intensivo de 25 minutos para locutores, oradores y estudiantes de idiomas.",
    stages: [
      {
        step: 1,
        title: "Calentamiento Lingual de Alta Velocidad",
        durationMinutes: 5,
        instruction: "Acelera el ritmo vocalizando sílabas compuestas.",
        exercise: EVA_EXERCISES_DATABASE[11]
      },
      {
        step: 2,
        title: "Inversión Fonética y Reto Final",
        durationMinutes: 20,
        instruction: "Completa la lección recitando trabalenguas invertidos sin trabarte.",
        exercise: EVA_EXERCISES_DATABASE[12]
      }
    ]
  }
];

export function getExercisesByCategory(category: string): EvaExercise[] {
  return EVA_EXERCISES_DATABASE.filter(ex => ex.category === category);
}

export function getLessonById(id: string): EvaLesson | undefined {
  return EVA_LESSONS.find(lesson => lesson.id === id);
}
