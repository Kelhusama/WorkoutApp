import type { Point } from './body';
import { addDays, fromISODate, weekStart, type ISODate } from './dates';

/**
 * Flexibilidad: programa de 10 ejercicios en 3 niveles y seis tests mensuales.
 * Todo sale de docs/INVESTIGACION.md, sección «2. Flexibilidad».
 */
export type FlexLevel = 1 | 2 | 3;
export type FlexMethod = 'estatico' | 'contraer-relajar' | 'cargado' | 'excentrico';
export type FlexZone = 'aductores' | 'isquios' | 'cadera' | 'tobillo' | 'hombro' | 'espalda';

export const FLEX_LEVELS: FlexLevel[] = [1, 2, 3];

export const METHOD_LABEL: Record<FlexMethod, string> = {
  estatico: 'Estático',
  'contraer-relajar': 'Contraer-relajar',
  cargado: 'Cargado',
  excentrico: 'Excéntrico',
};

/** Qué hacer mientras dura el paso, según el método. */
export const METHOD_HINT: Record<FlexMethod, string> = {
  estatico: 'Tirantez suave, sin dolor. Respira lento.',
  'contraer-relajar': 'Tras apretar, suelta el aire y gana un poco más de rango.',
  cargado: 'Movimiento controlado hasta el final del recorrido.',
  excentrico: 'Baja despacio y sube a ritmo normal.',
};

export const FLEX_ZONE_LABEL: Record<FlexZone, string> = {
  aductores: 'Aductores',
  isquios: 'Isquiotibiales',
  cadera: 'Flexores de cadera',
  tobillo: 'Cadera y tobillo',
  hombro: 'Hombro',
  espalda: 'Espalda alta',
};

/** Segundos de contracción en cada ciclo de contraer-relajar. */
export const CONTRACT_SECONDS = 6;

export interface FlexDose {
  sets: number;
  method: FlexMethod;
  /** Repeticiones por serie, si el ejercicio se cuenta. */
  reps?: number;
  /** Segundos mantenidos por serie (tras las repeticiones, si las hay). */
  hold?: number;
  /** Segundos de contracción antes de mantener (contraer-relajar). */
  contract?: number;
  perSide: boolean;
  /** Segundos que se calculan por repetición, para estimar la duración. */
  repSeconds?: number;
  /** Matiz del nivel: «con apoyo», «bajada de 3 s»… */
  note?: string;
  /** Nombre y dibujo propios del nivel, si cambian. */
  name?: string;
  figure?: string;
}

export interface FlexExercise {
  id: string;
  /** Número en la tabla del programa (1–10). */
  n: number;
  name: string;
  zone: FlexZone;
  cues: string[];
  mistake: string;
  /** Dibujo de `ILLUSTRATIONS`, si hay una postura que encaje. */
  figure?: string;
  levels: Record<FlexLevel, FlexDose>;
}

const hold = (sets: number, seconds: number, perSide: boolean, extra: Partial<FlexDose> = {}): FlexDose => ({
  sets,
  hold: seconds,
  perSide,
  method: 'estatico',
  ...extra,
});
const pnf = (sets: number, seconds: number, perSide: boolean, extra: Partial<FlexDose> = {}): FlexDose => ({
  sets,
  hold: seconds,
  contract: CONTRACT_SECONDS,
  perSide,
  method: 'contraer-relajar',
  ...extra,
});
const reps = (sets: number, n: number, perSide: boolean, method: FlexMethod, repSeconds: number, extra: Partial<FlexDose> = {}): FlexDose => ({
  sets,
  reps: n,
  perSide,
  method,
  repSeconds,
  ...extra,
});

