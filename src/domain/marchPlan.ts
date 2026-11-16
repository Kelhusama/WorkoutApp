import type { Role } from './schedule';

/**
 * Plan para completar una marcha de 50 km caminando.
 *
 * No depende de una fecha: se empieza cuando se quiera, en el escalón que corresponde a lo que ya
 * se camina, y se avanza al completar la tirada larga de cada escalón. Si una semana no sale, se
 * repite; tras un parón se retrocede. Así el plan sigue lo que se hace de verdad, no el calendario.
 *
 * La progresión sintetiza los planes publicados de Trailwalker UK y Mind (16 semanas), con dos
 * escalones de base delante para quien no camina habitualmente. Ver docs/INVESTIGACION.md.
 */
export type StepKind = 'base' | 'carga' | 'descarga' | 'doble' | 'ensayo' | 'reduccion' | 'reto';

export interface MarchStep {
  /** Posición en el plan, desde 1. */
  n: number;
  /** Paseo suave entre semana (km). */
  easy: number;
  /** Paseo con cuestas o a ritmo vivo (km). */
  hills: number;
  /** Caminata del día anterior a la larga, solo en fines de semana dobles (km). */
  extra: number;
  /** Tirada larga (km). */
  long: number;
  kind: StepKind;
  note?: string;
}

const step = (n: number, easy: number, hills: number, extra: number, long: number, kind: StepKind, note?: string): MarchStep => ({
  n,
  easy,
  hills,
  extra,
  long,
  kind,
  note,
});

export const GOAL_KM = 50;

export const MARCH_PLAN: readonly MarchStep[] = [
  step(1, 3, 3, 0, 6, 'base', 'Para empezar de cero: coge el hábito y prueba el calzado.'),
  step(2, 4, 4, 0, 8, 'base'),
  step(3, 5, 5, 0, 10, 'carga'),
  step(4, 5, 6, 0, 12, 'carga'),
  step(5, 6, 6, 0, 15, 'carga'),
  step(6, 5, 5, 0, 10, 'descarga', 'Semana suave para asimilar.'),
  step(7, 6, 7, 0, 18, 'carga', 'Empieza a llevar la mochila con 3–4 kg.'),
  step(8, 6, 8, 0, 21, 'carga', 'Come y bebe durante la tirada, como harás el día de la marcha.'),
  step(9, 6, 8, 0, 25, 'carga', 'Hito: la mitad del reto.'),
  step(10, 5, 6, 0, 14, 'descarga'),
  step(11, 6, 8, 10, 22, 'doble', 'Dos días seguidos: aprendes a caminar con las piernas cansadas.'),
  step(12, 6, 8, 0, 30, 'carga', 'Hito: 30 km.'),
  step(13, 6, 8, 15, 25, 'doble', 'La semana con más kilómetros del plan.'),
  step(14, 5, 6, 0, 15, 'descarga'),
  step(15, 6, 8, 0, 36, 'ensayo', 'Ensayo general: mismo calzado, mochila y comida que usarás en el reto.'),
  step(16, 6, 8, 10, 20, 'reduccion', 'Empiezas a bajar carga: llega con hambre de caminar.'),
  step(17, 6, 6, 0, 12, 'reduccion'),
  step(18, 5, 3, 0, GOAL_KM, 'reto', 'El reto: 50 km. Sal más lento de lo que te apetezca.'),
];

export const LAST_STEP = MARCH_PLAN.length;

export const KIND_LABEL: Record<StepKind, string> = {
  base: 'Base',
  carga: 'Carga',
  descarga: 'Descarga',
  doble: 'Fin de semana doble',
  ensayo: 'Ensayo general',
  reduccion: 'Reducción',
  reto: 'El reto',
};

export function stepAt(n: number): MarchStep {
  return MARCH_PLAN[Math.min(LAST_STEP, Math.max(1, Math.round(n))) - 1];
}

export function weeklyKm(s: MarchStep): number {
  return s.easy + s.hills + s.extra + s.long;
}

/**
 * Escalón de entrada según la caminata más larga que ya haces sin molestias.
 * Empieza en el primer escalón que te pide algo más, sin saltarse la fase de carga inicial
 * (como mucho entras en el escalón 7, aunque ya camines distancias largas).
 */
