import type { Point } from './body';
import { weekStart, type ISODate } from './dates';
import type { SessionKind } from './schedule';

/**
 * Estiramientos estáticos: rutina corta tras cada sesión y rutina de tren inferior.
 * Dosis según docs/INVESTIGACION.md: 30 s por lado (60 s en aductores) y entre 5 y 10 minutos
 * por semana y zona; por encima de 10 no se gana más flexibilidad.
 */
export type Zone = 'aductores' | 'gluteo' | 'cadera' | 'isquios' | 'gemelo' | 'pecho' | 'espalda' | 'brazo';

export const ZONE_LABEL: Record<Zone, string> = {
  aductores: 'Aductores',
  gluteo: 'Glúteo y abductores',
  cadera: 'Flexores de cadera y cuádriceps',
  isquios: 'Isquiotibiales',
  gemelo: 'Gemelo',
  pecho: 'Pecho y hombro',
  espalda: 'Espalda',
  brazo: 'Brazo y antebrazo',
};

/** Tren inferior primero: es la prioridad. */
export const ZONE_ORDER: Zone[] = ['aductores', 'gluteo', 'cadera', 'isquios', 'gemelo', 'pecho', 'espalda', 'brazo'];

/** Minutos semanales por zona: mínimo útil y techo a partir del cual no hay más ganancia. */
export const WEEKLY_MINUTES = { min: 5, max: 10 } as const;

export interface Stretch {
  id: string;
  name: string;
  zone: Zone;
  /** Segundos que se mantiene (por lado, si es por lados). */
  seconds: number;
  perSide: boolean;
  cues: string[];
  mistake: string;
  /** Dibujo de `ILLUSTRATIONS`, si lo tiene. */
  figure?: string;
}

const s = (
  id: string,
  name: string,
  zone: Zone,
  seconds: number,
  perSide: boolean,
  cues: string[],
  mistake: string,
  figure?: string,
): Stretch => ({ id, name, zone, seconds, perSide, cues, mistake, figure });