export const FLEX_EXERCISES: FlexExercise[] = [
  {
    id: 'rana_mariposa',
    n: 1,
    name: 'Mariposa y rana',
    zone: 'aductores',
    cues: ['Espalda larga, sin encorvarte', 'Deja que las rodillas se abran por su propio peso', 'Respira lento y suelta un poco más al soltar el aire'],
    mistake: 'Rebotar con las rodillas',
    figure: 'est_mariposa',
    levels: {
      1: hold(2, 30, false, { name: 'Mariposa' }),
      2: pnf(2, 45, false, { name: 'Mariposa con contracción', note: 'aprieta las rodillas contra las manos' }),
      3: hold(2, 60, false, { name: 'Rana profunda', figure: 'est_rana', note: 'rodillas muy separadas y cadera atrás' }),
    },
  },
  {
    id: 'cosaca',
    n: 2,
    name: 'Zancada lateral cosaca',
    zone: 'aductores',
    cues: ['Baja sobre una pierna con la otra estirada', 'Talón de la pierna doblada pegado al suelo', 'Pecho alto y cadera atrás'],
    mistake: 'Meter hacia dentro la rodilla doblada',
    figure: 'est_cosaco',
    levels: {
      1: reps(2, 6, true, 'cargado', 4, { note: 'con apoyo de las manos' }),
      2: reps(2, 8, true, 'cargado', 4, { note: 'sin apoyo' }),
      3: reps(2, 6, true, 'cargado', 6, { note: 'pausa de 3 s abajo' }),
    },
  },
  {
    id: 'isquios_tumbado',
    n: 3,
    name: 'Isquios tumbado',
    zone: 'isquios',
    cues: ['Boca arriba, sube una pierna recta', 'Sujétala por detrás del muslo', 'La otra pierna, estirada en el suelo'],
    mistake: 'Despegar la cadera del suelo',
    figure: 'est_isquios',
    levels: {
      1: hold(2, 30, true),
      2: pnf(2, 30, true, { note: 'empuja la pierna contra las manos' }),
      3: pnf(2, 40, true, { note: 'empuja la pierna contra las manos' }),
    },
  },
  {
    id: 'buenos_dias',
    n: 4,
    name: 'Buenos días con bajada lenta',
    zone: 'isquios',
    cues: ['De pie, rodillas apenas dobladas', 'Lleva la cadera atrás con la espalda recta', 'Baja hasta notar tirantez detrás del muslo'],
    mistake: 'Redondear la espalda para bajar más',
    levels: {
      1: reps(2, 8, false, 'excentrico', 5, { note: 'bajada de 3 s' }),
      2: reps(2, 10, false, 'excentrico', 7, { note: 'bajada de 5 s' }),
      3: reps(2, 6, true, 'excentrico', 5, { name: 'Buenos días a una pierna', note: 'bajada lenta' }),
    },
  },
  {
    id: 'zancada_baja',
    n: 5,
    name: 'Zancada baja',
    zone: 'cadera',
    cues: ['Rodilla de atrás en el suelo', 'Aprieta el glúteo de esa pierna', 'Lleva la cadera hacia delante sin arquearte'],
    mistake: 'Arquear la zona lumbar',
    figure: 'est_zancada',
    levels: {
      1: hold(2, 30, true),
      2: hold(2, 45, true),
      3: hold(2, 45, true, { name: 'Estiramiento del sofá', note: 'empeine de atrás apoyado en el sofá o la pared' }),
    },
  },
  {
    id: 'sentadilla_profunda',
    n: 6,
    name: 'Sentadilla profunda mantenida',
    zone: 'tobillo',
    cues: ['Pies algo más abiertos que la cadera', 'Talones pegados al suelo', 'Pecho alto; empuja las rodillas hacia fuera con los codos'],
    mistake: 'Levantar los talones',
    levels: {
      1: hold(3, 20, false, { note: 'agarrado a algo firme' }),
      2: hold(2, 45, false),
      3: hold(2, 90, false, { note: 'entre 60 y 120 s, lo que aguantes bien' }),
    },
  },
  {
    id: 'rodilla_pared',
    n: 7,
    name: 'Rodilla a la pared',
    zone: 'tobillo',
    cues: ['Pie apuntando recto a la pared', 'Lleva la rodilla a tocar la pared sobre el segundo dedo', 'Talón pegado al suelo todo el tiempo'],
    mistake: 'Despegar el talón',
    levels: {
      1: reps(2, 10, true, 'cargado', 3),
      2: reps(2, 10, true, 'cargado', 3, { hold: 20, note: 'mantén la última' }),
      3: hold(2, 30, true),
    },
  },
  {
    id: 'dorsal_pectoral',
    n: 8,
    name: 'Dorsal y pectoral en la pared',
    zone: 'hombro',
    cues: ['Manos en la pared a la altura de la cadera', 'Da pasos atrás y hunde el pecho hacia el suelo', 'Brazos estirados y cuello largo'],
    mistake: 'Arquear la zona lumbar',
    levels: {
      1: hold(2, 30, false),
      2: hold(2, 45, false),
      3: pnf(2, 30, false, { note: 'empuja las manos contra la pared' }),
    },
  },
  {
    id: 'deslizamientos_pared',
    n: 9,
    name: 'Deslizamientos en la pared',
    zone: 'espalda',
    cues: ['Espalda, cabeza y brazos pegados a la pared', 'Sube los brazos sin despegar codos ni muñecas', 'Costillas abajo'],
    mistake: 'Arquear la espalda para llegar arriba',
    levels: {
      1: reps(2, 8, false, 'cargado', 4),
      2: reps(2, 10, false, 'cargado', 4),
      3: reps(2, 12, false, 'cargado', 6, { note: 'pausa de 2 s arriba' }),
    },
  },
  {
    id: 'durmiente',
    n: 10,
    name: 'Durmiente o toalla tras la espalda',
    zone: 'hombro',
    cues: ['De lado, brazo de abajo al frente con el codo a 90°', 'Con la otra mano, baja el antebrazo hacia el suelo', 'Si molesta, usa la toalla tras la espalda y tira suave'],
    mistake: 'Forzar hasta notar pinchazo en el hombro',
    levels: {
      1: hold(2, 30, true),
      2: hold(2, 45, true),
      3: pnf(2, 30, true, { note: 'empuja el antebrazo contra la mano' }),
    },
  },
];

