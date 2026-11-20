import type { ISODate } from './dates';

export type SessionKind = 'A' | 'B' | 'C';
export type DayType = 'gym' | SessionKind | 'movilidad' | 'rest';
/** 'excused' = día de viaje pasado sin entrenar: no cuenta como fallo (R3). */
export type DayStatus = 'done' | 'missed' | 'pending' | 'future' | 'rest' | 'excused';

/**
 * Qué se hace un día: gimnasio, sesión en casa, movilidad (flexibilidad y estiramientos, sin carga)
 * o descanso. La sesión de casa concreta la reparte la app.
 */
export type Role = 'gym' | 'casa' | 'movilidad' | 'rest';
/** Semana tipo de lunes a domingo. */
export type WeekTemplate = readonly Role[];

export const DEFAULT_TEMPLATE: WeekTemplate = ['gym', 'casa', 'casa', 'gym', 'casa', 'rest', 'rest'];
export const MIN_GYM_DAYS = 1;
export const MAX_GYM_DAYS = 4;

export const ROLE_INFO: Record<Role, { label: string; icon: string }> = {
  gym: { label: 'Gimnasio', icon: 'barbell' },
  casa: { label: 'Casa', icon: 'home' },
  movilidad: { label: 'Movilidad', icon: 'body' },
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
  if (parts.length === 7 && parts.every((p) => p === 'gym' || p === 'casa' || p === 'movilidad' || p === 'rest')) return parts as Role[];
  return DEFAULT_TEMPLATE;
}

export function roleOf(type: DayType): Role {
  return type === 'gym' || type === 'rest' || type === 'movilidad' ? type : 'casa';
}

/** Estado de un día según su registro. Un día pasado sin registro cuenta como fallado (R2). */
export function dayStatus(
  type: DayType,
  date: ISODate,
  todayDate: ISODate,
  logged?: 'done' | 'missed',
  travelling = false,
): DayStatus {
  if (logged) return logged;
  if (type === 'rest') return 'rest';
  // La movilidad es recuperación: si un día no se hace, no cuenta como fallo.
  if (type === 'movilidad') return date === todayDate ? 'pending' : date > todayDate ? 'future' : 'rest';
  if (date < todayDate) return travelling ? 'excused' : 'missed';
  if (date === todayDate) return 'pending';
  return 'future';
}

export const SESSION_INFO: Record<DayType, { title: string; subtitle: string; icon: string }> = {
  A: { title: 'Tirón', subtitle: 'Dominadas · bíceps · gemelo y tibial', icon: 'arrow-down-circle' },
  B: { title: 'Empuje', subtitle: 'Pecho · hombro · aductores', icon: 'arrow-up-circle' },
  C: { title: 'Mixta suave', subtitle: 'Dominadas · hombro · pierna', icon: 'sync-circle' },
  gym: { title: 'Gimnasio', subtitle: 'Tu rutina + press de banca', icon: 'barbell' },
  movilidad: { title: 'Movilidad', subtitle: 'Flexibilidad y estiramientos: recuperas sin sumar carga', icon: 'body' },
  rest: { title: 'Descanso', subtitle: 'Recupera: aquí también se crece', icon: 'moon' },
};

/** ¿Es una sesión de fuerza en casa? */
export function isHomeKind(type: DayType): type is SessionKind {
  return type === 'A' || type === 'B' || type === 'C';
}

/**
 * Con mucho gimnasio quedan pocos días de casa. Si son uno o dos, cada uno se dedica
 * solo a los objetivos (dominadas, flexiones y bíceps) en vez de repartir tirón, empuje y mixta.
 */
export const FOCUS_MAX_HOME_DAYS = 2;

export function isFocusWeek(roles: readonly Role[]): boolean {
  const home = roles.filter((r) => r === 'casa').length;
  return home >= 1 && home <= FOCUS_MAX_HOME_DAYS;
}

export const FOCUS_INFO = { title: 'Tren superior', subtitle: 'Dominadas · flexiones · bíceps, sin relleno', icon: 'flame' };

/** Título, subtítulo e icono de un día, teniendo en cuenta si la sesión de casa es la enfocada. */
export function infoFor(type: DayType, focus = false) {
  return focus && isHomeKind(type) ? FOCUS_INFO : SESSION_INFO[type];
}
