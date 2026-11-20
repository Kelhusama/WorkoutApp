import type { ISODate } from './dates';
import type { Prescription, SlotRules } from './progression';

/**
 * Entrenador adaptativo, capa 4 (docs/ENTRENADOR_ADAPTATIVO.md): probar formas de entrenar
 * por bloques y quedarse con la que más hace mejorar el test.
 *
 * Cada bloque va de un test al siguiente. Lo que se mide es lo que sube el test por semana,
 * que no depende de cómo se entrene; así las variantes compiten en igualdad.
 */

export type GoalId = 'dominadas' | 'flexiones';
export type Variant = 'base' | 'cortas' | 'largas';

export const VARIANT_ORDER: readonly Variant[] = ['base', 'cortas', 'largas'];

export const VARIANT_INFO: Record<Variant, { label: string; detail: string }> = {
  base: { label: 'Plan normal', detail: 'Las series y repeticiones de siempre.' },
  cortas: { label: 'Muchas series cortas', detail: 'Más series de menos repeticiones, lejos del fallo: más práctica con buena técnica.' },
  largas: { label: 'Pocas series largas', detail: 'Menos series y más repeticiones en cada una, cerca del límite.' },
};

/** Ejercicios de las sesiones de casa que cambian con el bloque de cada objetivo. */
export const GOAL_SLOTS: Record<GoalId, readonly string[]> = {
  dominadas: ['A.dominadas', 'C.dominadas'],
  flexiones: ['B.flexiones'],
};

export function goalOfSlot(slotKey: string): GoalId | null {
  return (Object.keys(GOAL_SLOTS) as GoalId[]).find((g) => GOAL_SLOTS[g].includes(slotKey)) ?? null;
}

/** Lo que se pide en una sesión según la variante del bloque, a partir de lo que marca el plan. */
export function applyVariant(p: Prescription, rules: SlotRules, variant: Variant): Prescription {
  if (variant === 'cortas') {
    return { ...p, sets: Math.ceil(p.sets * 1.6), reps: Math.max(rules.step, p.reps - Math.max(rules.step, Math.round(p.reps * 0.4))) };
  }
  if (variant === 'largas') {
    return { ...p, sets: Math.max(2, p.sets - 1), reps: p.reps + Math.max(rules.step, Math.round(p.reps * 0.25)) };
  }
  return p;
}

/** Un bloque dura como mínimo tres semanas: antes, lo que cambie el test es ruido. */
export const BLOCK_MIN_DAYS = 21;
/** A partir de aquí conviene repetir el test. */
export const BLOCK_TEST_DAYS = 28;

export interface Block {
  id: number;
  goal: GoalId;
  variant: Variant;
  startDate: ISODate;
  startValue: number;
  endDate: ISODate | null;
  endValue: number | null;
}

const days = (a: ISODate, b: ISODate) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Repeticiones que subió el test por semana durante el bloque; null si sigue abierto. */
export function blockReward(b: Block): number | null {
  if (b.endDate === null || b.endValue === null) return null;
  const weeks = Math.max(days(b.startDate, b.endDate), 1) / 7;
  return (b.endValue - b.startValue) / weeks;
}

export interface ArmStats {
  variant: Variant;
  /** Bloques terminados con esta variante. */
  n: number;
  /** Media de repeticiones ganadas por semana, o null si aún no se ha probado. */
  mean: number | null;
}

export function armStats(blocks: readonly Block[], goal: GoalId): ArmStats[] {
  return VARIANT_ORDER.map((variant) => {
    const rewards = blocks.filter((b) => b.goal === goal && b.variant === variant).map(blockReward).filter((r): r is number => r !== null);
    return { variant, n: rewards.length, mean: rewards.length ? rewards.reduce((a, b) => a + b, 0) / rewards.length : null };
  });
}

/** Cuánto varía de un bloque a otro lo que sube el test, en repeticiones por semana. */
const SIGMA = 0.5;

/** Número al azar con distribución normal estándar (Box-Muller). */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/**
 * Muestreo de Thompson: de cada variante se saca al azar un valor creíble de lo que rinde
 * (con más margen cuanto menos se ha probado) y se elige la mayor. Así las que funcionan
 * se repiten más, pero las poco probadas siguen teniendo su oportunidad.
 */
export function chooseVariant(blocks: readonly Block[], goal: GoalId, random: () => number = Math.random): Variant {
  let best: Variant = 'base';
  let bestDraw = -Infinity;
  for (const arm of armStats(blocks, goal)) {
    // Creencia de partida: no mejora ni empeora (0), con el peso de un bloque.
    const mean = ((arm.mean ?? 0) * arm.n) / (arm.n + 1);
    const sd = SIGMA / Math.sqrt(arm.n + 1);
    const draw = mean + sd * gaussian(random);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = arm.variant;
    }
  }
  return best;
}

export type TestOutcome =
  | { kind: 'primero'; variant: Variant }
  | { kind: 'pronto'; daysLeft: number }
  | { kind: 'cambio'; reward: number; previous: Variant; variant: Variant };

/**
 * Qué pasa con el bloque al apuntar un test: el primero abre el bloque con el plan normal;
 * si aún no han pasado tres semanas, el bloque sigue; si no, se cierra, se anota lo que rindió
 * y se elige la variante del siguiente.
 */
export function onTest(blocks: readonly Block[], goal: GoalId, date: ISODate, value: number, random: () => number = Math.random): TestOutcome {
  const open = blocks.find((b) => b.goal === goal && b.endDate === null);
  if (!open) return { kind: 'primero', variant: 'base' };
  const elapsed = days(open.startDate, date);
  if (elapsed < BLOCK_MIN_DAYS) return { kind: 'pronto', daysLeft: BLOCK_MIN_DAYS - elapsed };
  const closed: Block = { ...open, endDate: date, endValue: value };
  const all = blocks.map((b) => (b.id === open.id ? closed : b));
  return { kind: 'cambio', reward: blockReward(closed)!, previous: open.variant, variant: chooseVariant(all, goal, random) };
}

export interface TestDue {
  goal: GoalId;
  /** Aún no hay ningún test: hace falta el primero para empezar a comparar. */
  first: boolean;
  /** Días que lleva el bloque abierto. */
  days: number;
}

/** Objetivos a los que les toca test: sin ninguno todavía, o con el bloque abierto desde hace 4 semanas. */
export function testsDue(blocks: readonly Block[], today: ISODate): TestDue[] {
  const out: TestDue[] = [];
  for (const goal of Object.keys(GOAL_SLOTS) as GoalId[]) {
    const open = blocks.find((b) => b.goal === goal && b.endDate === null);
    if (!open) out.push({ goal, first: true, days: 0 });
    else if (days(open.startDate, today) >= BLOCK_TEST_DAYS) out.push({ goal, first: false, days: days(open.startDate, today) });
  }
  return out;
}