export const STRETCHES: Record<string, Stretch> = Object.fromEntries(
  [
    // ---------- Tren superior ----------
    s('cuelgue_pasivo', 'Cuelgue pasivo en la barra', 'espalda', 30, false, ['Agarre con las palmas al frente', 'Hombros relajados, deja que el cuerpo cuelgue', 'Apoya las puntas de los pies si lo necesitas'], 'Balancearse', 'colgarse'),
    s('dorsal_marco', 'Dorsal en el marco de la puerta', 'espalda', 30, true, ['Agarra el marco a la altura de la cadera', 'Lleva la cadera atrás y hacia el lado contrario', 'Nota el estirón en el costado'], 'Redondear la zona lumbar', 'est_dorsal'),
    s('biceps_pared', 'Bíceps en la pared', 'brazo', 30, true, ['Palma en la pared con el brazo atrás y el pulgar arriba', 'Gira el tronco alejándote de la mano', 'Brazo estirado'], 'Encoger el hombro', 'est_biceps'),
    s('flexores_antebrazo', 'Flexores del antebrazo', 'brazo', 30, true, ['Brazo estirado al frente, palma hacia arriba', 'Con la otra mano, tira de los dedos hacia abajo', 'Codo recto'], 'Doblar el codo', 'est_flexores'),
    s('brazo_cruzado', 'Brazo cruzado', 'pecho', 30, true, ['Brazo recto cruzando el pecho', 'Empuja con la otra mano por encima del codo', 'Hombro abajo'], 'Girar el tronco', 'est_brazo_cruzado'),
    s('pectoral_marco', 'Pectoral en el marco de la puerta', 'pecho', 30, true, ['Codo a 90° apoyado en el marco', 'Da un paso adelante con el pecho al frente', 'Hombros lejos de las orejas'], 'Arquear la zona lumbar', 'est_pectoral'),
    s('triceps_nuca', 'Tríceps tras la nuca', 'brazo', 30, true, ['Codo hacia el techo, mano entre los omóplatos', 'Empuja el codo con la otra mano', 'Cabeza recta'], 'Adelantar la cabeza', 'est_triceps'),
    s('hombro_anterior', 'Hombro anterior con silla', 'pecho', 30, false, ['Sentado en el suelo, manos atrás sobre una silla o el suelo', 'Desliza la cadera hacia delante', 'Pecho abierto'], 'Subir los hombros a las orejas', 'est_hombro'),
    s('flexores_muneca_suelo', 'Muñecas en cuadrupedia', 'brazo', 30, false, ['A cuatro patas, dedos apuntando a las rodillas', 'Lleva el peso hacia atrás poco a poco', 'Palmas pegadas al suelo'], 'Levantar las palmas', 'est_muneca_suelo'),
    s('postura_nino', 'Postura del niño', 'espalda', 30, false, ['Glúteos hacia los talones', 'Brazos largos al frente', 'Respira hacia la espalda'], 'Forzar las rodillas', 'est_nino'),
    s('extensores_muneca', 'Extensores de la muñeca', 'brazo', 30, true, ['Brazo recto al frente, palma hacia abajo', 'Con la otra mano, dobla la muñeca hacia ti', 'Codo recto'], 'Doblar el codo', 'est_extensores'),
    s('trapecio', 'Trapecio y cuello', 'espalda', 30, true, ['Lleva la oreja al hombro', 'La mano contraria apunta al suelo', 'Sin tirar de la cabeza'], 'Tirar de la cabeza con la mano', 'est_trapecio'),

    // ---------- Tren inferior ----------
    s('mariposa', 'Mariposa', 'aductores', 60, false, ['Sentado, plantas de los pies juntas', 'Espalda larga, sin encorvarte', 'Deja caer las rodillas por su propio peso'], 'Rebotar con las rodillas', 'est_mariposa'),
    s('rana', 'Rana', 'aductores', 60, false, ['A cuatro patas, rodillas muy separadas', 'Lleva la cadera hacia atrás', 'Apóyate en los antebrazos'], 'Hundir la zona lumbar', 'est_rana'),
    s('cosaco', 'Zancada lateral (cosaco)', 'aductores', 30, true, ['Baja sobre una pierna, la otra estirada', 'Pie de la pierna estirada apoyado', 'Cadera atrás; apóyate con las manos si hace falta'], 'Meter hacia dentro la rodilla flexionada', 'est_cosaco'),
    s('figura4', 'Figura 4 tumbado', 'gluteo', 30, true, ['Boca arriba, tobillo sobre la rodilla contraria', 'Tira del muslo hacia el pecho', 'Sacro pegado al suelo'], 'Despegar la cadera del suelo', 'est_figura4'),
    s('tfl_pared', 'Cadera lateral en la pared', 'gluteo', 30, true, ['De lado a la pared, cruza por detrás la pierna de fuera', 'Lleva la cadera hacia la pared', 'Tronco recto'], 'Inclinarte hacia delante', 'est_tfl'),
    s('zancada_rodilla', 'Zancada con la rodilla en el suelo', 'cadera', 60, true, ['Rodilla de atrás en el suelo', 'Aprieta el glúteo de esa pierna', 'Lleva la cadera hacia delante'], 'Arquear la zona lumbar', 'est_zancada'),
    s('isquios_tumbado', 'Isquios tumbado', 'isquios', 45, true, ['Boca arriba, sube una pierna recta', 'Sujétala por detrás del muslo', 'La otra pierna, estirada en el suelo'], 'Despegar la cadera', 'est_isquios'),
    s('cuadriceps_lado', 'Cuádriceps tumbado de lado', 'cadera', 30, true, ['De lado, lleva el talón de arriba al glúteo', 'Rodilla un poco hacia atrás', 'Pelvis quieta'], 'Abrir la rodilla hacia arriba', 'est_cuadriceps'),
    s('gemelo_pared', 'Gemelo en la pared', 'gemelo', 30, true, ['Manos en la pared, una pierna atrás estirada', 'Talón pegado al suelo y pie recto', 'Dobla un poco esa rodilla para notar el sóleo'], 'Girar el pie hacia fuera', 'est_gemelo'),
  ].map((x) => [x.id, x]),
);

export type RoutineId = 'postA' | 'postB' | 'postC' | 'inferior';

export interface Routine {
  id: RoutineId;
  title: string;
  subtitle: string;
  stretchIds: string[];
}

