/** Orden de una sesión guiada: serie a serie dentro de cada ejercicio, y luego el ejercicio siguiente. */

export interface GuideStep {
  /** Posición del ejercicio en la sesión. */
  slot: number;
  /** Posición de la serie dentro del ejercicio. */
  set: number;
}

/** Lo que toca después de la serie indicada; `null` cuando era la última de la sesión. Salta ejercicios sin series. */
export function guideAfter(sets: readonly number[], at: GuideStep): GuideStep | null {
  if (at.set + 1 < (sets[at.slot] ?? 0)) return { slot: at.slot, set: at.set + 1 };
  for (let i = at.slot + 1; i < sets.length; i++) if (sets[i] > 0) return { slot: i, set: 0 };
  return null;
}

export function guideTotalSets(sets: readonly number[]): number {
  return sets.reduce((a, b) => a + Math.max(0, b), 0);
}

/** Lo que hace falta saber de un ejercicio para estimar cuánto se tarda. */
export interface TimedExercise {
  sets: number;
  /** Repeticiones, o segundos si el ejercicio es por tiempo. */
  amount: number;
  byTime: boolean;
  /** Se hace un lado cada vez: cada serie cuenta doble. */
  perSide: boolean;
  /** Descanso entre series, en segundos. */
  rest: number;
}

/** Tope de una sesión de casa: más larga no se hace con constancia. */
export const MAX_SESSION_MINUTES = 20;

const SECONDS_PER_REP = 3;
/** Colocarse y cambiar de ejercicio. */
const SETUP_SECONDS = 20;

/**
 * Minutos que lleva una sesión: lo que dura cada serie, el descanso después de cada una
 * (menos tras la última de la sesión) y un momento para colocarse en cada ejercicio.
 */
export function estimateMinutes(items: readonly TimedExercise[]): number {
  const active = items.filter((i) => i.sets > 0);
  if (active.length === 0) return 0;
  let seconds = 0;
  for (const i of active) {
    const work = (i.byTime ? i.amount : i.amount * SECONDS_PER_REP) * (i.perSide ? 2 : 1);
    seconds += SETUP_SECONDS + i.sets * (work + i.rest);
  }
  seconds -= active[active.length - 1].rest;
  return Math.max(1, Math.round(seconds / 60));
}
