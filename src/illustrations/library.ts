import type { Illustration, Prop } from './skeleton';

/**
 * Dibujos de cada ejercicio (vista lateral, mirando a la derecha). Lienzo 200 × 210, suelo en y = 200.
 * Las posturas respetan la longitud real de cada segmento.
 */

const FLOOR: Prop = { kind: 'floor', y: 200 };
const BAR: Prop = { kind: 'bar', x: 110, y: 28 };
const SEAT: Prop = { kind: 'bench', x: 46, y: 166, w: 52, h: 34 };

const pullUp: Illustration = {
  start: { hip: [106, 132], torso: -90, hand: [110, 28], elbowBend: 1, foot: [99, 196], kneeBend: -1 },
  end: { hip: [96, 86], torso: -90, hand: [110, 28], elbowBend: 1, foot: [89, 152], kneeBend: -1 },
  props: [FLOOR, BAR],
  focus: ['upperArm', 'forearm', 'back'],
  bothArms: true,
  caption: 'Desde brazos estirados hasta pasar la barbilla de la barra.',
};

const standing = { hip: [100, 126] as const, torso: -90, foot: [98, 198] as const, kneeBend: -1 as const };
const seated = { hip: [78, 158] as const, foot: [118, 196] as const, kneeBend: -1 as const };

const curl: Illustration = {
  start: { ...standing, hand: [104, 128], elbowBend: 1 },
  end: { ...standing, hand: [116, 84], elbowBend: 1 },
  props: [FLOOR],
  focus: ['upperArm', 'forearm'],
  held: 'dumbbell',
  caption: 'Pulgar hacia arriba y codo pegado al cuerpo. Sube sin balancearte.',
};

const row: Illustration = {
  start: { hip: [78, 128], torso: -12, hand: [128, 170], elbowBend: 1, foot: [70, 198], kneeBend: -1, farHand: [150, 138] },
  end: { hip: [78, 128], torso: -12, hand: [110, 128], elbowBend: 1, foot: [70, 198], kneeBend: -1, farHand: [150, 138] },
  props: [FLOOR, { kind: 'bench', x: 132, y: 140, w: 56, h: 60 }],
  focus: ['back', 'upperArm'],
  held: 'dumbbell',
  caption: 'Apoyado en la silla, tira del codo hacia la cadera y baja estirando.',
};

const press: Illustration = {
  start: { ...standing, hand: [110, 72], elbowBend: 1 },
  end: { ...standing, hand: [101, 24], elbowBend: 1 },
  props: [FLOOR],
  focus: ['shoulder', 'upperArm'],
  held: 'dumbbell',
  caption: 'Desde el hombro, empuja vertical hasta estirar. Sin arquear la espalda.',
};

