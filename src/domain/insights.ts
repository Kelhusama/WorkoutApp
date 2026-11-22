import type { Point } from './body';
import { addDays, fromISODate, weekStart, type ISODate } from './dates';
import type { DayStatus } from './schedule';
import { HYPERTROPHY_RANGE, type MuscleGroup } from './volume';

const DAY = 86_400_000;
const daysBetween = (a: ISODate, b: ISODate) => Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / DAY);

// ---------- Proyección de objetivos ----------

export type ProjectionStatus = 'conseguido' | 'pocos_datos' | 'estancado' | 'en_camino';

export interface Projection {
  status: ProjectionStatus;
  /** Cuánto mejora por semana (puede ser negativo). */
  perWeek: number;
  /** Semanas que faltan al ritmo actual, si va en camino. */
  weeks: number | null;
  date: ISODate | null;
}

/**
 * ¿Cuándo se alcanzaría el objetivo al ritmo actual? Ajusta una recta a los registros de los
 * últimos 3 meses. Hacen falta al menos 3 registros separados 2 semanas o más para opinar.
 */
export function projectGoal(points: readonly Point[], target: number, today: ISODate): Projection {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (latest && latest.value >= target) return { status: 'conseguido', perWeek: 0, weeks: 0, date: latest.date };

  const recent = sorted.filter((p) => p.date > addDays(today, -91));
  if (recent.length < 3 || daysBetween(recent[0].date, recent[recent.length - 1].date) < 14) {
    return { status: 'pocos_datos', perWeek: 0, weeks: null, date: null };
  }
  // Regresión lineal: valor en función de los días desde el primer registro.
  const xs = recent.map((p) => daysBetween(recent[0].date, p.date));
  const ys = recent.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const slope = sxx === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx;
  const perWeek = Math.round(slope * 7 * 100) / 100;
  if (perWeek <= 0.01) return { status: 'estancado', perWeek, weeks: null, date: null };

  const weeks = Math.ceil((target - latest.value) / (slope * 7));
  return { status: 'en_camino', perWeek, weeks, date: addDays(today, weeks * 7) };
}

// ---------- Peso tendencial ----------

/** Días que tarda la tendencia en recoger unos dos tercios de un cambio real de peso. */
const TREND_DAYS = 10;

/**
 * Peso tendencial: media suavizada que ignora los altibajos de agua y comida del día.
 * Cada pesada mueve la tendencia según el tiempo pasado desde la anterior.
 */
export function trendWeight(entries: readonly { date: ISODate; weight: number }[]): Point[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: Point[] = [];
  let trend = 0;
  sorted.forEach((e, i) => {
    if (i === 0) trend = e.weight;
    else {
      const gap = Math.max(1, daysBetween(sorted[i - 1].date, e.date));
      trend += (e.weight - trend) * (1 - Math.exp(-gap / TREND_DAYS));
    }
    out.push({ date: e.date, value: Math.round(trend * 100) / 100 });
  });
  return out;
}

/** Cambio semanal de la tendencia en kg, comparando con el punto más cercano a 2–5 semanas atrás. */
export function trendRatePerWeek(trend: readonly Point[]): number | null {
  const last = trend[trend.length - 1];
  if (!last) return null;
  const candidates = trend.filter((p) => {
    const d = daysBetween(p.date, last.date);
    return d >= 14 && d <= 35;
  });
  if (candidates.length === 0) return null;
  const ref = candidates[0];
  return Math.round(((last.value - ref.value) / daysBetween(ref.date, last.date)) * 7 * 100) / 100;
}

// ---------- Racha flexible por semanas ----------

/** Sesiones que se pueden fallar en una semana sin romper la racha. */
export const WEEKLY_PASSES = 1;

export interface WeekTally {
  week: ISODate;
  done: number;
  missed: number;
}

