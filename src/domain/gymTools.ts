import type { Feeling } from './progression';

export const BAR_KG = 20;
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

const round25 = (kg: number) => Math.round(kg / 2.5) * 2.5;

export interface WarmupSet {
  weight: number;
  reps: number;
}

/**
 * Series de calentamiento para un peso de trabajo: barra sola y pasos al 50 %, 70 % y 85 %,
 * redondeados a 2,5 kg. Se omiten los pasos demasiado cercanos a la barra o al peso de trabajo.
 */
export function warmupSets(work: number, bar = BAR_KG): WarmupSet[] {
  if (work <= 0) return [];
  const out: WarmupSet[] = [{ weight: Math.min(bar, work), reps: 10 }];
  for (const [pct, reps] of [
    [0.5, 5],
    [0.7, 3],
    [0.85, 2],
  ] as const) {
    const w = round25(work * pct);
    // Solo pasos que aportan: al menos 5 kg sobre el anterior y 5 kg por debajo del peso de trabajo.
    if (w >= out[out.length - 1].weight + 5 && w <= work - 5) out.push({ weight: w, reps });
  }
  return out;
}

/** Discos por cada lado de la barra, de mayor a menor. `rest` = kilos que no se pueden montar. */
export function platesPerSide(total: number, bar = BAR_KG): { plates: number[]; rest: number } {
  let side = (total - bar) / 2;
  if (side <= 0) return { plates: [], rest: 0 };
  const plates: number[] = [];
  for (const p of PLATES) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side -= p;
    }
  }
  return { plates, rest: Math.round(side * 2 * 100) / 100 };
}

/**
 * Conviene una semana de descarga si 3 de las últimas 4 sesiones hechas fueron «dura».
 * `feelings` en orden cronológico.
 */
export function needsDeload(feelings: readonly (Feeling | null)[]): boolean {
  const last = feelings.slice(-4);
  return last.length >= 4 && last.filter((f) => f === 'dura').length >= 3;
}
