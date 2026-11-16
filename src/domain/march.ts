import type { Point } from './body';
import { addDays, fromISODate, weekStart, type ISODate } from './dates';
import { LAST_STEP, longDone, nextStep, stepAfterBreak, stepAt, type MarchStep } from './marchPlan';

/** Tipo de caminata: las cuatro del plan o una libre. */
export type WalkKind = 'suave' | 'cuestas' | 'larga' | 'extra' | 'libre';

export const WALK_LABEL: Record<WalkKind, string> = {
  suave: 'Paseo suave',
  cuestas: 'Cuestas o ritmo vivo',
  larga: 'Tirada larga',
  extra: 'Víspera de la larga',
  libre: 'Caminata libre',
};

export interface Walk {
  id: number;
  date: ISODate;
  kind: WalkKind;
  km: number;
  minutes: number;
  /** Desnivel positivo en metros. */
  elevation: number | null;
  packKg: number | null;
  /** Esfuerzo percibido, de 1 a 10. */
  effort: number | null;
  notes: string | null;
}

export interface MarchState {
  /** Escalón actual del plan. */
  step: number;
  /** Día desde el que cuentan las caminatas para este escalón. */
  since: ISODate;
  /** Se han caminado los 50 km. */
  completed: boolean;
}

const daysBetween = (a: ISODate, b: ISODate) => Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);

export type MarchEvent = { type: 'avance'; from: number; to: number } | { type: 'retroceso'; from: number; to: number } | { type: 'reto' };

/**
 * Pone el plan al día con las caminatas registradas:
 * - si la tirada larga del escalón está hecha, avanza (y sigue contando desde el día siguiente);
 * - las semanas de descarga y reducción avanzan solas al pasar 7 días;
 * - tras dos semanas o más sin caminar, retrocede.
 * `walks` puede venir en cualquier orden. Devuelve el estado nuevo y lo que ha pasado.
 */
export function evolve(state: MarchState, walks: readonly Pick<Walk, 'date' | 'km'>[], today: ISODate): { state: MarchState; events: MarchEvent[] } {
  let { step, since, completed } = state;
  const events: MarchEvent[] = [];
  if (completed) return { state, events };

  for (let guard = 0; guard < 2 * LAST_STEP; guard++) {
    const s = stepAt(step);
    const done = walks
      .filter((w) => w.date >= since && w.date <= today && longDone(s, w.km))
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (done) {
      if (step === LAST_STEP) {
        events.push({ type: 'reto' });
        completed = true;
        break;
      }
      events.push({ type: 'avance', from: step, to: step + 1 });
      step = nextStep(step, done.km);
      since = addDays(done.date, 1);
      continue;
    }
    const easyWeek = s.kind === 'descarga' || s.kind === 'reduccion';
    if (easyWeek && daysBetween(since, today) >= 7) {
      events.push({ type: 'avance', from: step, to: step + 1 });
      step = nextStep(step, 0);
      since = addDays(since, 7);
      continue;
    }
    break;
  }

  if (!completed) {
    const last = walks.map((w) => w.date).filter((d) => d <= today).sort().pop();
    const lastActivity = last && last > since ? last : since;
    const weeksOff = Math.floor(daysBetween(lastActivity, today) / 7);
    const back = stepAfterBreak(step, weeksOff);
    if (back !== step) {
      events.push({ type: 'retroceso', from: step, to: back });
      step = back;
      since = today;
    }
  }
  return { state: { step, since, completed }, events };
}

export interface PlannedWalk {
  kind: Exclude<WalkKind, 'libre'>;
  km: number;
  /** Caminata registrada que la cumple, si la hay. */
  done: Pick<Walk, 'date' | 'km'> | null;
}

/** Caminatas del escalón actual y cuáles están hechas ya. */
export function plannedWalks(s: MarchStep, walksSince: readonly Pick<Walk, 'date' | 'km' | 'kind'>[]): PlannedWalk[] {
  const used = new Set<number>();
  const take = (ok: (w: Pick<Walk, 'km' | 'kind'>) => boolean) => {
    const i = walksSince.findIndex((w, idx) => !used.has(idx) && ok(w));
    if (i < 0) return null;
    used.add(i);
    return { date: walksSince[i].date, km: walksSince[i].km };
  };
  // La larga primero, para que ninguna otra se quede con la caminata más larga.
  const long = take((w) => longDone(s, w.km));
  const out: PlannedWalk[] = [
    { kind: 'suave', km: s.easy, done: null },
    { kind: 'cuestas', km: s.hills, done: null },
  ];
  if (s.extra > 0) out.push({ kind: 'extra', km: s.extra, done: null });
  // Primero las que coinciden en tipo; después, una caminata libre puede cubrir la que falte.
  for (const p of out) p.done = take((w) => w.kind === p.kind && w.km >= p.km * 0.8);
  for (const p of out) p.done ??= take((w) => w.kind === 'libre' && w.km >= p.km * 0.8);
  out.push({ kind: 'larga', km: s.long, done: long });
  return out;
}

/** Ritmo en minutos por kilómetro. */
export function pace(w: Pick<Walk, 'km' | 'minutes'>): number | null {
  return w.km > 0 && w.minutes > 0 ? w.minutes / w.km : null;
}

export function formatPace(minPerKm: number): string {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} min/km`;
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** Kilómetros totales y caminata más larga de cada semana (lunes), en orden. */
export function weeklySeries(walks: readonly Pick<Walk, 'date' | 'km'>[]): { total: Point[]; longest: Point[] } {
  const byWeek = new Map<ISODate, { total: number; longest: number }>();
  for (const w of walks) {
    const k = weekStart(w.date);
    const cur = byWeek.get(k) ?? { total: 0, longest: 0 };
    byWeek.set(k, { total: cur.total + w.km, longest: Math.max(cur.longest, w.km) });
  }
  const weeks = [...byWeek.keys()].sort();
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    total: weeks.map((d) => ({ date: d, value: round(byWeek.get(d)!.total) })),
    longest: weeks.map((d) => ({ date: d, value: round(byWeek.get(d)!.longest) })),
  };
}

/** Caminata más larga de las últimas 4 semanas y si hubo dos días seguidos sumando 30 km o más. */
export function recentForm(walks: readonly Pick<Walk, 'date' | 'km' | 'minutes'>[], today: ISODate) {
  const from = addDays(today, -28);
  const recent = walks.filter((w) => w.date > from && w.date <= today);
  const longest = recent.reduce<(typeof recent)[number] | null>((best, w) => (!best || w.km > best.km ? w : best), null);
  const byDate = new Map<ISODate, number>();
  for (const w of walks) byDate.set(w.date, (byDate.get(w.date) ?? 0) + w.km);
  const double = [...byDate.entries()].some(([d, km]) => {
    const next = byDate.get(addDays(d, 1));
    return next !== undefined && km >= 8 && next >= 8 && km + next >= 30;
  });
  return { longestKm: longest?.km ?? 0, longestPace: longest ? pace(longest) : null, double };
}
