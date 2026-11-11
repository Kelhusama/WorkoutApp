export type Equipment = 'barra' | 'mancuerna' | 'goma' | 'ninguno';

export interface Exercise {
  id: string;
  name: string;
  /** 'reps' = repeticiones · 'time' = segundos. */
  measure: 'reps' | 'time';
  perArm: boolean;
  equipment: Equipment;
  muscles: string[];
  cues: string[];
  mistakes: string[];
}

export const EXERCISES: Record<string, Exercise> = {
  dominada_supina: {
    id: 'dominada_supina',
    name: 'Dominada supina',
    measure: 'reps',
    perArm: false,
    equipment: 'barra',
    muscles: ['Bíceps', 'Dorsal'],
    cues: [
      'Palmas hacia ti, manos al ancho de hombros',
      'Empieza colgado con brazos estirados del todo',
      'Lleva el pecho a la barra, no solo la barbilla',
      'Baja controlado hasta estirar los brazos',
    ],
    mistakes: ['Medias repeticiones', 'Balancear las piernas', 'Dejarse caer de golpe'],
  },
  dominada_neutra: {
    id: 'dominada_neutra',
    name: 'Dominada agarre neutro',
    measure: 'reps',
    perArm: false,
    equipment: 'barra',
    muscles: ['Bíceps', 'Braquial', 'Dorsal'],
    cues: [
      'Palmas enfrentadas en los agarres paralelos',
      'Hombros abajo y atrás antes de tirar',
      'Sube hasta pasar la barbilla de las manos',
      'Sin llegar al fallo: deja 1–2 en reserva',
    ],
    mistakes: ['Encoger los hombros hacia las orejas', 'Patear para subir'],
  },
  negativa_dominada: {
    id: 'negativa_dominada',
    name: 'Dominada negativa',
    measure: 'reps',
    perArm: false,
    equipment: 'barra',
    muscles: ['Dorsal', 'Bíceps'],
    cues: [
      'Sube de un salto (o con una silla) a la posición alta',
      'Baja muy lento: 4–5 segundos',
      'Controla hasta tener los brazos estirados',
    ],
    mistakes: ['Caer rápido en la última parte', 'Hacer demasiadas: fatigan mucho'],
  },
  colgarse: {
    id: 'colgarse',
    name: 'Colgarse de la barra',
    measure: 'time',
    perArm: false,
    equipment: 'barra',
    muscles: ['Antebrazo', 'Agarre'],
    cues: ['Agarre firme, brazos estirados', 'Hombros ligeramente activos, no totalmente sueltos', 'Respira con calma'],
    mistakes: ['Soltar antes por mala posición del pulgar'],
  },
  remo_mancuerna: {
    id: 'remo_mancuerna',
    name: 'Remo con mancuerna a una mano',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Dorsal', 'Romboides', 'Bíceps'],
    cues: [
      'Mano y rodilla apoyadas en una silla, espalda recta',
      'Tira del codo hacia la cadera',
      'Pausa arriba apretando la espalda',
      'Baja estirando bien el brazo',
    ],
    mistakes: ['Girar el tronco para subir', 'Tirar solo con el bíceps'],
  },
  curl_concentrado: {
    id: 'curl_concentrado',
    name: 'Curl concentrado',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Bíceps'],
    cues: [
      'Sentado, codo apoyado en la cara interna del muslo',
      'Sube girando el meñique hacia arriba',
      'Aprieta el bíceps arriba',
      'Baja hasta casi estirar del todo',
    ],
    mistakes: ['Mover el codo', 'Ayudarse con el hombro'],
  },
  curl_martillo: {
    id: 'curl_martillo',
    name: 'Curl martillo',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Braquial', 'Bíceps', 'Antebrazo'],
    cues: ['Agarre neutro (pulgar arriba)', 'Codo pegado al cuerpo', 'Sube sin balanceo y baja lento'],
    mistakes: ['Balancear el cuerpo', 'Separar el codo'],
  },
  curl_muneca: {
    id: 'curl_muneca',
    name: 'Curl de muñeca',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Antebrazo (flexores)'],
    cues: ['Antebrazo apoyado en el muslo, palma arriba', 'Solo se mueve la muñeca', 'Recorrido completo: abajo y arriba'],
    mistakes: ['Levantar el antebrazo del apoyo'],
  },
  curl_muneca_inverso: {
    id: 'curl_muneca_inverso',
    name: 'Curl de muñeca inverso',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Antebrazo (extensores)'],
    cues: ['Antebrazo apoyado, palma hacia abajo', 'Sube el dorso de la mano', 'Movimiento lento y corto'],
    mistakes: ['Usar impulso'],
  },
  flexion_estricta: {
    id: 'flexion_estricta',
    name: 'Flexión estricta',
    measure: 'reps',
    perArm: false,
    equipment: 'ninguno',
    muscles: ['Pecho', 'Tríceps', 'Hombro'],
    cues: [
      'Cuerpo recto como una tabla: glúteo y abdomen apretados',
      'Codos a unos 45° del cuerpo',
      'Pecho casi al suelo en cada repetición',
      'Brazos estirados del todo arriba',
    ],
    mistakes: ['Cadera caída o en pico', 'Codos abiertos a 90°', 'Medio recorrido'],
  },
  flexion_inclinada: {
    id: 'flexion_inclinada',
    name: 'Flexión inclinada',
    measure: 'reps',
    perArm: false,
    equipment: 'ninguno',
    muscles: ['Pecho', 'Tríceps'],
    cues: ['Manos en una silla estable o banco', 'Misma técnica que la estricta', 'Pecho hasta tocar el borde'],
    mistakes: ['Silla que se mueve', 'Cadera caída'],
  },
  flexion_pica: {
    id: 'flexion_pica',
    name: 'Flexión en pica',
    measure: 'reps',
    perArm: false,
    equipment: 'ninguno',
    muscles: ['Hombro', 'Tríceps'],
    cues: [
      'Cadera arriba: cuerpo en V invertida',
      'Baja la cabeza hacia el suelo, delante de las manos',
      'Codos hacia atrás, no abiertos',
      'Empuja hasta estirar los brazos',
    ],
    mistakes: ['Bajar el pecho en vez de la cabeza', 'Cadera demasiado baja'],
  },
  press_militar_una_mano: {
    id: 'press_militar_una_mano',
    name: 'Press militar a una mano',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Hombro', 'Tríceps'],
    cues: ['De pie o sentado, abdomen firme', 'Mancuerna a la altura del hombro', 'Empuja vertical hasta estirar', 'No arquees la espalda'],
    mistakes: ['Inclinarse hacia un lado', 'Arquear la zona lumbar'],
  },
  pajaros: {
    id: 'pajaros',
    name: 'Pájaros (hombro posterior)',
    measure: 'reps',
    perArm: true,
    equipment: 'mancuerna',
    muscles: ['Hombro posterior', 'Romboides'],
    cues: ['Inclinado con la espalda recta', 'Brazo casi estirado', 'Abre hacia el lado hasta la altura del hombro', 'Si 10 kg es mucho, usa la goma'],
    mistakes: ['Usar impulso', 'Subir por encima del hombro'],
  },
};