export const FLEX_BY_ID: Record<string, FlexExercise> = Object.fromEntries(FLEX_EXERCISES.map((e) => [e.id, e]));

/** Nombre y dibujo del ejercicio en un nivel dado. */
export function exerciseAt(ex: FlexExercise, level: FlexLevel): { name: string; figure?: string; dose: FlexDose } {
  const dose = ex.levels[level];
  return { name: dose.name ?? ex.name, figure: dose.figure ?? ex.figure, dose };
}

/** «2 × 30 s por lado», «2 ciclos de 6 s de contracción + 30 s»… */
export function doseText(d: FlexDose): string {
  let base: string;
  if (d.contract) base = `${d.sets} ciclos de ${d.contract} s de contracción + ${d.hold} s`;
  else if (d.reps && d.hold) base = `${d.sets} × ${d.reps} + ${d.hold} s`;
  else if (d.reps) base = `${d.sets} × ${d.reps}`;
  else base = `${d.sets} × ${d.hold} s`;
  return `${base}${d.perSide ? ' por lado' : ''}${d.note ? `, ${d.note}` : ''}`;
}

// ---------- Sesión ----------

/** Los ejercicios 1–5 van siempre; del 6 al 10 rotan. */
const FIXED = FLEX_EXERCISES.filter((e) => e.n <= 5);
const ROTATING = FLEX_EXERCISES.filter((e) => e.n > 5);

/** Ejercicios rotatorios por sesión: dos en el nivel 1 y uno después, que las series ya son más largas. */
export function rotatingCount(level: FlexLevel): number {
  return level === 1 ? 2 : 1;
}

/** Ejercicios de la sesión número `sessionCount` (0 = la primera). Siempre los mismos para el mismo número. */
export function sessionExercises(level: FlexLevel, sessionCount: number): FlexExercise[] {
  const k = rotatingCount(level);
  const n = Math.max(0, Math.floor(sessionCount));
  const extra = Array.from({ length: k }, (_, i) => ROTATING[(n * k + i) % ROTATING.length]);
  return [...FIXED, ...extra];
}

export interface FlexStep {
  exerciseId: string;
  set: number;
  sets: number;
  /** 1 o 2 si va por lados; `null` si no. */
  side: 1 | 2 | null;
  reps: number;
  contract: number;
  hold: number;
  /** Segundos que cuenta el paso completo (las repeticiones, estimadas). */
  seconds: number;
}

export function exerciseSteps(ex: FlexExercise, level: FlexLevel): FlexStep[] {
  const d = ex.levels[level];
  const repsN = d.reps ?? 0;
  const contract = d.contract ?? 0;
  const holdS = d.hold ?? 0;
  const seconds = repsN * (d.repSeconds ?? 4) + contract + holdS;
  const out: FlexStep[] = [];
  for (let set = 1; set <= d.sets; set++) {
    for (const side of d.perSide ? ([1, 2] as const) : ([null] as const)) {
      out.push({ exerciseId: ex.id, set, sets: d.sets, side, reps: repsN, contract, hold: holdS, seconds });
    }
  }
  return out;
}

