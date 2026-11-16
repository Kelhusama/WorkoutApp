import type { Point } from './body';
import type { ISODate } from './dates';
import type { DayStatus } from './schedule';

/** Series de un ejercicio en una sesión. */
export interface SessionSets {
  date: ISODate;
  values: number[];
}

export interface Bests {
  /** Mejor serie (más repeticiones o segundos en una sola serie). */
  bestSet: number;
  /** Mayor total en una sesión. */
  bestTotal: number;
}

export interface ExerciseStats extends Bests {
  bestSetDate: ISODate;
  bestTotalDate: ISODate;
  sessions: number;
  lastDate: ISODate;
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

/** Resumen de un ejercicio; `history` en orden cronológico. Si hay empate, cuenta la primera vez. */
export function exerciseStats(history: SessionSets[]): ExerciseStats | null {
  const valid = history.filter((h) => h.values.length > 0);
  if (valid.length === 0) return null;
  let bestSet = -1;
  let bestTotal = -1;
  let bestSetDate = valid[0].date;
  let bestTotalDate = valid[0].date;
  for (const h of valid) {
    const top = Math.max(...h.values);
    const total = sum(h.values);
    if (top > bestSet) [bestSet, bestSetDate] = [top, h.date];
    if (total > bestTotal) [bestTotal, bestTotalDate] = [total, h.date];
  }
  return { bestSet, bestTotal, bestSetDate, bestTotalDate, sessions: valid.length, lastDate: valid[valid.length - 1].date };
}

export function seriesOf(history: SessionSets[], metric: 'best' | 'total'): Point[] {
  return history
    .filter((h) => h.values.length > 0)
    .map((h) => ({ date: h.date, value: metric === 'best' ? Math.max(...h.values) : sum(h.values) }));
}

export interface NewRecord {
  exerciseId: string;
  kind: 'serie' | 'total';
  value: number;
  previous: number;
}

/**
 * Récords batidos en una sesión respecto a las marcas anteriores.
 * La primera vez que se hace un ejercicio no cuenta como récord: no hay marca que batir.
 */
export function detectRecords(
  previous: ReadonlyMap<string, Bests>,
  session: { exerciseId: string; values: number[] }[],
): NewRecord[] {
  // Un mismo ejercicio puede aparecer dos veces en la sesión: se suman sus series.
  const byExercise = new Map<string, number[]>();
  for (const s of session) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), ...s.values]);

  const out: NewRecord[] = [];
  for (const [exerciseId, values] of byExercise) {
    const prev = previous.get(exerciseId);
    if (!prev || values.length === 0) continue;
    const top = Math.max(...values);
    const total = sum(values);
    if (top > prev.bestSet) out.push({ exerciseId, kind: 'serie', value: top, previous: prev.bestSet });
    if (total > prev.bestTotal) out.push({ exerciseId, kind: 'total', value: total, previous: prev.bestTotal });
  }
  return out;
}

/**
 * Racha de sesiones cumplidas seguidas. Los descansos, los viajes y los días aún pendientes no la rompen;
 * una sesión fallada sí. `days` en orden cronológico hasta hoy.
 */
export function streak(days: readonly { status: DayStatus }[]): { current: number; best: number } {
  let run = 0;
  let best = 0;
  for (const d of days) {
    if (d.status === 'done') best = Math.max(best, ++run);
    else if (d.status === 'missed') run = 0;
  }
  return { current: run, best };
}

/** Sesiones cumplidas y planificadas en un periodo ya pasado (para el % de cumplimiento). */
export function adherence(days: readonly { status: DayStatus }[]): { done: number; planned: number } {
  const done = days.filter((d) => d.status === 'done').length;
  return { done, planned: done + days.filter((d) => d.status === 'missed').length };
}