export function entryStep(comfortableKm: number): number {
  const first = MARCH_PLAN.find((s) => s.kind !== 'descarga' && s.long > comfortableKm);
  return Math.min(first?.n ?? 7, 7);
}

/** La tirada larga cuenta como hecha con el 90 % de la distancia. */
export function longDone(s: MarchStep, walkedKm: number): boolean {
  return walkedKm >= s.long * 0.9;
}

/**
 * Siguiente escalón tras una semana: avanza si se completó la tirada larga; si no, se repite.
 * Las semanas de descarga y reducción avanzan siempre: su objetivo es descansar.
 */
export function nextStep(current: number, longWalkedKm: number): number {
  const s = stepAt(current);
  const easyWeek = s.kind === 'descarga' || s.kind === 'reduccion';
  return easyWeek || longDone(s, longWalkedKm) ? Math.min(LAST_STEP, current + 1) : current;
}

/**
 * Escalón al que volver tras un parón sin caminar. Hasta una semana no cambia nada;
 * después se retrocede un escalón por semana parada (como mucho 4) y nunca se retoma en una
 * reducción ni en el reto.
 */
export function stepAfterBreak(current: number, weeksOff: number): number {
  if (weeksOff < 2) return current;
  let n = Math.max(1, current - Math.min(4, weeksOff - 1));
  while (n > 1 && (stepAt(n).kind === 'reduccion' || stepAt(n).kind === 'reto')) n--;
  return n;
}

/** Semanas que quedan si todo sale a la primera, contando el escalón actual. */
export function weeksLeft(current: number): number {
  return LAST_STEP - Math.min(LAST_STEP, Math.max(1, current)) + 1;
}

export type Readiness = 'verde' | 'ambar' | 'rojo';

/**
 * ¿Listo para los 50 km? Heurística propia a partir de lo caminado en las últimas 4 semanas.
 * Verde: tirada de 35 km o más y un fin de semana doble hecho. Ámbar: tirada de 28 km o más.
 */
export function readiness(longestLast4WeeksKm: number, doubleWeekendDone: boolean): Readiness {
  if (longestLast4WeeksKm >= 35 && doubleWeekendDone) return 'verde';
  if (longestLast4WeeksKm >= 28) return 'ambar';
  return 'rojo';
}

/**
 * Tiempo previsto para una distancia, en minutos: el ritmo de tu última tirada larga con un 7 % de
 * margen por el cansancio, más paradas y unos 10 min por cada 100 m de desnivel positivo.
 */
export function predictedMinutes(km: number, paceMinPerKm: number, stopsMin = 60, elevationGainM = 0): number {
  return Math.round(km * paceMinPerKm * 1.07 + stopsMin + (elevationGainM / 100) * 10);
}

/** Subida de kilómetros respecto a la semana anterior que conviene no superar. */
export const MAX_WEEKLY_INCREASE = 0.2;

export function increaseTooFast(previousWeekKm: number, thisWeekKm: number): boolean {
  return previousWeekKm >= 10 && thisWeekKm > previousWeekKm * (1 + MAX_WEEKLY_INCREASE) + 5;
}

export interface WalkDays {
  /** Índices de día (0 = lunes) para cada caminata. `extra` solo se usa en fines de semana dobles. */
  easy: number;
  hills: number;
  long: number;
  extra: number;
}

/**
 * Reparte las caminatas en tu semana tipo: la larga en el último día de descanso (suele ser
 * domingo), la del fin de semana doble el día anterior, y las dos cortas en días de casa,
 * evitando la víspera de la tirada larga.
 */
export function walkDays(template: readonly Role[]): WalkDays {
  const rest = template.map((r, i) => (r === 'rest' ? i : -1)).filter((i) => i >= 0);
  const long = rest.length ? rest[rest.length - 1] : 6;
  const extra = (long + 6) % 7;
  const candidates = template
    .map((r, i) => ({ r, i }))
    .filter((d) => d.i !== long && d.i !== extra && d.r !== 'rest')
    // Mejor en días de casa (sesión corta) que en días de gimnasio.
    .sort((a, b) => Number(a.r === 'gym') - Number(b.r === 'gym') || a.i - b.i)
    .map((d) => d.i);
  const easy = candidates[0] ?? (long + 2) % 7;
  const hills = candidates.find((i) => Math.abs(i - easy) > 1) ?? candidates[1] ?? (long + 4) % 7;
  return { easy, hills, long, extra };
}