export function sessionSteps(exercises: readonly FlexExercise[], level: FlexLevel): FlexStep[] {
  return exercises.flatMap((e) => exerciseSteps(e, level));
}

/** Pausa para colocarse antes de cada paso. */
export const FLEX_PREP_SECONDS = 5;

export type FlexPhase = 'prep' | 'reps' | 'contract' | 'hold';

/** Fase que sigue dentro del mismo paso de la sesión guiada, o `null` si el paso ha terminado. */
export function nextPhase(step: FlexStep, phase: FlexPhase): FlexPhase | null {
  const order: FlexPhase[] = ['prep', 'reps', 'contract', 'hold'];
  const has: Record<FlexPhase, boolean> = { prep: true, reps: step.reps > 0, contract: step.contract > 0, hold: step.hold > 0 };
  return order.slice(order.indexOf(phase) + 1).find((p) => has[p]) ?? null;
}

/** Segundos que suma una fase al completarla; la preparación no cuenta. */
export function phaseSeconds(step: FlexStep, phase: FlexPhase): number {
  if (phase === 'prep') return 0;
  if (phase === 'contract') return step.contract;
  if (phase === 'hold') return step.hold;
  return step.seconds - step.contract - step.hold;
}

export function sessionMinutes(steps: readonly FlexStep[]): number {
  return Math.round(steps.reduce((a, s) => a + s.seconds + FLEX_PREP_SECONDS, 0) / 60);
}

// ---------- Adherencia y niveles ----------

export const WEEKLY_TARGET = 3;
export const WEEKLY_MAX = 5;
export const BLOCK_WEEKS = 4;
export const BLOCK_DAYS = BLOCK_WEEKS * 7;
/** Sesiones previstas en un bloque: 3 por semana. */
export const BLOCK_PLANNED = BLOCK_WEEKS * WEEKLY_TARGET;
/** Sesiones para subir de nivel: el 80 % de las previstas. */
export const BLOCK_PASS = Math.ceil(BLOCK_PLANNED * 0.8);

const uniqueSorted = (dates: readonly ISODate[]): ISODate[] => [...new Set(dates)].sort();

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

export interface WeekAdherence {
  /** Días con sesión esta semana (de lunes a domingo). */
  done: number;
  target: number;
  met: boolean;
  /** «2 de 3 esta semana». */
  label: string;
}

/** Adherencia semanal: cuenta días, no una racha que se rompe por un fallo. */
export function weekAdherence(sessionDates: readonly ISODate[], today: ISODate): WeekAdherence {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const done = uniqueSorted(sessionDates).filter((d) => d >= monday && d <= sunday).length;
  return { done, target: WEEKLY_TARGET, met: done >= WEEKLY_TARGET, label: `${done} de ${WEEKLY_TARGET} esta semana` };
}

export interface FlexState {
  level: FlexLevel;
  blockStart: ISODate;
}

export interface FlexProgress extends FlexState {
  /** Días con sesión en el bloque actual. */
  sessionsInBlock: number;
  /** 1–4. */
  weekInBlock: number;
  /** El nivel ha subido respecto al estado de partida. */
  changed: boolean;
  /** Último bloque cerrado en este cálculo, si lo hay. */
  lastBlock: { sessions: number; passed: boolean } | null;
}

/**
 * Nivel y bloque actuales. Cada bloque dura 4 semanas: con el 80 % de las 12 sesiones previstas
 * se sube de nivel; si no, se repite. Un bloque sin ninguna sesión no cuenta como intento:
 * el siguiente empieza el día en que se vuelve.
 */
export function flexProgress(sessionDates: readonly ISODate[], start: FlexState | null, today: ISODate): FlexProgress {
  const dates = uniqueSorted(sessionDates);
  const initial: FlexLevel = start?.level ?? 1;
  let level = initial;
  let blockStart = start?.blockStart ?? dates[0] ?? today;
  if (blockStart > today) blockStart = today;
  let lastBlock: FlexProgress['lastBlock'] = null;

  while (addDays(blockStart, BLOCK_DAYS) <= today) {
    const next = addDays(blockStart, BLOCK_DAYS);
    const from = blockStart;
    const n = dates.filter((d) => d >= from && d < next).length;
    const passed = n >= BLOCK_PASS;
    if (passed && level < 3) level = (level + 1) as FlexLevel;
    lastBlock = { sessions: n, passed };
    const back = n === 0 ? (dates.find((d) => d >= next) ?? today) : next;
    blockStart = back > today ? today : back;
  }

  const from = blockStart;
  const end = addDays(blockStart, BLOCK_DAYS);
  return {
    level,
    blockStart,
    sessionsInBlock: dates.filter((d) => d >= from && d < end).length,
    weekInBlock: Math.min(BLOCK_WEEKS, Math.floor(daysBetween(blockStart, today) / 7) + 1),
    changed: level !== initial,
    lastBlock,
  };
}

