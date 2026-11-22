import type { ISODate } from './dates';

/**
 * Entrenamiento: cualquier cosa que se entrena en un día, sea del tipo que sea.
 * Todos guardan lo mismo (día, tipo, duración, carga y cómo estabas); los detalles propios de cada
 * tipo (series, kilos, kilómetros) viven en su tabla y se enlazan con `source`.
 * En un día puede haber los que sean, también varios del mismo tipo.
 */
export interface Workout {
  id: number;
  date: ISODate;
  /** Tipo de entrenamiento. Es un texto libre: los tipos nuevos no obligan a cambiar la base de datos. */
  type: string;
  /** Cómo se enseña: «Empuje», «Dominadas», «Caminata 8 km»… */
  title: string;
  minutes: number | null;
  load: Load | null;
  state: State | null;
  notes: string | null;
  /** Tabla donde están los detalles, si los tiene. */
  source: string | null;
  sourceId: number | null;
}

/** Carga de la sesión, en tres niveles. */
export type Load = 1 | 2 | 3;
export const LOAD_INFO: Record<Load, { label: string; detail: string }> = {
  1: { label: 'Suave', detail: 'Podrías haber hecho bastante más.' },
  2: { label: 'Media', detail: 'Exigente, pero con margen.' },
  3: { label: 'Fuerte', detail: 'Cerca de tu límite.' },
};
export const LOAD_OPTIONS = ([1, 2, 3] as const).map((id) => ({ id: String(id) as `${Load}`, label: LOAD_INFO[id].label }));

/** Cómo estabas tú ese día, aparte de lo dura que fuera la sesión. */
export type State = 'energia' | 'normal' | 'cansado' | 'molestias';
export const STATE_INFO: Record<State, { label: string; icon: string }> = {
  energia: { label: 'Con energía', icon: 'flash' },
  normal: { label: 'Normal', icon: 'remove-circle-outline' },
  cansado: { label: 'Cansado', icon: 'battery-half' },
  molestias: { label: 'Con molestias', icon: 'medkit-outline' },
};
export const STATE_OPTIONS = (['energia', 'normal', 'cansado', 'molestias'] as const).map((id) => ({ id, label: STATE_INFO[id].label }));

/**
 * Tipos que la app conoce. Para añadir uno nuevo basta con ponerlo aquí: la base de datos no cambia.
 * `counts`: cuenta como haber entrenado ese día. Hoy cuentan todos, estiramientos incluidos.
 */
export const WORKOUT_TYPES: Record<string, { label: string; icon: string; counts: boolean }> = {
  casa: { label: 'Sesión de casa', icon: 'home', counts: true },
  gimnasio: { label: 'Gimnasio', icon: 'barbell', counts: true },
  dominadas: { label: 'Dominadas', icon: 'trophy', counts: true },
  peso_muerto: { label: 'Peso muerto', icon: 'trophy-outline', counts: true },
  caminata: { label: 'Caminata', icon: 'walk', counts: true },
  movilidad: { label: 'Movilidad', icon: 'body', counts: true },
  estiramientos: { label: 'Estiramientos', icon: 'accessibility', counts: true },
  otro: { label: 'Otro deporte', icon: 'fitness', counts: true },
};

export function typeInfo(type: string): { label: string; icon: string; counts: boolean } {
  return WORKOUT_TYPES[type] ?? { label: type, icon: 'fitness', counts: true };
}

/** Tipos que se pueden apuntar «rápido», sin pantalla de detalle. */
export const QUICK_TYPES = ['gimnasio', 'dominadas', 'casa', 'caminata', 'movilidad', 'otro'] as const;

/** ¿Se entrenó ese día? Con cualquier entrenamiento que cuente basta. */
export function trained(workouts: readonly Pick<Workout, 'type'>[]): boolean {
  return workouts.some((w) => typeInfo(w.type).counts);
}

/** «Fuerte · cansado · 25 min». */
export function workoutSummary(w: Pick<Workout, 'minutes' | 'load' | 'state'>): string {
  const parts: string[] = [];
  if (w.load) parts.push(LOAD_INFO[w.load].label);
  if (w.state) parts.push(STATE_INFO[w.state].label.toLowerCase());
  if (w.minutes) parts.push(`${w.minutes} min`);
  return parts.join(' · ');
}

/**
 * Carga de un periodo: la suma de los niveles de cada entrenamiento que cuenta (suave 1, media 2, fuerte 3).
 * Los que no tienen carga apuntada cuentan como media. Sirve para comparar semanas, no como medida exacta.
 */
export function totalLoad(workouts: readonly Pick<Workout, 'type' | 'load'>[]): number {
  return workouts.filter((w) => typeInfo(w.type).counts).reduce((sum, w) => sum + (w.load ?? 2), 0);
}
