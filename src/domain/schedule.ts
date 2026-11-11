import { addDays, weekdayIndex, type ISODate } from './dates';

export type SessionKind = 'A' | 'B' | 'C';
export type DayType = 'gym' | SessionKind | 'rest';
/** Segundo día de gimnasio de la semana. */
export type SecondGymDay = 'X' | 'J';
export type DayStatus = 'done' | 'missed' | 'pending' | 'future' | 'rest';

/**
 * Semanas tipo (lunes → domingo).
 * Regla R1: nunca un tirón fuerte (A) el día siguiente al gimnasio.
 */
export const WEEK_PATTERNS: Record<SecondGymDay, readonly DayType[]> = {
  J: ['gym', 'B', 'A', 'gym', 'C', 'rest', 'rest'],
  X: ['gym', 'B', 'gym', 'C', 'A', 'rest', 'rest'],
};

export const DEFAULT_SECOND_GYM: SecondGymDay = 'J';

export function dayTypeFor(date: ISODate, secondGym: SecondGymDay): DayType {
  return WEEK_PATTERNS[secondGym][weekdayIndex(date)];
}

export function weekPlan(monday: ISODate, secondGym: SecondGymDay) {
  return WEEK_PATTERNS[secondGym].map((type, i) => ({ date: addDays(monday, i), type }));
}

/** Estado de un día según su registro. Un día pasado sin registro cuenta como fallado (R2). */
export function dayStatus(
  type: DayType,
  date: ISODate,
  todayDate: ISODate,
  logged?: 'done' | 'missed',
): DayStatus {
  if (logged) return logged;
  if (type === 'rest') return 'rest';
  if (date < todayDate) return 'missed';
  if (date === todayDate) return 'pending';
  return 'future';
}

export const SESSION_INFO: Record<DayType, { title: string; subtitle: string; icon: string }> = {
  A: { title: 'Tirón', subtitle: 'Dominadas · bíceps · espalda', icon: 'arrow-down-circle' },
  B: { title: 'Empuje', subtitle: 'Pecho · hombro · antebrazo', icon: 'arrow-up-circle' },
  C: { title: 'Mixta suave', subtitle: 'Dominadas · hombro · bíceps', icon: 'sync-circle' },
  gym: { title: 'Gimnasio', subtitle: 'Tu rutina + press de banca', icon: 'barbell' },
  rest: { title: 'Descanso', subtitle: 'Recupera: aquí también se crece', icon: 'moon' },
};
