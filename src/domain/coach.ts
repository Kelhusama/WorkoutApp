import type { Point } from './body';
import { addDays, type ISODate } from './dates';
import type { Prescription, ProgressionResult, SlotRules } from './progression';

/**
 * Entrenador adaptativo, capas 1 y 2 (docs/ENTRENADOR_ADAPTATIVO.md):
 * qué se apunta de cada ejercicio y cómo se estima la fuerza real a partir de ello.
 */

/** Repeticiones que quedaban en la última serie: 0 = ninguna · 1 = una o dos · 2 = tres o más. */
export type Reserve = 0 | 1 | 2;

/** Repeticiones que representa cada respuesta. */
const RESERVE_REPS: Record<Reserve, number> = { 0: 0, 1: 1.5, 2: 3.5 };

export const RESERVE_OPTIONS: readonly { id: `${Reserve}`; label: string }[] = [
  { id: '0', label: 'Ninguna' },
  { id: '1', label: '1 o 2' },
  { id: '2', label: '3 o más' },
];

export interface Observation {
  date: ISODate;
  /** Lo que habrías podido hacer en una serie a tope. */
  value: number;
  /** Desviación típica del error de esa medida. */
  noise: number;
}

/**
 * Capacidad de un ejercicio en una sesión: lo que se habría hecho en una serie al fallo.
 * Con la reserva apuntada es la última serie más lo que quedaba (o la mejor serie, si fue mayor);
 * sin ella solo se sabe que es al menos la mejor serie, así que la medida es menos fiable.
 * En ejercicios por tiempo la reserva se escala (cada «repetición» vale `unit` segundos).
 */
export function capacity(date: ISODate, values: readonly number[], reserve: Reserve | null, unit = 1): Observation | null {
  if (values.length === 0) return null;
  const best = Math.max(...values);
  if (best <= 0) return null;
  const base = Math.max(1, best * 0.07);
  if (reserve === null) return { date, value: best, noise: base * 2 };
  const last = values[values.length - 1];
  return { date, value: Math.max(best, last + RESERVE_REPS[reserve] * unit), noise: base };
}

export type Trend = 'pocos_datos' | 'mejorando' | 'estable' | 'bajando';

export interface StrengthState {
  /** Sesiones usadas. */
  n: number;
  /** Nivel actual estimado y su margen (desviación típica). */
  level: number;
  levelSd: number;
  /** Ritmo de mejora por semana y su margen. */
  ratePerWeek: number;
  rateSd: number;
  trend: Trend;
  /** Nivel estimado tras cada sesión, para dibujarlo. */
  series: Point[];
}

/** Sesiones mínimas para opinar sobre la tendencia. */
export const MIN_SESSIONS = 4;

const daysBetween = (a: ISODate, b: ISODate) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Filtro de Kalman con dos estados: nivel y ritmo de mejora por día.
 * Separa el progreso real del ruido de un día bueno o malo, y dice cuánto se fía de cada cosa.
 * `observations` en orden cronológico.
 */
export function fitStrength(observations: readonly Observation[]): StrengthState | null {
  if (observations.length === 0) return null;
  const first = observations[0];
  const scale = Math.max(first.value, 1);
  // Cuánto pueden cambiar de un día a otro el nivel y el ritmo sin que nadie lo vea.
  const qLevel = (0.004 * scale) ** 2;
  const qRate = (0.002 * scale) ** 2;

  let x = first.value; // nivel
  let v = 0; // ritmo por día
  let pxx = first.noise ** 2;
  let pxv = 0;
  let pvv = (0.01 * scale) ** 2;
  const series: Point[] = [{ date: first.date, value: x }];

  for (let i = 1; i < observations.length; i++) {
    const o = observations[i];
    const dt = Math.max(0, daysBetween(observations[i - 1].date, o.date));
    // Predicción: el nivel avanza a su ritmo durante dt días.
    x += v * dt;
    pxx += 2 * dt * pxv + dt * dt * pvv + qLevel * dt;
    pxv += dt * pvv;
    pvv += qRate * dt;
    // Corrección con lo medido hoy.
    const s = pxx + o.noise ** 2;
    const kx = pxx / s;
    const kv = pxv / s;
    const err = o.value - x;
    x += kx * err;
    v += kv * err;
    const nPvv = pvv - kv * pxv;
    const nPxv = pxv - kx * pxv;
    pxx -= kx * pxx;
    pxv = nPxv;
    pvv = nPvv;
    series.push({ date: o.date, value: x });
  }

  const ratePerWeek = v * 7;
  const rateSd = Math.sqrt(Math.max(pvv, 0)) * 7;
  const n = observations.length;
  let trend: Trend = 'estable';
  if (n < MIN_SESSIONS) trend = 'pocos_datos';
  else if (ratePerWeek > rateSd) trend = 'mejorando';
  else if (ratePerWeek < -rateSd) trend = 'bajando';
  return { n, level: x, levelSd: Math.sqrt(Math.max(pxx, 0)), ratePerWeek, rateSd, trend, series };
}