/** Agrupa los días por semana (lunes). Descansos, viajes y días por venir no cuentan. */
export function tallyWeeks(days: readonly { date: ISODate; status: DayStatus }[]): WeekTally[] {
  const map = new Map<ISODate, WeekTally>();
  for (const d of days) {
    const week = weekStart(d.date);
    const t = map.get(week) ?? { week, done: 0, missed: 0 };
    if (d.status === 'done') t.done++;
    if (d.status === 'missed') t.missed++;
    map.set(week, t);
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/** Una semana se cumple si se entrena al menos una vez y no se falla más de lo que cubre el comodín. */
export function weekFulfilled(t: WeekTally): boolean | null {
  if (t.done === 0 && t.missed === 0) return null; // sin sesiones previstas (viaje, descanso): ni suma ni rompe
  return t.done >= 1 && t.missed <= WEEKLY_PASSES;
}

/**
 * Racha de semanas cumplidas. La semana en curso suma en cuanto ya cumple y solo rompe la racha
 * si ya es imposible cumplirla. `weeks` en orden cronológico.
 */
export function weekStreak(weeks: readonly WeekTally[], currentWeek: ISODate): { current: number; best: number; passUsed: boolean } {
  let run = 0;
  let best = 0;
  for (const t of weeks) {
    const ok = weekFulfilled(t);
    const inProgress = t.week === currentWeek;
    if (ok === null) continue;
    if (ok) best = Math.max(best, ++run);
    else if (inProgress && t.missed <= WEEKLY_PASSES) continue; // aún puede cumplirse: no rompe
    else run = 0;
  }
  const now = weeks.find((t) => t.week === currentWeek);
  return { current: run, best, passUsed: (now?.missed ?? 0) >= 1 };
}

// ---------- Revisión semanal ----------

export interface WeekReview {
  done: number;
  missed: number;
  /** Series por músculo de la semana. */
  volume: Record<MuscleGroup, number>;
  records: number;
  stretchDays: number;
  walkedKm: number;
  /** Hay plan de marcha en curso. */
  marchActive: boolean;
  /** Se cumplió la tirada larga del escalón. */
  longWalkDone: boolean;
  weighedIn: boolean;
  /** Cambio semanal del peso tendencial en kg, si se conoce. */
  weightRate: number | null;
  hardSessions: number;
}

export interface Focus {
  title: string;
  detail: string;
}

/**
 * Un único foco para la semana siguiente: la primera regla que se cumple, de más a menos
 * importante. Mejor una sola cosa que se haga que una lista que se ignore.
 */
export function weeklyFocus(r: WeekReview): Focus {
  const planned = r.done + r.missed;
  if (planned > 0 && r.done === 0) {
    return { title: 'Volver a empezar', detail: 'Esta semana no ha salido ninguna sesión. Haz solo la primera de la próxima: lo demás viene detrás.' };
  }
  if (r.missed >= 2) {
    return { title: 'No fallar dos seguidas', detail: `Se han quedado ${r.missed} sesiones sin hacer. Si un día no puedes, muévelo en el calendario en vez de dejarlo pasar.` };
  }
  if (r.done >= 3 && r.hardSessions >= 3) {
    return { title: 'Bajar una marcha', detail: 'Casi todas las sesiones han sido duras. Haz una serie menos por ejercicio y cuida el sueño.' };
  }
  if (r.marchActive && !r.longWalkDone) {
    return { title: 'Hacer la tirada larga', detail: 'Es la caminata que hace avanzar el plan de marcha. Resérvale el día de descanso.' };
  }
  const low = (['pecho', 'biceps'] as const).filter((g) => r.volume[g] < HYPERTROPHY_RANGE.min).sort((a, b) => r.volume[a] - r.volume[b])[0];
  if (low && r.done >= 2) {
    const name = low === 'pecho' ? 'pecho' : 'bíceps';
    return {
      title: `Más series de ${name}`,
      detail: `Has hecho ${String(r.volume[low]).replace('.', ',')} series de ${name}; para crecer conviene llegar a ${HYPERTROPHY_RANGE.min}. No te saltes la sesión que lo trabaja.`,
    };
  }
  if (!r.weighedIn) {
    return { title: 'Pesarte', detail: 'Sin una medición por semana no se puede saber si estás perdiendo grasa.' };
  }
  if (r.weightRate !== null && r.weightRate > 0.1) {
    return { title: 'Revisar lo que comes', detail: 'Tu peso tendencial está subiendo. Para perder grasa necesitas comer algo menos que lo que gastas.' };
  }
  if (r.weightRate !== null && r.weightRate < -0.9) {
    return { title: 'Perder más despacio', detail: 'Estás bajando muy rápido y eso se lleva músculo. Come un poco más, sobre todo proteína.' };
  }
  if (r.stretchDays < 3) {
    return { title: 'Estirar tres días', detail: `Has estirado ${r.stretchDays} ${r.stretchDays === 1 ? 'día' : 'días'}. Usa los 5 minutos de después de cada sesión.` };
  }
  return { title: 'Seguir igual', detail: 'Semana completa. Repite lo que estás haciendo: la constancia es lo que da resultados.' };
}

// ---------- Copia de seguridad fuera del móvil ----------

/** Días que pueden pasar sin sacar una copia fuera del móvil antes de avisar. */
export const BACKUP_EVERY_DAYS = 7;

/**
 * ¿Toca avisar de que hay que sacar una copia? Solo si hay algo que perder,
 * y si nunca se ha hecho o la última tiene más de una semana.
 */
export function backupDue(lastExport: ISODate | null, today: ISODate, hasData: boolean): { due: boolean; detail: string } {
  if (!hasData) return { due: false, detail: '' };
  if (!lastExport) return { due: true, detail: 'Aún no tienes ninguna. Si pierdes el móvil o se desinstala la app, se pierde todo.' };
  const days = daysBetween(lastExport, today);
  if (days < BACKUP_EVERY_DAYS) return { due: false, detail: '' };
  return { due: true, detail: `La última es de hace ${days} días. Lo apuntado desde entonces solo está en este móvil.` };
}
