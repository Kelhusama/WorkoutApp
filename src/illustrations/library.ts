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
  remo_invertido: {
    start: { hip: [110, 185], torso: 186, hand: [66, 128], elbowBend: 1, foot: [172, 196], kneeBend: -1 },
    end: { hip: [112, 166], torso: 207, hand: [66, 128], elbowBend: 1, foot: [172, 196], kneeBend: -1 },
    props: [FLOOR, { kind: 'bench', x: 34, y: 120, w: 150, h: 80 }],
    focus: ['back', 'upperArm'],
    bothArms: true,
    caption: 'Bajo una mesa robusta, cuerpo recto y talones en el suelo. Lleva el pecho al borde.',
  },
  remo_toalla: {
    start: { hip: [112, 140], torso: -112, hand: [146, 96], elbowBend: 1, foot: [150, 196], kneeBend: -1 },
    end: { hip: [124, 134], torso: -100, hand: [150, 97], elbowBend: 1, foot: [150, 196], kneeBend: -1 },
    props: [FLOOR, { kind: 'door', x: 186, knobY: 100 }],
    focus: ['back', 'upperArm'],
    bothArms: true,
    towelTo: [183, 100],
    caption: 'Toalla en el pomo de una puerta cerrada. Inclínate atrás y tira del pecho hacia la puerta.',
  },
  remo_mochila: { ...row, held: 'backpack', caption: 'Como el remo con mancuerna, pero con la mochila cargada.' },
  curl_mochila: { ...curl, held: 'backpack', caption: 'Coge la mochila por el asa y haz el curl sin balancearte.' },
  press_mochila: { ...press, held: 'backpack', caption: 'Empuja la mochila desde el hombro hasta estirar el brazo.' },
  curl_isometrico_toalla: {
    start: { ...standing, hand: [124, 106], elbowBend: 1 },
    end: { ...standing, hand: [124, 102], elbowBend: 1 },
    props: [FLOOR],
    focus: ['upperArm', 'forearm'],
    towelTo: 'foot',
    caption: 'Pisa la toalla y tira hacia arriba con el codo a 90°. Aprieta fuerte y aguanta.',
  },
  agarre_toalla: {
    start: { ...standing, hand: [126, 96], elbowBend: 1, farHand: [128, 112] },
    end: { ...standing, hand: [129, 99], elbowBend: 1, farHand: [125, 109] },
    props: [FLOOR],
    focus: ['forearm'],
    bothArms: true,
    towelTo: 'farHand',
    caption: 'Retuerce una toalla con todas tus fuerzas, como si la escurrieras, y aguanta.',
  },
  elevaciones_yt: {
    start: { hip: [84, 189], torso: -3, hand: [187, 192], elbowBend: -1, foot: [11, 193], kneeBend: 1 },
    end: { hip: [84, 189], torso: -9, hand: [178, 150], elbowBend: -1, foot: [11, 193], kneeBend: 1 },
    props: [FLOOR],
    focus: ['shoulder', 'back'],
    bothArms: true,
    caption: 'Boca abajo, levanta los brazos estirados formando una Y. Pausa arriba.',
  },

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
};
