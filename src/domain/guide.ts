/**
 * Orden de una sesión guiada y cuánto dura.
 *
 * Normalmente se hace un ejercicio entero y luego el siguiente. En una superserie se alternan dos
 * ejercicios que no trabajan los mismos músculos: mientras descansa uno, trabaja el otro. Así cada
 * músculo descansa lo mismo que haciéndolos por separado, pero la sesión dura bastante menos.
 */

/** Lo que hace falta saber de un ejercicio para ordenarlo y estimar cuánto se tarda. */
export interface TimedExercise {
  sets: number;
  /** Repeticiones, o segundos si el ejercicio es por tiempo. */
  amount: number;
  byTime: boolean;
  /** Se hace un lado cada vez: cada serie cuenta doble. */
  perSide: boolean;
  /** Descanso entre series cuando se hace por separado, en segundos. */
  rest: number;
}

export interface PlanStep {
  /** Posición del ejercicio en la sesión. */
  slot: number;
  /** Posición de la serie dentro del ejercicio. */
  set: number;
  /** Descanso después de esta serie, en segundos. */
  rest: number;
  /** Ejercicio con el que se alterna, si va en superserie. */
  partner?: number;
}

/** Descansos dentro de una superserie: lo justo para cambiar de ejercicio, y algo más al cerrar la vuelta. */
export const PAIR_REST = { inner: 20, outer: 40 } as const;

/** Tope de una sesión de casa: más larga no se hace con constancia. */
export const MAX_SESSION_MINUTES = 20;

const SECONDS_PER_REP = 3;
/** Colocarse y cambiar de ejercicio. */
const SETUP_SECONDS = 20;

export type Pair = readonly [number, number];

/**
 * Todas las series de la sesión, en el orden en que se hacen. `pairs` son las parejas de ejercicios
 * (por posición) que se alternan. Los ejercicios sin series se saltan.
 */
export function guidePlan(items: readonly { sets: number; rest: number }[], pairs: readonly Pair[] = []): PlanStep[] {
  const partner = new Map<number, number>();
  for (const [a, b] of pairs) {
    partner.set(a, b);
    partner.set(b, a);
  }
  const used = new Set<number>();
  const steps: PlanStep[] = [];
  items.forEach((item, i) => {
    if (used.has(i) || item.sets <= 0) return;
    used.add(i);
    const j = partner.get(i);
    const other = j !== undefined && !used.has(j) && items[j] && items[j].sets > 0 ? items[j] : null;
    if (j === undefined || !other) {
      for (let s = 0; s < item.sets; s++) steps.push({ slot: i, set: s, rest: item.rest });
      return;
    }
    used.add(j);
    for (let round = 0; round < Math.max(item.sets, other.sets); round++) {
      const mine = round < item.sets;
      const theirs = round < other.sets;
      // Cuando a uno ya no le quedan series, el otro sigue solo con su descanso normal.
      if (mine) steps.push({ slot: i, set: round, rest: theirs ? PAIR_REST.inner : item.rest, partner: j });
      if (theirs) steps.push({ slot: j, set: round, rest: mine ? PAIR_REST.outer : other.rest, partner: i });
    }
  });
  return steps;
}

/** Segundos que dura una serie. */
export function workSeconds(i: TimedExercise): number {
  return (i.byTime ? i.amount : i.amount * SECONDS_PER_REP) * (i.perSide ? 2 : 1);
}

/**
 * Minutos que lleva una sesión: lo que dura cada serie, el descanso después de cada una
 * (menos tras la última de la sesión) y un momento para colocarse en cada ejercicio.
 */
export function estimateMinutes(items: readonly TimedExercise[], pairs: readonly Pair[] = []): number {
  const steps = guidePlan(items, pairs);
  if (steps.length === 0) return 0;
  let seconds = new Set(steps.map((s) => s.slot)).size * SETUP_SECONDS;
  for (const s of steps) seconds += workSeconds(items[s.slot]) + s.rest;
  seconds -= steps[steps.length - 1].rest;
  return Math.max(1, Math.round(seconds / 60));
}