export const ROUTINES: Record<RoutineId, Routine> = {
  postA: {
    id: 'postA',
    title: 'Después de Tirón',
    subtitle: 'Espalda, bíceps, antebrazo y gemelo',
    stretchIds: ['cuelgue_pasivo', 'dorsal_marco', 'biceps_pared', 'flexores_antebrazo', 'brazo_cruzado', 'gemelo_pared'],
  },
  postB: {
    id: 'postB',
    title: 'Después de Empuje',
    subtitle: 'Pecho, hombro, tríceps y aductores',
    stretchIds: ['pectoral_marco', 'triceps_nuca', 'hombro_anterior', 'flexores_muneca_suelo', 'postura_nino', 'mariposa'],
  },
  postC: {
    id: 'postC',
    title: 'Después de Mixta',
    subtitle: 'Dorsal, hombro, cuello e isquios',
    stretchIds: ['dorsal_marco', 'triceps_nuca', 'brazo_cruzado', 'extensores_muneca', 'trapecio', 'isquios_tumbado'],
  },
  inferior: {
    id: 'inferior',
    title: 'Tren inferior',
    subtitle: 'Aductores, cadera, isquios y gemelo',
    stretchIds: ['mariposa', 'rana', 'cosaco', 'figura4', 'tfl_pared', 'zancada_rodilla', 'isquios_tumbado', 'cuadriceps_lado', 'gemelo_pared'],
  },
};

export const ROUTINE_ORDER: RoutineId[] = ['inferior', 'postA', 'postB', 'postC'];

export function routineAfter(kind: SessionKind): RoutineId {
  return kind === 'A' ? 'postA' : kind === 'B' ? 'postB' : 'postC';
}

export interface Step {
  stretchId: string;
  /** 1 o 2 si el estiramiento es por lados; `null` si no. */
  side: 1 | 2 | null;
  seconds: number;
}

/** Pasos de una rutina, con los estiramientos por lados desdoblados. */
export function routineSteps(r: Routine): Step[] {
  return r.stretchIds.flatMap((id): Step[] => {
    const st = STRETCHES[id];
    return st.perSide
      ? [
          { stretchId: id, side: 1, seconds: st.seconds },
          { stretchId: id, side: 2, seconds: st.seconds },
        ]
      : [{ stretchId: id, side: null, seconds: st.seconds }];
  });
}

/** Segundos de estiramiento de una rutina, sin contar los cambios de postura. */
export function routineSeconds(r: Routine): number {
  return routineSteps(r).reduce((a, x) => a + x.seconds, 0);
}

/** Pausa para colocarse antes de cada paso. */
export const PREP_SECONDS = 5;

export function routineMinutes(r: Routine): number {
  const steps = routineSteps(r);
  return Math.round((steps.reduce((a, x) => a + x.seconds, 0) + steps.length * PREP_SECONDS) / 60);
}

export interface StretchEntry {
  date: ISODate;
  stretchId: string;
  seconds: number;
}

const emptyZones = (): Record<Zone, number> => ({ aductores: 0, gluteo: 0, cadera: 0, isquios: 0, gemelo: 0, pecho: 0, espalda: 0, brazo: 0 });

/** Minutos estirados por zona. */
export function minutesByZone(entries: readonly StretchEntry[]): Record<Zone, number> {
  const out = emptyZones();
  for (const e of entries) {
    const st = STRETCHES[e.stretchId];
    if (st) out[st.zone] += e.seconds / 60;
  }
  for (const z of ZONE_ORDER) out[z] = Math.round(out[z] * 10) / 10;
  return out;
}

export function zoneVerdict(minutes: number): { label: string; tone: 'low' | 'good' | 'warn' } {
  if (minutes < WEEKLY_MINUTES.min) return { label: minutes === 0 ? 'Sin estirar' : 'Poco', tone: 'low' };
  if (minutes <= WEEKLY_MINUTES.max) return { label: 'En su punto', tone: 'good' };
  return { label: 'Más no aporta', tone: 'warn' };
}

/** Minutos totales y días con estiramiento de cada semana (lunes), en orden. */
export function weeklyStretching(entries: readonly StretchEntry[]): { minutes: Point[]; days: Point[] } {
  const byWeek = new Map<ISODate, { seconds: number; days: Set<ISODate> }>();
  for (const e of entries) {
    const k = weekStart(e.date);
    const cur = byWeek.get(k) ?? { seconds: 0, days: new Set<ISODate>() };
    cur.seconds += e.seconds;
    cur.days.add(e.date);
    byWeek.set(k, cur);
  }
  const weeks = [...byWeek.keys()].sort();
  return {
    minutes: weeks.map((d) => ({ date: d, value: Math.round((byWeek.get(d)!.seconds / 60) * 10) / 10 })),
    days: weeks.map((d) => ({ date: d, value: byWeek.get(d)!.days.size })),
  };
}
