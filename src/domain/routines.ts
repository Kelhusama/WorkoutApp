import { estimateMinutes, type TimedExercise } from './guide';

/**
 * Tres rutinas para la misma sesión, para elegir según el tiempo y el cansancio:
 * - corta: lo esencial, con menos series y sin apurar. No mueve el plan.
 * - media: lo esencial con todas sus series, en 20 minutos como mucho.
 * - larga: todo, con pierna y accesorios.
 * El entrenador apunta lo que se haga en cualquiera de las tres; solo la corta deja el plan como estaba.
 */
export type RoutineSize = 'corta' | 'media' | 'larga';

export const ROUTINE_CAP: Record<Exclude<RoutineSize, 'larga'>, number> = { corta: 10, media: 20 };

export const ROUTINE_INFO: Record<RoutineSize, { title: string; detail: string }> = {
  corta: { title: 'Corta', detail: 'Lo esencial, con menos series y dejando 2 o 3 repeticiones sin hacer. Para días de cansancio: el plan no cambia.' },
  media: { title: 'Media', detail: 'Lo esencial con todas sus series. Según salga, el entrenador sube, mantiene o baja.' },
  larga: { title: 'Larga', detail: 'Todo: lo esencial más pierna y accesorios. Según salga, el entrenador sube, mantiene o baja.' },
};

export interface RoutineItem {
  key: string;
  /** Importancia: 0 es lo primero que no se puede quitar. */
  rank: number;
  /** Lo que se tarda en hacerlo entero y en versión ligera. */
  full: TimedExercise;
  light: TimedExercise;
}

export interface Routine {
  size: RoutineSize;
  /** Ejercicios que entran, en el orden de la sesión. */
  keys: string[];
  minutes: number;
  /** Versión ligera: menos series y descansos cortos. */
  light: boolean;
}

/** Mínimo de ejercicios de una rutina, aunque no quepan en el tiempo. */
const MIN_EXERCISES = 2;

function pick(items: readonly RoutineItem[], cap: number, light: boolean): Routine['keys'] {
  const timed = (i: RoutineItem) => (light ? i.light : i.full);
  const chosen: RoutineItem[] = [];
  for (const item of [...items].sort((a, b) => a.rank - b.rank)) {
    // Se respeta el orden de importancia: lo que no cabe se salta y se prueba con lo siguiente.
    if (chosen.length < MIN_EXERCISES || estimateMinutes([...chosen, item].map(timed)) <= cap) chosen.push(item);
  }
  const keep = new Set(chosen.map((c) => c.key));
  return items.filter((i) => keep.has(i.key)).map((i) => i.key);
}

/**
 * Las rutinas posibles para una sesión. Si todo cabe en 20 minutos no hay «larga»,
 * y si la corta sale igual de larga que la media tampoco se ofrece.
 */
export function buildRoutines(items: readonly RoutineItem[]): Routine[] {
  const minutes = (keys: readonly string[], light: boolean) => estimateMinutes(items.filter((i) => keys.includes(i.key)).map((i) => (light ? i.light : i.full)));
  const all = items.map((i) => i.key);
  const cortaKeys = pick(items, ROUTINE_CAP.corta, true);
  const mediaKeys = pick(items, ROUTINE_CAP.media, false);
  const out: Routine[] = [
    { size: 'corta', keys: cortaKeys, minutes: minutes(cortaKeys, true), light: true },
    { size: 'media', keys: mediaKeys, minutes: minutes(mediaKeys, false), light: false },
  ];
  if (mediaKeys.length < all.length) out.push({ size: 'larga', keys: all, minutes: minutes(all, false), light: false });
  return out;
}

/**
 * Orden de importancia de los ejercicios de una sesión. Los dos primeros (`fixed`) son siempre los mismos;
 * los demás rotan cada semana, para que la pierna y los accesorios vayan entrando por turnos en la rutina media.
 */
export function rankKeys(priority: readonly string[], week: number, fixed = 2): string[] {
  const head = priority.slice(0, fixed);
  const tail = priority.slice(fixed);
  if (tail.length === 0) return head;
  const o = ((week % tail.length) + tail.length) % tail.length;
  return [...head, ...tail.slice(o), ...tail.slice(0, o)];
}