// ---------- Tests mensuales ----------

export type FlexTestId = 'dedos_suelo' | 'rodilla_pared' | 'apertura' | 'rascado' | 'pierna_recta' | 'sentadilla';
export type FlexUnit = 'cm' | '°' | 's';

export interface FlexTest {
  id: FlexTestId;
  name: string;
  measures: string;
  /** Protocolo, paso a paso. */
  steps: string[];
  unit: FlexUnit;
  higherIsBetter: boolean;
  reference: string;
  /** Cambio mínimo que no se explica por el error de medida, si la investigación lo da. */
  realChange?: number;
  /** Valores admitidos. */
  min: number;
  max: number;
  decimals: 0 | 1;
  /** Si el valor puede ser negativo: qué significa cada signo, para elegirlo sin teclear el «−». */
  sign?: { positive: string; negative: string };
}

/** Días entre tests. */
export const TEST_EVERY_DAYS = 28;

const COMMON = 'Hazlo a la misma hora, tras 5 minutos de calentamiento.';
const BEST3 = 'Haz tres intentos y apunta el mejor.';

export const FLEX_TESTS: FlexTest[] = [
  {
    id: 'dedos_suelo',
    name: 'Dedos-suelo',
    measures: 'Isquiotibiales y zona lumbar',
    steps: [
      COMMON,
      'De pie y descalzo, con los pies juntos y las rodillas rectas.',
      'Baja despacio con las manos juntas hacia el suelo, sin rebotes.',
      'Mide los centímetros entre la punta de los dedos y el suelo.',
      'Si tocas el suelo, apunta 0. Si pasas de él (subido a un escalón), elige «Paso del suelo».',
      BEST3,
    ],
    unit: 'cm',
    higherIsBetter: false,
    reference: 'Tocar el suelo (0 cm) es lo normal. Un cambio de 4,5 cm o más es real.',
    realChange: 4.5,
    min: -30,
    max: 70,
    decimals: 1,
    sign: { positive: 'No llego al suelo', negative: 'Paso del suelo' },
  },
  {
    id: 'rodilla_pared',
    name: 'Rodilla a la pared',
    measures: 'Movilidad del tobillo',
    steps: [
      COMMON,
      'Descalzo, de cara a la pared, con un pie apuntando recto hacia ella.',
      'Lleva la rodilla a tocar la pared sin despegar el talón.',
      'Aleja el pie poco a poco hasta la mayor distancia a la que aún tocas.',
      'Mide los centímetros entre el dedo gordo y la pared.',
      'Apunta el lado que peor vaya, siempre el mismo.',
    ],
    unit: 'cm',
    higherIsBetter: true,
    reference: 'Lo habitual es 8–14 cm; menos de 5 cm es limitado. Un cambio de unos 2 cm es real.',
    realChange: 2,
    min: 0,
    max: 30,
    decimals: 1,
  },
  {
    id: 'apertura',
    name: 'Apertura sentado',
    measures: 'Aductores',
    steps: [
      COMMON,
      'Siéntate en el suelo con la espalda recta, mejor apoyada en la pared.',
      'Abre las piernas todo lo que puedas con las rodillas rectas.',
      'Mide los centímetros entre los dos talones, por dentro.',
      BEST3,
    ],
    unit: 'cm',
    higherIsBetter: true,
    reference: 'No hay valores de referencia: compárate contigo.',
    min: 20,
    max: 250,
    decimals: 0,
  },
  {
    id: 'rascado',
    name: 'Rascado de espalda',
    measures: 'Movilidad del hombro',
    steps: [
      COMMON,
      'De pie, lleva una mano por encima del hombro y la otra por debajo, hacia el centro de la espalda.',
      'Intenta que los dedos corazón se toquen o se solapen.',
      'Pide que te midan (o hazte una foto) los centímetros que se solapan o que faltan.',
      'Usa siempre el mismo brazo arriba.',
    ],
    unit: 'cm',
    higherIsBetter: true,
    reference: 'Es positivo si los dedos se solapan; 0 si se tocan justo.',
    min: -60,
    max: 30,
    decimals: 1,
    sign: { positive: 'Se tocan o se solapan', negative: 'No se tocan' },
  },
  {
    id: 'pierna_recta',
    name: 'Elevación activa de pierna recta',
    measures: 'Isquiotibiales, sin ayuda de las manos',
    steps: [
      COMMON,
      'Túmbate boca arriba con las dos piernas estiradas.',
      'Sube una pierna recta todo lo que puedas, sin doblar la rodilla y sin despegar la otra del suelo.',
      'Mide el ángulo entre la pierna y el suelo: apoya el móvil en la espinilla con una app de nivel, o hazte una foto de lado.',
      'Apunta el lado que peor vaya, siempre el mismo.',
    ],
    unit: '°',
    higherIsBetter: true,
    reference: 'Por convención, lo normal son 70–80°.',
    min: 0,
    max: 130,
    decimals: 0,
  },
  {
    id: 'sentadilla',
    name: 'Sentadilla profunda mantenida',
    measures: 'Cadera y tobillo',
    steps: [
      COMMON,
      'Baja a una sentadilla completa, con los talones en el suelo y sin agarrarte a nada.',
      'Cronometra cuánto aguantas cómodo, sin dolor y sin levantar los talones.',
      'Un solo intento. Para al llegar a 5 minutos.',
    ],
    unit: 's',
    higherIsBetter: true,
    reference: 'Meta habitual: 2 minutos (120 s).',
    min: 0,
    max: 600,
    decimals: 0,
  },
];