export const ILLUSTRATIONS: Record<string, Illustration> = {
  dominada_supina: { ...pullUp, caption: 'Palmas hacia ti. Sube hasta pasar la barbilla y baja hasta estirar.' },
  dominada_neutra: { ...pullUp, caption: 'Palmas enfrentadas. Sube controlado, sin balanceo.' },
  negativa_dominada: {
    ...pullUp,
    start: pullUp.end,
    end: pullUp.start,
    timing: 'slowReturn',
    caption: 'Empieza arriba y baja muy lento (4–5 s) hasta estirar los brazos.',
  },
  colgarse: {
    ...pullUp,
    end: { ...pullUp.start, hip: [109, 132], foot: [104, 196] },
    focus: ['forearm'],
    caption: 'Cuélgate con los brazos estirados y aguanta el tiempo marcado.',
  },
  remo_mancuerna: row,
  curl_concentrado: {
    start: { ...seated, torso: -55, hand: [118, 169], elbowBend: 1 },
    end: { ...seated, torso: -55, hand: [122, 120], elbowBend: 1 },
    props: [FLOOR, SEAT],
    focus: ['upperArm'],
    held: 'dumbbell',
    caption: 'Sentado, codo apoyado en el muslo. Sube y aprieta el bíceps arriba.',
  },
  curl_martillo: curl,
  curl_muneca: {
    start: { ...seated, torso: -65, hand: [128, 145], elbowBend: 1, wrist: 50 },
    end: { ...seated, torso: -65, hand: [128, 145], elbowBend: 1, wrist: -40 },
    props: [FLOOR, SEAT],
    focus: ['forearm'],
    held: 'dumbbell',
    caption: 'Antebrazo apoyado en el muslo, palma arriba. Solo se mueve la muñeca.',
  },
  curl_muneca_inverso: {
    start: { ...seated, torso: -65, hand: [128, 145], elbowBend: 1, wrist: 50 },
    end: { ...seated, torso: -65, hand: [128, 145], elbowBend: 1, wrist: -30 },
    props: [FLOOR, SEAT],
    focus: ['forearm'],
    held: 'dumbbell',
    caption: 'Igual que el curl de muñeca, pero con la palma hacia abajo.',
  },
  flexion_estricta: {
    start: { hip: [93.4, 167.6], torso: -24.3, hand: [140, 196], elbowBend: 1, foot: [26, 196], kneeBend: 1 },
    end: { hip: [99.5, 187.6], torso: -6.5, hand: [140, 196], elbowBend: 1, foot: [26, 196], kneeBend: 1 },
    props: [FLOOR],
    focus: ['chest', 'upperArm'],
    bothArms: true,
    caption: 'Cuerpo recto como una tabla. Baja el pecho casi al suelo, codos a 45°.',
  },
  flexion_inclinada: {
    start: { hip: [81.5, 145], torso: -43.7, hand: [154, 146], elbowBend: -1, foot: [28, 196], kneeBend: 1 },
    end: { hip: [87.8, 152.4], torso: -36.1, hand: [154, 146], elbowBend: -1, foot: [28, 196], kneeBend: 1 },
    props: [FLOOR, { kind: 'bench', x: 142, y: 150, w: 50, h: 50 }],
    focus: ['chest', 'upperArm'],
    bothArms: true,
    caption: 'Manos en una silla estable. Baja hasta tocar el borde con el pecho.',
  },
  flexion_pica: {
    start: { hip: [81, 125], torso: 44, hand: [158, 196], elbowBend: -1, foot: [56, 196], kneeBend: 1 },
    end: { hip: [94, 134], torso: 62, hand: [158, 196], elbowBend: -1, foot: [56, 196], kneeBend: 1 },
    props: [FLOOR],
    focus: ['shoulder', 'upperArm'],
    bothArms: true,
    caption: 'Cadera arriba en V invertida. Baja la cabeza hacia el suelo, delante de las manos.',
  },
  press_militar_una_mano: press,
  pajaros: {
    // Vista frontal: los brazos se abren hacia los lados.
    start: { ...standing, hand: [0, 0], elbowBend: 1 },
    end: { ...standing, hand: [0, 0], elbowBend: 1 },
    props: [FLOOR],
    focus: ['shoulder', 'upperArm'],
    held: 'dumbbell',
    front: { from: 84, to: 10 },
    caption: 'Inclinado hacia delante, abre los brazos hacia los lados hasta la altura del hombro.',
  },

  // ---------- Alternativas de viaje ----------

  // ---------- Tren inferior ----------
  elevacion_tibial: {
    start: { hip: [74, 130], torso: -100, hand: [84, 132], elbowBend: 1, foot: [104, 198], kneeBend: -1, footAngle: 0 },
    end: { hip: [74, 130], torso: -100, hand: [84, 132], elbowBend: 1, foot: [104, 198], kneeBend: -1, footAngle: -38 },
    props: [FLOOR, { kind: 'wall', x: 46 }],
    focus: ['shin'],
    caption: 'Espalda en la pared y pies adelantados. Sube las puntas todo lo que puedas y baja lento.',
  },
  elevacion_talones: {
    start: { hip: [100, 127], torso: -90, hand: [146, 96], elbowBend: 1, foot: [98, 198], kneeBend: -1, footAngle: 0, farFoot: [84, 172], farKneeBend: -1 },
    end: { hip: [100, 117], torso: -90, hand: [146, 88], elbowBend: 1, foot: [98, 188], kneeBend: -1, footAngle: 42, farFoot: [84, 162], farKneeBend: -1 },
    props: [FLOOR, { kind: 'wall', x: 150 }],
    focus: ['shin'],
    caption: 'A una pierna, con una mano en la pared. Sube al máximo sobre la punta y baja en 3 segundos.',
  },
  fondos_silla: {
    start: { hip: [104, 161], torso: -96, hand: [96, 163], elbowBend: -1, foot: [168, 196], kneeBend: -1 },
    end: { hip: [104, 183], torso: -96, hand: [96, 163], elbowBend: -1, foot: [168, 196], kneeBend: -1 },
    props: [FLOOR, SEAT],
    focus: ['upperArm'],
    bothArms: true,
    caption: 'Manos en el borde de la silla. Baja doblando los codos hacia atrás hasta 90° y sube.',
  },
  // ---------- Abdomen ----------
  hollow: {
    start: { hip: [96, 188], torso: -179, hand: [98, 184], elbowBend: 1, foot: [169, 188], kneeBend: -1 },
    end: { hip: [96, 188], torso: -166, hand: [96, 168], elbowBend: 1, foot: [164, 166], kneeBend: -1 },
    props: [FLOOR],
    focus: ['abs'],
    bothArms: true,
    caption: 'Boca arriba, despega hombros y piernas con la zona lumbar pegada al suelo, y aguanta.',
  },
  dead_bug: {
    start: { hip: [96, 188], torso: -179, hand: [50, 136], elbowBend: 1, foot: [134, 152], kneeBend: -1, farHand: [50, 136], farFoot: [134, 152] },
    end: { hip: [96, 188], torso: -179, hand: [50, 136], elbowBend: 1, foot: [166, 178], kneeBend: -1, farHand: [8, 172], farFoot: [134, 152] },
    props: [FLOOR],
    focus: ['abs'],
    caption: 'Estira una pierna y lleva atrás el brazo contrario, sin despegar la zona lumbar. Alterna.',
  },
  rodillas_colgado: {
    start: pullUp.start,
    end: { ...pullUp.start, foot: [138, 138] },
    props: [FLOOR, BAR],
    focus: ['abs', 'forearm'],
    bothArms: true,
    caption: 'Colgado, sube las rodillas al pecho enrollando la pelvis. Baja lento y sin balanceo.',
  },
  plancha_copenhague: {
    start: { hip: [109, 174], torso: 176, hand: [84, 196], elbowBend: -1, foot: [176, 146], kneeBend: -1, farFoot: [168, 172] },
    end: { hip: [109, 160], torso: 168.5, hand: [84, 196], elbowBend: -1, foot: [176, 146], kneeBend: -1, farFoot: [172, 158] },
    props: [FLOOR, { kind: 'bench', x: 150, y: 152, w: 44, h: 48 }],
    focus: ['thigh'],
    caption: 'De lado, antebrazo en el suelo y el pie de arriba sobre una silla. Sube la cadera y aguanta.',
  },
  abduccion_cadera: {
    start: { hip: [110, 186], torso: 180, hand: [70, 196], elbowBend: -1, foot: [182, 184], kneeBend: -1, farFoot: [182, 192] },
    end: { hip: [110, 186], torso: 180, hand: [70, 196], elbowBend: -1, foot: [172, 146], kneeBend: -1, farFoot: [182, 192] },
    props: [FLOOR],
    focus: ['glute', 'thigh'],
    caption: 'Tumbado de lado, sube la pierna de arriba recta y un poco hacia atrás. Sin girar la cadera.',
  },
  zancada_estatica: {
    start: { hip: [94, 128], torso: -90, hand: [100, 130], elbowBend: 1, foot: [122, 198], kneeBend: -1, footAngle: 0, farFoot: [56, 194], farKneeBend: 1 },
    end: { hip: [94, 152], torso: -90, hand: [100, 154], elbowBend: 1, foot: [122, 198], kneeBend: -1, footAngle: 0, farFoot: [56, 194], farKneeBend: 1 },
    props: [FLOOR],
    focus: ['thigh', 'glute'],
    caption: 'Un pie delante y otro detrás. Baja recto hasta que la rodilla de atrás casi toque el suelo.',
  },
  peso_muerto_una_pierna: {
    start: { hip: [100, 126], torso: -90, hand: [104, 128], elbowBend: 1, foot: [98, 198], kneeBend: -1, footAngle: 0, farFoot: [106, 198] },
    end: { hip: [94, 124], torso: -14, hand: [146, 164], elbowBend: 1, foot: [98, 198], kneeBend: -1, footAngle: 0, farFoot: [30, 122] },
    props: [FLOOR],
    focus: ['thigh', 'glute'],
    caption: 'Sobre una pierna, inclina el tronco y lleva la otra pierna atrás en línea. Espalda recta.',
  },

  // ---------- Estiramientos ----------
  // Posturas mantenidas: el movimiento es mínimo, solo para dar vida al dibujo.
  est_mariposa: {
    start: { hip: [84, 184], torso: -86, hand: [112, 178], elbowBend: 1, foot: [118, 192], kneeBend: -1, footAngle: -20 },
    end: { hip: [84, 184], torso: -78, hand: [114, 180], elbowBend: 1, foot: [118, 192], kneeBend: -1, footAngle: -20 },
    props: [FLOOR],
    focus: ['thigh'],
    bothArms: true,
    caption: 'Sentado, plantas de los pies juntas. Espalda larga y deja caer las rodillas por su peso.',
  },
  est_rana: {
    start: { hip: [88, 148], torso: 16, hand: [164, 194], elbowBend: -1, foot: [54, 194], kneeBend: 1, footAngle: 180 },
    end: { hip: [80, 150], torso: 20, hand: [164, 194], elbowBend: -1, foot: [54, 194], kneeBend: 1, footAngle: 180 },
    props: [FLOOR],
    focus: ['thigh'],
    bothArms: true,
    caption: 'En cuadrupedia, rodillas muy separadas. Lleva la cadera hacia atrás sin hundir la zona lumbar.',
  },
  est_cosaco: {
    start: { hip: [116, 158], torso: -76, hand: [138, 160], elbowBend: 1, foot: [130, 198], kneeBend: -1, footAngle: 0, farFoot: [44, 196], farKneeBend: 1 },
    end: { hip: [118, 164], torso: -74, hand: [140, 166], elbowBend: 1, foot: [130, 198], kneeBend: -1, footAngle: 0, farFoot: [44, 196], farKneeBend: 1 },
    props: [FLOOR],
    focus: ['thigh'],
    bothArms: true,
    caption: 'Baja sobre una pierna y deja la otra estirada con el pie apoyado. Cadera atrás.',
  },
  est_figura4: {
    start: { hip: [120, 186], torso: 180, hand: [116, 166], elbowBend: 1, foot: [104, 148], kneeBend: -1, farFoot: [150, 172], farKneeBend: -1 },
    end: { hip: [120, 186], torso: 180, hand: [114, 164], elbowBend: 1, foot: [100, 146], kneeBend: -1, farFoot: [146, 170], farKneeBend: -1 },
    props: [FLOOR],
    focus: ['glute'],
    bothArms: true,
    caption: 'Boca arriba, tobillo sobre la rodilla contraria. Tira del muslo hacia el pecho.',
  },
  est_tfl: {
    start: { hip: [106, 126], torso: -98, hand: [146, 92], elbowBend: 1, foot: [92, 198], kneeBend: -1, footAngle: 0, farFoot: [112, 198] },
    end: { hip: [112, 126], torso: -102, hand: [146, 92], elbowBend: 1, foot: [92, 198], kneeBend: -1, footAngle: 0, farFoot: [112, 198] },
    props: [FLOOR, { kind: 'wall', x: 150 }],
    focus: ['glute'],
    caption: 'De lado a la pared, cruza por detrás la pierna de fuera y lleva la cadera hacia la pared.',
  },
  est_zancada: {
    start: { hip: [98, 162], torso: -90, hand: [126, 154], elbowBend: 1, foot: [50, 194], kneeBend: -1, footAngle: 180, farFoot: [138, 198], farKneeBend: -1 },
    end: { hip: [104, 164], torso: -92, hand: [130, 156], elbowBend: 1, foot: [50, 194], kneeBend: -1, footAngle: 180, farFoot: [138, 198], farKneeBend: -1 },
    props: [FLOOR],
    focus: ['thigh'],
    bothArms: true,
    caption: 'Rodilla de atrás en el suelo. Aprieta el glúteo y lleva la cadera hacia delante sin arquear la espalda.',
  },
  est_isquios: {
    start: { hip: [116, 186], torso: 180, hand: [104, 156], elbowBend: 1, foot: [122, 114], kneeBend: 1, farFoot: [188, 190] },
    end: { hip: [116, 186], torso: 180, hand: [102, 154], elbowBend: 1, foot: [114, 114], kneeBend: 1, farFoot: [188, 190] },
    props: [FLOOR],
    focus: ['thigh'],
    bothArms: true,
    caption: 'Boca arriba, sube una pierna recta sujetándola por detrás del muslo. La otra, estirada en el suelo.',
  },
  est_cuadriceps: {
    start: { hip: [104, 186], torso: 180, hand: [96, 172], elbowBend: 1, foot: [124, 166], kneeBend: 1, farFoot: [176, 192] },
    end: { hip: [104, 186], torso: 180, hand: [98, 170], elbowBend: 1, foot: [120, 164], kneeBend: 1, farFoot: [176, 192] },
    props: [FLOOR],
    focus: ['thigh'],
    caption: 'Tumbado de lado, lleva el talón de arriba al glúteo y la rodilla un poco hacia atrás.',
  },
  est_gemelo: {
    start: { hip: [98, 132], torso: -72, hand: [154, 92], elbowBend: 1, foot: [54, 198], kneeBend: 1, footAngle: 0, farFoot: [126, 198], farKneeBend: -1 },
    end: { hip: [104, 134], torso: -70, hand: [154, 94], elbowBend: 1, foot: [54, 198], kneeBend: 1, footAngle: 0, farFoot: [126, 198], farKneeBend: -1 },
    props: [FLOOR, { kind: 'wall', x: 158 }],
    focus: ['shin'],
    bothArms: true,
    caption: 'Manos en la pared, una pierna atrás estirada con el talón pegado al suelo y el pie recto.',
  },

  // ---------- Estiramientos de tren superior ----------
  est_dorsal: {
    start: { hip: [64, 132], torso: -18, hand: [156, 124], elbowBend: 1, foot: [86, 198], kneeBend: -1, footAngle: 0 },
    end: { hip: [58, 134], torso: -14, hand: [156, 124], elbowBend: 1, foot: [86, 198], kneeBend: -1, footAngle: 0 },
    props: [FLOOR, { kind: 'wall', x: 160 }],
    focus: ['back'],
    bothArms: true,
    caption: 'Agarra el marco a la altura de la cadera y lleva la cadera hacia atrás, con los brazos estirados.',
  },
  est_biceps: {
    start: { ...standing, hip: [106, 126], hand: [54, 84], elbowBend: 1 },
    end: { ...standing, hip: [108, 126], hand: [54, 84], elbowBend: 1 },
    props: [FLOOR, { kind: 'wall', x: 40 }],
    focus: ['upperArm'],
    caption: 'Palma en la pared con el brazo estirado hacia atrás. Gira el cuerpo alejándote de la mano.',
  },
  est_pectoral: {
    start: { ...standing, hip: [104, 126], hand: [76, 52], elbowBend: -1 },
    end: { ...standing, hip: [110, 126], foot: [106, 198], hand: [76, 52], elbowBend: -1 },
    props: [FLOOR, { kind: 'wall', x: 60 }],
    focus: ['chest'],
    caption: 'Antebrazo en el marco con el codo a la altura del hombro. Da un paso adelante con el pecho al frente.',
  },
  est_flexores: {
    start: { ...standing, hand: [150, 82], elbowBend: 1, wrist: 25, farHand: [154, 92] },
    end: { ...standing, hand: [150, 82], elbowBend: 1, wrist: 75, farHand: [152, 96] },
    props: [FLOOR],
    focus: ['forearm'],
    caption: 'Brazo estirado al frente con la palma hacia arriba. Con la otra mano, tira de los dedos hacia abajo.',
  },
  est_extensores: {
    start: { ...standing, hand: [150, 82], elbowBend: 1, wrist: 35, farHand: [154, 94] },
    end: { ...standing, hand: [150, 82], elbowBend: 1, wrist: 95, farHand: [150, 98] },
    props: [FLOOR],
    focus: ['forearm'],
    caption: 'Brazo estirado al frente con la palma hacia abajo. Con la otra mano, dobla la muñeca hacia ti.',
  },
  est_triceps: {
    start: { ...standing, hand: [92, 74], elbowBend: 1, farHand: [106, 54] },
    end: { ...standing, hand: [90, 80], elbowBend: 1, farHand: [102, 52] },
    props: [FLOOR],
    focus: ['upperArm'],
    caption: 'Codo hacia el techo y mano entre los omóplatos. Empuja el codo con la otra mano.',
  },
  est_hombro: {
    start: { hip: [94, 186], torso: -125, hand: [36, 190], elbowBend: 1, foot: [158, 194], kneeBend: -1 },
    end: { hip: [100, 186], torso: -125, hand: [36, 190], elbowBend: 1, foot: [162, 194], kneeBend: -1 },
    props: [FLOOR],
    focus: ['shoulder'],
    bothArms: true,
    caption: 'Sentado en el suelo, manos apoyadas detrás. Desliza la cadera hacia delante y abre el pecho.',
  },
  est_muneca_suelo: {
    start: { hip: [72, 154], torso: -13.8, hand: [122, 194], elbowBend: 1, foot: [38, 194], kneeBend: -1, wrist: 180 },
    end: { hip: [64, 156], torso: -11, hand: [122, 194], elbowBend: 1, foot: [38, 194], kneeBend: -1, wrist: 180 },
    props: [FLOOR],
    focus: ['forearm'],
    bothArms: true,
    caption: 'A cuatro patas con los dedos apuntando a las rodillas. Lleva el peso hacia atrás poco a poco.',
  },
  est_nino: {
    start: { hip: [76, 172], torso: 6, hand: [176, 192], elbowBend: -1, foot: [72, 194], kneeBend: -1, footAngle: 180 },
    end: { hip: [70, 176], torso: 8, hand: [172, 194], elbowBend: -1, foot: [70, 194], kneeBend: -1, footAngle: 180 },
    props: [FLOOR],
    focus: ['back'],
    bothArms: true,
    caption: 'Glúteos hacia los talones y brazos largos al frente. Respira hacia la espalda.',
  },
  est_brazo_cruzado: {
    start: { ...standing, hand: [0, 0], elbowBend: 1 },
    end: { ...standing, hand: [0, 0], elbowBend: 1 },
    props: [FLOOR],
    focus: ['shoulder', 'upperArm'],
    frontPose: {
      start: { left: [92, 104], right: [70, 96], tilt: 0, accent: 'right' },
      end: { left: [88, 98], right: [64, 90], tilt: 0, accent: 'right' },
    },
    caption: 'Cruza un brazo recto por delante del pecho y empújalo con la otra mano por encima del codo.',
  },
  est_trapecio: {
    start: { ...standing, hand: [0, 0], elbowBend: 1 },
    end: { ...standing, hand: [0, 0], elbowBend: 1 },
    props: [FLOOR],
    focus: ['back'],
    frontPose: {
      start: { left: [76, 138], right: [124, 136], tilt: -2, accent: 'right' },
      end: { left: [76, 138], right: [124, 140], tilt: -11, accent: 'right' },
    },
    caption: 'Lleva la oreja al hombro y deja caer el otro brazo hacia el suelo. Sin tirar de la cabeza.',
  },
};
