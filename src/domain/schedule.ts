import type { ISODate } from './dates';

export type SessionKind = 'A' | 'B' | 'C';
export type DayType = 'gym' | SessionKind | 'rest';
export type DayStatus = 'done' | 'missed' | 'pending' | 'future' | 'rest';

/** Qué se hace un día: gimnasio, sesión en casa o descanso. La sesión A/B/C concreta la reparte la app. */
export type Role = 'gym' | 'casa' | 'rest';
/** Semana tipo de lunes a domingo. */
export type WeekTemplate = readonly Role[];

export const DEFAULT_TEMPLATE: WeekTemplate = ['gym', 'casa', 'casa', 'gym', 'casa', 'rest', 'rest'];
export const MIN_GYM_DAYS = 1;
export const MAX_GYM_DAYS = 4;

export const ROLE_INFO: Record<Role, { label: string; icon: string }> = {
  gym: { label: 'Gimnasio', icon: 'barbell' },
  casa: { label: 'Casa', icon: 'home' },
  rest: { label: 'Descanso', icon: 'moon' },
};

/** Orden de preferencia al repartir sesiones de casa. */
const KIND_ORDER: SessionKind[] = ['B', 'A', 'C'];

/**
 * Reparte las sesiones de casa de una semana.
 * - Regla R1: nunca tirón (A) el día siguiente al gimnasio (también desde el domingo anterior).
 * - Los días ya registrados mantienen su sesión (`pinned`) para no descolocar el historial.
 * - Con más de 3 días de casa, el ciclo B → A → C se repite.
 */
export function assignKinds(
  roles: readonly Role[],
  prevDayRole: Role = 'rest',
  pinned: readonly (SessionKind | null)[] = [],
): DayType[] {
  const pinnedKinds = pinned.filter((k): k is SessionKind => k != null);
  let queue: SessionKind[] = KIND_ORDER.filter((k) => !pinnedKinds.includes(k));
  const refill = () => {
    queue = [...KIND_ORDER];
  };

  return roles.map((role, i) => {
    if (role !== 'casa') return role;
    const fixed = pinned[i];
    if (fixed) return fixed;
    if (queue.length === 0) refill();
    const afterGym = (i === 0 ? prevDayRole : roles[i - 1]) === 'gym';
    const idx = queue.findIndex((k) => !(afterGym && k === 'A'));
    const pick = idx >= 0 ? idx : 0;
    const kind = afterGym && queue[pick] === 'A' ? 'B' : queue[pick];
    queue.splice(pick, 1);
    return kind;
  });
}

export function countGym(t: readonly Role[]): number {
  return t.filter((r) => r === 'gym').length;
}

export function isValidTemplate(t: readonly Role[]): boolean {
  const g = countGym(t);
  return t.length === 7 && g >= MIN_GYM_DAYS && g <= MAX_GYM_DAYS;
}

export function parseTemplate(s: string | null | undefined): WeekTemplate {
  const parts = (s ?? '').split(',');
  if (parts.length === 7 && parts.every((p) => p === 'gym' || p === 'casa' || p === 'rest')) return parts as Role[];
  return DEFAULT_TEMPLATE;
}

export function roleOf(type: DayType): Role {
  return type === 'gym' ? 'gym' : type === 'rest' ? 'rest' : 'casa';
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
