import type { Illustration, Prop } from './skeleton';

/**
 * Dibujos de cada ejercicio (vista lateral, mirando a la derecha). Lienzo 200 × 210, suelo en y = 200.
 * Las posturas se calcularon para que los segmentos tengan longitudes reales.
 */

const FLOOR: Prop = { kind: 'floor', y: 200 };
const BAR: Prop = { kind: 'bar', x: 110, y: 20 };
const BENCH_LOW: Prop = { kind: 'box', x: 36, y: 150, w: 64, h: 50 };

const pullUp: Illustration = {
  start: { hip: [106, 124], torso: -90, hand: [110, 20], elbowBend: 1, foot: [100, 192], kneeBend: -1 },
  end: { hip: [96, 82], torso: -90, hand: [110, 20], elbowBend: 1, foot: [90, 150], kneeBend: -1 },
  props: [BAR],
  caption: 'Desde brazos estirados hasta pasar la barbilla de la barra.',
};

const standing = { hip: [100, 126] as const, torso: -90, foot: [100, 198] as const, kneeBend: -1 as const };

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
    end: { ...pullUp.start, hip: [108, 124], foot: [103, 192] },
    caption: 'Cuélgate con los brazos estirados y aguanta el tiempo marcado.',
  },
  remo_mancuerna: {
    start: { hip: [78, 128], torso: -12, hand: [128, 170], elbowBend: 1, foot: [70, 198], kneeBend: -1, farHand: [150, 140] },
    end: { hip: [78, 128], torso: -12, hand: [110, 128], elbowBend: 1, foot: [70, 198], kneeBend: -1, farHand: [150, 140] },
    props: [FLOOR, { kind: 'box', x: 128, y: 140, w: 62, h: 60 }],
    dumbbell: true,
    caption: 'Apoyado en la silla, tira del codo hacia la cadera y baja estirando.',
  },
  curl_concentrado: {
    start: { hip: [78, 146], torso: -55, hand: [112, 158], elbowBend: 1, foot: [130, 198], kneeBend: -1 },
    end: { hip: [78, 146], torso: -55, hand: [118, 112], elbowBend: 1, foot: [130, 198], kneeBend: -1 },
    props: [FLOOR, BENCH_LOW],
    dumbbell: true,
    caption: 'Sentado, codo apoyado en el muslo. Sube y aprieta el bíceps arriba.',
  },
  curl_martillo: {
    start: { ...standing, hand: [104, 128], elbowBend: 1 },
    end: { ...standing, hand: [116, 84], elbowBend: 1 },
    props: [FLOOR],
    dumbbell: true,
    caption: 'Pulgar hacia arriba y codo pegado al cuerpo. Sube sin balancearte.',
  },
  curl_muneca: {
    start: { hip: [76, 146], torso: -65, hand: [126, 140], elbowBend: 1, foot: [128, 198], kneeBend: -1, wrist: 50 },
    end: { hip: [76, 146], torso: -65, hand: [126, 140], elbowBend: 1, foot: [128, 198], kneeBend: -1, wrist: -40 },
    props: [FLOOR, BENCH_LOW],
    dumbbell: true,
    caption: 'Antebrazo apoyado en el muslo, palma arriba. Solo se mueve la muñeca.',
  },
  curl_muneca_inverso: {
    start: { hip: [76, 146], torso: -65, hand: [126, 140], elbowBend: 1, foot: [128, 198], kneeBend: -1, wrist: 50 },
    end: { hip: [76, 146], torso: -65, hand: [126, 140], elbowBend: 1, foot: [128, 198], kneeBend: -1, wrist: -30 },
    props: [FLOOR, BENCH_LOW],
    dumbbell: true,
    caption: 'Igual que el curl de muñeca, pero con la palma hacia abajo.',
  },
  flexion_estricta: {
    start: { hip: [93.4, 167.6], torso: -24.3, hand: [140, 198], elbowBend: 1, foot: [26, 198], kneeBend: 1 },
    end: { hip: [99.5, 189.6], torso: -6.5, hand: [140, 198], elbowBend: 1, foot: [26, 198], kneeBend: 1 },
    props: [FLOOR],
    caption: 'Cuerpo recto como una tabla. Baja el pecho casi al suelo, codos a 45°.',
  },
  flexion_inclinada: {
    start: { hip: [81.5, 147], torso: -43.7, hand: [154, 150], elbowBend: -1, foot: [28, 198], kneeBend: 1 },
    end: { hip: [87.8, 154.4], torso: -36.1, hand: [154, 150], elbowBend: -1, foot: [28, 198], kneeBend: 1 },
    props: [FLOOR, { kind: 'box', x: 140, y: 150, w: 56, h: 50 }],
    caption: 'Manos en una silla estable. Baja hasta tocar el borde con el pecho.',
  },
  flexion_pica: {
    start: { hip: [81, 127], torso: 44, hand: [158, 198], elbowBend: -1, foot: [56, 198], kneeBend: 1 },
    end: { hip: [94, 136], torso: 62, hand: [158, 198], elbowBend: -1, foot: [56, 198], kneeBend: 1 },
    props: [FLOOR],
    caption: 'Cadera arriba en V invertida. Baja la cabeza hacia el suelo, delante de las manos.',
  },
  press_militar_una_mano: {
    start: { ...standing, hand: [110, 72], elbowBend: 1 },
    end: { ...standing, hand: [101, 24], elbowBend: 1 },
    props: [FLOOR],
    dumbbell: true,
    caption: 'Desde el hombro, empuja vertical hasta estirar. Sin arquear la espalda.',
  },
  pajaros: {
    // Vista frontal: los brazos se abren hacia los lados.
    start: { ...standing, hand: [0, 0], elbowBend: 1 },
    end: { ...standing, hand: [0, 0], elbowBend: 1 },
    props: [FLOOR],
    dumbbell: true,
    front: { from: 84, to: 10 },
    caption: 'Inclinado hacia delante, abre los brazos hacia los lados hasta la altura del hombro.',
  },
};