export interface Window {
  /** Fecha más temprana y más tardía razonables; `to` es null si con el ritmo lento no se llega. */
  from: ISODate;
  to: ISODate | null;
}

/** Cuándo se llegaría a `target`, con margen: ritmo optimista (+1 desviación) y prudente (−1). */
export function projectWindow(state: StrengthState, target: number, today: ISODate): Window | null {
  if (state.trend !== 'mejorando' || state.level >= target) return null;
  const gap = target - state.level;
  const weeks = (rate: number) => (rate > 0 ? gap / rate : null);
  const fast = weeks(state.ratePerWeek + state.rateSd)!;
  const slow = weeks(state.ratePerWeek - state.rateSd);
  // Más allá de tres años no es una previsión, es un deseo.
  if (fast > 156) return null;
  return { from: addDays(today, Math.round(fast * 7)), to: slow !== null && slow <= 156 ? addDays(today, Math.round(slow * 7)) : null };
}

/** Frase corta para la ficha del ejercicio. */
export function trendText(state: StrengthState, unit: string): string {
  const rate = Math.abs(state.ratePerWeek);
  const amount = `${rate < 0.95 ? rate.toFixed(1).replace('.', ',') : Math.round(rate)} ${unit} por semana`;
  switch (state.trend) {
    case 'pocos_datos':
      return `Con ${MIN_SESSIONS} sesiones o más sabré si mejoras de verdad o es un buen día.`;
    case 'mejorando':
      return `Mejoras de verdad: unas ${amount}.`;
    case 'bajando':
      return `Vas a menos: unas ${amount}. Puede ser cansancio acumulado.`;
    default:
      return 'Estable: los cambios de las últimas sesiones entran dentro de lo normal de un día a otro.';
  }
}

// ---------- Capa 3: fatiga, sesión ligera y sesiones extra ----------

/** Series de una sesión ligera: un tercio menos, y nunca menos de dos (o las que hubiera). */
export function lightSets(sets: number): number {
  return Math.min(sets, Math.max(2, Math.ceil((sets * 2) / 3)));
}

export interface DoneSession {
  date: ISODate;
  kind: string;
  feeling: 'facil' | 'normal' | 'dura' | null;
}

export interface Readiness {
  /** Conviene hacer la sesión ligera. */
  light: boolean;
  reason: string;
}

/**
 * ¿Conviene aflojar hoy? Mira solo lo que ya está apuntado:
 * cuántas sesiones llevas en los últimos 7 días y cómo fueron las dos últimas.
 * `done`: sesiones hechas (gimnasio incluido), en cualquier orden.
 */
export function readiness(done: readonly DoneSession[], today: ISODate): Readiness {
  const before = done.filter((s) => s.date < today).sort((a, b) => (a.date < b.date ? 1 : -1));
  const week = before.filter((s) => s.date >= addDays(today, -6));
  const lastTwo = before.slice(0, 2);
  if (lastTwo.length === 2 && lastTwo.every((s) => s.feeling === 'dura') && lastTwo[1].date >= addDays(today, -6)) {
    return { light: true, reason: 'Tus dos últimas sesiones fueron duras: hoy toca aflojar para recuperar.' };
  }
  const streak = [1, 2, 3].every((n) => before.some((s) => s.date === addDays(today, -n)));
  if (streak) return { light: true, reason: 'Llevas tres días seguidos entrenando: hoy mejor una sesión ligera.' };
  if (week.length >= 4) {
    return { light: true, reason: `Llevas ${week.length} sesiones en los últimos 7 días: la de hoy, mejor ligera.` };
  }
  return { light: false, reason: 'Vas bien de carga esta semana.' };
}