export const FLEX_TEST_BY_ID: Record<string, FlexTest> = Object.fromEntries(FLEX_TESTS.map((t) => [t.id, t]));

export function isFlexTestId(id: unknown): id is FlexTestId {
  return typeof id === 'string' && id in FLEX_TEST_BY_ID;
}

export interface FlexResult {
  id?: number;
  date: ISODate;
  testId: string;
  value: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** «12,5 cm», «75°», «90 s». */
export function formatFlexValue(test: FlexTest, value: number, signed = false): string {
  const v = round1(value);
  const text = `${signed && v > 0 ? '+' : ''}${String(v).replace('.', ',').replace('-', '−')}`;
  return test.unit === '°' ? `${text}°` : `${text} ${test.unit}`;
}

/** Comprueba un valor tecleado. Devuelve el motivo si no vale, o `null` si es correcto. */
export function validateFlexValue(test: FlexTest, value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return 'Escribe el resultado para poder guardar.';
  if (value < test.min || value > test.max) {
    return `El valor debe estar entre ${formatFlexValue(test, test.min)} y ${formatFlexValue(test, test.max)}.`;
  }
  return null;
}

const better = (test: FlexTest, a: number, b: number) => (test.higherIsBetter ? Math.max(a, b) : Math.min(a, b));

/** Un punto por día (el mejor de ese día), en orden de fecha. */
export function testSeries(results: readonly FlexResult[], test: FlexTest): Point[] {
  const byDate = new Map<ISODate, number>();
  for (const r of results) {
    if (r.testId !== test.id) continue;
    const cur = byDate.get(r.date);
    byDate.set(r.date, cur === undefined ? r.value : better(test, cur, r.value));
  }
  return [...byDate.keys()].sort().map((date) => ({ date, value: byDate.get(date)! }));
}

export function bestValue(series: readonly Point[], test: FlexTest): number | null {
  return series.length === 0 ? null : series.reduce((a, p) => better(test, a, p.value), series[0].value);
}

/** ¿Supera el cambio el error de medida? `null` si la investigación no da umbral para este test. */
export function exceedsError(test: FlexTest, change: number): boolean | null {
  return test.realChange === undefined ? null : Math.abs(change) >= test.realChange;
}

/** ¿Toca repetir el test? Sí si nunca se ha hecho o han pasado más de 28 días. */
export function testDue(series: readonly Point[], today: ISODate): boolean {
  if (series.length === 0) return true;
  return daysBetween(series[series.length - 1].date, today) > TEST_EVERY_DAYS;
}

export interface TestSummary {
  test: FlexTest;
  series: Point[];
  first: Point | null;
  latest: Point | null;
  best: number | null;
  /** Último menos primero, en la unidad del test; `null` con menos de dos mediciones. */
  change: number | null;
  /** El mismo cambio con signo de mejora: positivo = mejor. */
  improvement: number | null;
  /** `true` si el cambio supera el error de medida; `null` si no hay umbral o no hay cambio que juzgar. */
  real: boolean | null;
  due: boolean;
}

export function testSummary(results: readonly FlexResult[], test: FlexTest, today: ISODate): TestSummary {
  const series = testSeries(results, test);
  const first = series[0] ?? null;
  const latest = series[series.length - 1] ?? null;
  const change = series.length >= 2 ? round1(latest!.value - first!.value) : null;
  const improvement = change === null ? null : test.higherIsBetter ? change : round1(-change);
  return {
    test,
    series,
    first,
    latest,
    best: bestValue(series, test),
    change,
    improvement,
    real: change === null ? null : exceedsError(test, change),
    due: testDue(series, today),
  };
}

/** «Mejoras 6 cm desde el primer test» y si el cambio es real. */
export function changeText(s: TestSummary): string | null {
  if (s.improvement === null || s.change === null) return null;
  if (s.improvement === 0) return 'Igual que en el primer test.';
  const amount = formatFlexValue(s.test, Math.abs(s.change));
  const base = s.improvement > 0 ? `Mejoras ${amount} desde el primer test` : `${amount} peor que en el primer test`;
  if (s.real === true) return `${base}. Es un cambio real.`;
  if (s.real === false) return `${base}. Aún dentro del error de medida.`;
  return `${base}.`;
}

export function anyTestDue(results: readonly FlexResult[], today: ISODate): boolean {
  return FLEX_TESTS.some((t) => testDue(testSeries(results, t), today));
}

// ---------- Hitos ----------

export interface Milestone {
  id: 'palmas' | 'sentadilla' | 'dedos_espalda' | 'apertura';
  label: string;
  reached: boolean;
  /** Cuánto falta, o qué hay que medir. */
  detail: string;
}

export const SQUAT_GOAL_SECONDS = 120;
export const SPLIT_GOAL_CM = 20;

export function milestones(results: readonly FlexResult[]): Milestone[] {
  const of = (id: FlexTestId) => {
    const test = FLEX_TEST_BY_ID[id];
    const series = testSeries(results, test);
    return { test, series, best: bestValue(series, test) };
  };
  const pending = 'Haz el test para saberlo.';
  const reachedText = 'Conseguido.';

  const toe = of('dedos_suelo');
  const squat = of('sentadilla');
  const back = of('rascado');
  const split = of('apertura');
  const splitGain = split.series.length === 0 ? null : round1(split.best! - split.series[0].value);

  return [
    {
      id: 'palmas',
      label: 'Tocar el suelo con las palmas',
      reached: toe.best !== null && toe.best <= 0,
      detail: toe.best === null ? pending : toe.best <= 0 ? reachedText : `Te faltan ${formatFlexValue(toe.test, toe.best)}.`,
    },
    {
      id: 'sentadilla',
      label: 'Sentadilla profunda 2 minutos',
      reached: squat.best !== null && squat.best >= SQUAT_GOAL_SECONDS,
      detail:
        squat.best === null
          ? pending
          : squat.best >= SQUAT_GOAL_SECONDS
            ? reachedText
            : `Tu mejor marca: ${formatFlexValue(squat.test, squat.best)} de ${SQUAT_GOAL_SECONDS} s.`,
    },
    {
      id: 'dedos_espalda',
      label: 'Dedos que se tocan tras la espalda',
      reached: back.best !== null && back.best >= 0,
      detail: back.best === null ? pending : back.best >= 0 ? reachedText : `Te faltan ${formatFlexValue(back.test, -back.best)}.`,
    },
    {
      id: 'apertura',
      label: `Apertura +${SPLIT_GOAL_CM} cm`,
      reached: splitGain !== null && splitGain >= SPLIT_GOAL_CM,
      detail:
        splitGain === null
          ? pending
          : splitGain >= SPLIT_GOAL_CM
            ? reachedText
            : `Llevas ${formatFlexValue(split.test, Math.max(0, splitGain), true)} desde el primer test.`,
    },
  ];
}
