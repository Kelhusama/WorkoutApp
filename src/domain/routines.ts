import { estimateMinutes, type Pair, type TimedExercise } from './guide';

/**
 * Tres rutinas para la misma sesión, para elegir según el tiempo y el cansancio:
 * - corta: lo esencial, con menos series y sin apurar. No mueve el plan.
 * - media: 20 minutos como mucho. Para que quepan más ejercicios, los que no trabajan los mismos
 *   músculos se hacen en superserie (alternándolos), que ahorra descansos sin quitarle descanso a nadie.
 * - larga: todo, ejercicio a ejercicio y con los descansos enteros.
 * El entrenador apunta lo que se haga en cualquiera de las tres; solo la corta deja el plan como estaba.
 */
export type RoutineSize = 'corta' | 'media' | 'larga';

export const ROUTINE_CAP: Record<Exclude<RoutineSize, 'larga'>, number> = { corta: 10, media: 20 };

export const ROUTINE_INFO: Record<RoutineSize, { title: string; detail: string }> = {
  corta: { title: 'Corta', detail: 'Lo esencial, con menos series y dejando 2 o 3 repeticiones sin hacer. Para días de cansancio: el plan no cambia.' },
  media: { title: 'Media', detail: 'Más ejercicios en menos tiempo: se alternan de dos en dos los que no comparten músculos. El entrenador ajusta según salga.' },
  larga: { title: 'Larga', detail: 'Todo, ejercicio a ejercicio y con los descansos enteros. El entrenador ajusta según salga.' },
};

export interface RoutineItem {
  key: string;
  /** Importancia: 0 es lo primero que no se puede quitar. */
  rank: number;
  /** Lo que se tarda en hacerlo entero y en versión ligera. */
  full: TimedExercise;
  light: TimedExercise;
  /** Grupos musculares que trabaja: dos ejercicios que comparten alguno no se alternan. */
  groups: readonly string[];
  /**
   * Nunca en superserie. Las dominadas son la prioridad y piden llegar frescos a cada serie:
   * se hacen solas y con su descanso entero.
   */
  solo: boolean;
}

export interface Routine {
  size: RoutineSize;
  /** Ejercicios que entran, en el orden de la sesión. */
  keys: string[];
  /** Parejas que se alternan (solo en la rutina media). */
  pairs: [string, string][];
  minutes: number;
  /** Versión ligera: menos series y descansos cortos. */
  light: boolean;
}

/** Mínimo de ejercicios de una rutina, aunque no quepan en el tiempo. */
const MIN_EXERCISES = 2;

/**
 * Empareja ejercicios para alternarlos: cada uno con el siguiente que no comparta ningún músculo.
 * Los que quedan sin pareja, y los marcados como `solo`, se hacen por separado.
 */
export function pairUp(items: readonly Pick<RoutineItem, 'key' | 'groups' | 'solo'>[]): [string, string][] {
  const taken = new Set<string>();
  const pairs: [string, string][] = [];
  for (const a of items) {
    if (a.solo || taken.has(a.key)) continue;
    const b = items.find((x) => x !== a && !x.solo && !taken.has(x.key) && items.indexOf(x) > items.indexOf(a) && !x.groups.some((g) => a.groups.includes(g)));
    if (!b) continue;
    taken.add(a.key);
    taken.add(b.key);
    pairs.push([a.key, b.key]);
  }
  return pairs;
}

function indexPairs(list: readonly RoutineItem[], pairs: readonly [string, string][]): Pair[] {
  const at = (k: string) => list.findIndex((i) => i.key === k);
  return pairs.map(([a, b]) => [at(a), at(b)] as const).filter(([a, b]) => a >= 0 && b >= 0);
}

/** Minutos de una selección de ejercicios, en el orden de la sesión. */
function minutesOf(items: readonly RoutineItem[], keys: ReadonlySet<string>, light: boolean, paired: boolean): { minutes: number; pairs: [string, string][] } {
  const list = items.filter((i) => keys.has(i.key));
  const pairs = paired ? pairUp(list) : [];
  return { minutes: estimateMinutes(list.map((i) => (light ? i.light : i.full)), indexPairs(list, pairs)), pairs };
}

function pick(items: readonly RoutineItem[], cap: number, light: boolean, paired: boolean): Set<string> {
  const chosen = new Set<string>();
  for (const item of [...items].sort((a, b) => a.rank - b.rank)) {
    // Se respeta el orden de importancia: lo que no cabe se salta y se prueba con lo siguiente.
    if (chosen.size < MIN_EXERCISES || minutesOf(items, new Set([...chosen, item.key]), light, paired).minutes <= cap) chosen.add(item.key);
  }
  return chosen;
}

/** Las rutinas posibles para una sesión. Si todo cabe en la media, no hay «larga». */
export function buildRoutines(items: readonly RoutineItem[]): Routine[] {
  const build = (size: RoutineSize, keys: Set<string>, light: boolean, paired: boolean): Routine => ({
    size,
    keys: items.filter((i) => keys.has(i.key)).map((i) => i.key),
    light,
    ...minutesOf(items, keys, light, paired),
  });
  const media = pick(items, ROUTINE_CAP.media, false, true);
  const out = [build('corta', pick(items, ROUTINE_CAP.corta, true, false), true, false), build('media', media, false, true)];
  if (media.size < items.length) out.push(build('larga', new Set(items.map((i) => i.key)), false, false));
  return out;
}

/**
 * Orden de importancia de los ejercicios de una sesión. Los primeros (`fixed`) son siempre los mismos;
 * los demás rotan, para que la pierna y los accesorios vayan entrando por turnos en la rutina media.
 * Cada giro es una versión distinta de la rutina: cambia sola cada semana y también se puede pedir otra.
 */
export function rankKeys(priority: readonly string[], turn: number, fixed = 3): string[] {
  const head = priority.slice(0, fixed);
  const tail = priority.slice(fixed);
  if (tail.length === 0) return head;
  const o = ((turn % tail.length) + tail.length) % tail.length;
  return [...head, ...tail.slice(o), ...tail.slice(0, o)];
}

/** Cuántas versiones distintas tiene la rutina media de una sesión. */
export function versionCount(priority: readonly string[], fixed = 3): number {
  return Math.max(1, priority.length - fixed);
}