/** Qué sesión de casa hacer como extra: la que hace más tiempo que no haces. */
export function extraKind(done: readonly DoneSession[]): 'A' | 'B' | 'C' {
  const last = (k: string) => done.filter((s) => s.kind === k).reduce((m, s) => (s.date > m ? s.date : m), '');
  return (['A', 'B', 'C'] as const).reduce((best, k) => (last(k) < last(best) ? k : best), 'A');
}

// ---------- Capa 3, segunda parte: mesetas y banca ----------

/** Días sin que cambie lo que se pide de un ejercicio para hablar de meseta. */
export const PLATEAU_DAYS = 21;
/** Sesiones mínimas en ese tiempo. */
export const PLATEAU_SESSIONS = 6;

/**
 * Meseta: tres semanas o más pidiendo lo mismo, con sesiones suficientes,
 * y sin que el nivel real mejore. Una o dos semanas flojas son ruido.
 */
export function isPlateau(p: { daysUnchanged: number; sessions: number; trend: Trend }): boolean {
  return p.daysUnchanged >= PLATEAU_DAYS && p.sessions >= PLATEAU_SESSIONS && p.trend !== 'mejorando' && p.trend !== 'pocos_datos';
}

/**
 * Qué hacer con un ejercicio estancado. La prioridad es el tren superior:
 * - si va al límite, se baja una repetición para acumular series limpias;
 * - si sale con margen pero no avanza, una serie más (más estímulo);
 * - la pierna se deja como está.
 */
export function plateauAction(current: Prescription, rules: SlotRules, o: { upper: boolean; atLimit: boolean }): ProgressionResult {
  if (!o.upper) {
    return { next: current, change: 'none', reason: 'Lleva semanas igual; se mantiene, porque la prioridad es el tren superior.' };
  }
  if (o.atLimit) {
    if (current.reps > rules.repsMin) {
      return {
        next: { ...current, reps: Math.max(rules.repsMin, current.reps - rules.step) },
        change: 'baja',
        reason: 'Tres semanas al límite sin avanzar: bajo un poco para que acumules series limpias y vuelvas a subir.',
      };
    }
    return { next: current, change: 'none', reason: 'Estancado en lo más bajo del rango: conviene una semana ligera o una variante más fácil.' };
  }
  if (current.sets < rules.maxSets) {
    return {
      next: { ...current, sets: current.sets + 1 },
      change: 'sets',
      reason: 'Tres semanas sin mejorar de verdad: añado una serie para dar más estímulo.',
    };
  }
  return { next: current, change: 'none', reason: 'Estancado y ya con todas las series: toca cambiar a una variante más difícil.' };
}

/** Series de trabajo de banca que busca el plan: 3 de 5. */
export const BENCH_REPS = 5;

export interface BenchAdvice {
  weight: number;
  reps: number;
  reason: string;
}

/**
 * Carga de banca para hoy a partir de la mejor serie del último día y de lo que quedaba.
 * Saltos de 2,5 kg: con margen sube, al límite repite, y si no llegó a las repeticiones, afloja.
 */
export function benchAdvice(last: { weight: number; reps: number; reserve: Reserve | null }): BenchAdvice {
  const at = (delta: number, reason: string): BenchAdvice => ({ weight: Math.max(20, last.weight + delta), reps: BENCH_REPS, reason });
  if (last.reps <= BENCH_REPS - 2) return at(-2.5, `La última vez solo salieron ${last.reps}: baja 2,5 kg y completa las ${BENCH_REPS}.`);
  if (last.reps < BENCH_REPS) return at(0, `La última vez te quedaste en ${last.reps}: repite el peso hasta sacar ${BENCH_REPS}.`);
  if (last.reserve === 0) return at(0, 'La última vez fue al límite: repite el peso y busca que sobre una.');
  if (last.reserve === 2 || last.reps >= BENCH_REPS + 3) return at(5, 'La última vez te sobraba mucho: sube 5 kg.');
  if (last.reserve === 1 || last.reps > BENCH_REPS) return at(2.5, 'La última vez salió con margen: sube 2,5 kg.');
  return at(0, 'Repite el peso; si hoy sale con margen, la próxima sube.');
}
