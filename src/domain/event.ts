import { addDays, fromISODate, weekdayIndex, type ISODate } from './dates';

/**
 * Prueba del 16 de enero de 2027: peso muerto y dominadas con lastre, a tres repeticiones.
 * (El press de banca lo hace otro compañero del equipo.)
 *
 * El plan cuenta hacia atrás desde el día de la prueba, semana a semana, y dice exactamente
 * cuántos días, series, repeticiones y kilos tocan. Lo apuntado en cada sesión lo ajusta.
 */

export const EVENT_DATE: ISODate = '2027-01-16';
export const EVENT_NAME = 'Prueba del 16 de enero';

/**
 * Fecha y objetivos vigentes. Arrancan con los de partida y se sustituyen al abrir la app
 * por lo que el usuario haya guardado (ver `loadEventConfig`). Las funciones de este archivo
 * los usan cuando no se les pasa otra fecha.
 */
export const eventConfig: { date: ISODate; targets: Record<'dominada' | 'peso_muerto', number> } = {
  date: EVENT_DATE,
  targets: { dominada: 12, peso_muerto: 100 },
};

export function setEventConfig(c: { date?: ISODate; targets?: Partial<Record<'dominada' | 'peso_muerto', number>> }) {
  if (c.date) eventConfig.date = c.date;
  if (c.targets) Object.assign(eventConfig.targets, c.targets);
}

/** «Prueba del 16 de enero», con la fecha vigente. */
export function eventName(): string {
  const d = fromISODate(eventConfig.date);
  const month = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][d.getMonth()];
  return `Prueba del ${d.getDate()} de ${month}`;
}

/** Kilos objetivo vigentes de un levantamiento. */
export function targetOf(lift: 'dominada' | 'peso_muerto'): number {
  return eventConfig.targets[lift];
}
/** Repeticiones de la prueba. */
export const EVENT_REPS = 3;

export type Lift = 'dominada' | 'peso_muerto';
export const LIFTS: readonly Lift[] = ['dominada', 'peso_muerto'];

export const LIFT_INFO: Record<Lift, { label: string; target: number; unit: string; step: number; rules: string }> = {
  dominada: {
    label: 'Dominadas con lastre',
    target: 12,
    unit: 'kg de lastre',
    step: 1,
    rules: 'Estrictas: sin balanceo, bajando hasta abajo con los brazos estirados y subiendo la barbilla por encima de la barra. El agarre no tiene que ser ancho: a la anchura de los hombros.',
  },
  peso_muerto: {
    label: 'Peso muerto',
    target: 100,
    unit: 'kg',
    step: 2.5,
    rules: 'Espalda recta en todas las repeticiones. Si una sale con la espalda redondeada, ese día no se sube de peso.',
  },
};

/** De dónde se parte (20/11/2026): 4 dominadas estrictas sin lastre, bajando hasta abajo, y peso muerto de 80 kg × 8. */
export const START: Record<Lift, { weight: number; reps: number }> = {
  dominada: { weight: 0, reps: 4 },
  peso_muerto: { weight: 80, reps: 8 },
};

export type Grip = 'prono' | 'supino' | 'neutro';

export const GRIP_INFO: Record<Grip, { label: string; how: string }> = {
  prono: { label: 'Prono', how: 'Palmas hacia fuera, manos a la anchura de los hombros. Es el más exigente y el que se entrena más.' },
  supino: { label: 'Supino', how: 'Palmas hacia ti, manos a la anchura de los hombros. Trabaja más el bíceps y suele salir algo más fácil.' },
  neutro: { label: 'Neutro', how: 'Palmas enfrentadas, en los agarres paralelos de la barra. El más amable con codos y hombros.' },
};

/** Agarre que se da por hecho para la prueba mientras no se diga otro: es el que más se repite. */
export const TEST_GRIP: Grip = 'prono';

export type Phase = 'base' | 'fuerza' | 'pico' | 'descarga' | 'dia' | 'pasado';

export interface Dose {
  /** Días de esta semana. */
  days: number;
  sets: number;
  reps: number;
  /** Kilos previstos: lastre en dominadas, peso de la barra en peso muerto. */
  weight: number;
  /** Cómo hacerlo, en una frase. */
  note: string;
}

export interface WeekPlan {
  /** Semanas que faltan, contando la de la prueba como 1. */
  weeksLeft: number;
  from: ISODate;
  to: ISODate;
  phase: Phase;
  title: string;
  doses: Record<Lift, Dose>;
}

const d = (days: number, sets: number, reps: number, weight: number, note: string): Dose => ({ days, sets, reps, weight, note });

/** Plantilla por semanas que faltan (8 = la primera). */
const TEMPLATE: Record<number, { phase: Phase; title: string; doses: Record<Lift, Dose> }> = {
  8: {
    phase: 'base',
    title: 'Coger práctica',
    doses: {
      dominada: d(4, 6, 1, 0, 'De una en una, perfectas, con 2–3 minutos entre series. Nunca al fallo.'),
      peso_muerto: d(1, 4, 5, 80, 'Técnica limpia, sin prisa por subir.'),
    },
  },
  7: {
    phase: 'base',
    title: 'Más repeticiones',
    doses: {
      dominada: d(4, 5, 2, 0, 'De dos en dos, con 3 minutos entre series. Si la segunda no sale limpia, haz una.'),
      peso_muerto: d(1, 4, 4, 85, 'Sube solo si la semana pasada salió con margen.'),
    },
  },
  6: {
    phase: 'base',
    title: 'Volumen sin lastre',
    doses: {
      dominada: d(4, 6, 2, 0, 'Seis series de dos. El último día de la semana, test de máximo: lo esperable son 4 o 5.'),
      peso_muerto: d(1, 4, 3, 87.5, 'Primeras series de tres.'),
    },
  },
  5: {
    phase: 'fuerza',
    title: 'Empieza el lastre',
    doses: {
      dominada: d(3, 5, 2, 2, 'Con 2 kg en la mochila. Si el test salió en 3 o menos, sigue una semana más sin lastre.'),
      peso_muerto: d(1, 3, 3, 90, 'Tres series de tres.'),
    },
  },
  4: {
    phase: 'fuerza',
    title: 'Series de tres',
    doses: {
      dominada: d(3, 4, 3, 2, 'Ya de tres en tres, como en la prueba. Sube 2 kg cuando todas salgan limpias y sobre una.'),
      peso_muerto: d(1, 3, 3, 92.5, 'Sube 2,5 kg si todas las repeticiones salieron rectas.'),
    },
  },
  3: {
    phase: 'fuerza',
    title: 'Más lastre',
    doses: {
      dominada: d(3, 4, 3, 4, 'Añade 2 kg cuando todas las series salgan limpias y sobre una.'),
      peso_muerto: d(1, 3, 3, 95, 'Sube 2,5 kg si todas las repeticiones salieron rectas.'),
    },
  },
  2: {
    phase: 'pico',
    title: 'Buscar el tope',
    doses: {
      dominada: d(3, 4, 3, 6, 'Busca el lastre más alto con el que salen tres limpias: será tu peso de la prueba.'),
      peso_muerto: d(1, 2, 3, 97.5, 'Dos series de tres. Si van sobradas, prueba una serie con el peso de la prueba.'),
    },
  },
  1: {
    phase: 'descarga',
    title: 'Descarga',
    doses: {
      dominada: d(2, 3, 2, 4, 'Mitad de trabajo, con algo menos de lastre que tu tope. Los dos días anteriores a la prueba, descanso.'),
      peso_muerto: d(1, 2, 2, 85, 'Solo para mantener el gesto. Hazlo a principios de semana.'),
    },
  },
};

const days = (a: ISODate, b: ISODate) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Semanas que faltan en una fecha: 1 en los siete días anteriores a la prueba, 2 en los siete de antes… */
export function weeksLeftOn(date: ISODate, eventDate: ISODate = eventConfig.date): number {
  return Math.ceil(days(date, eventDate) / 7);
}

/** El plan entero, de la primera semana a la última. Cada semana acaba el día de la semana anterior al de la prueba. */
export function buildPlan(eventDate: ISODate = eventConfig.date): WeekPlan[] {
  // Los kilos de peso muerto de la plantilla están pensados para 100 kg: se escalan si el objetivo es otro.
  const scale = eventConfig.targets.peso_muerto / 100;
  return [8, 7, 6, 5, 4, 3, 2, 1].map((w) => {
    const t = TEMPLATE[w];
    const deadlift = { ...t.doses.peso_muerto, weight: Math.round((t.doses.peso_muerto.weight * scale) / 2.5) * 2.5 };
    return {
      weeksLeft: w,
      from: addDays(eventDate, -7 * w),
      to: addDays(eventDate, -7 * (w - 1) - 1),
      ...t,
      doses: { ...t.doses, peso_muerto: deadlift },
    };
  });
}

export interface TrialLog {
  date: ISODate;
  lift: Lift;
  weight: number;
  reps: number;
  sets: number;
  /** Lo que quedaba en la última serie: 0 nada · 1 una o dos · 2 tres o más. */
  reserve: 0 | 1 | 2 | null;
  /** Agarre con el que se hicieron las dominadas, si se sabe. */
  grip?: Grip | null;
}

export interface Today {
  phase: Phase;
  daysLeft: number;
  /** Semana del plan en curso; null el día de la prueba o después. */
  week: WeekPlan | null;
}

export function todayPlan(today: ISODate, eventDate: ISODate = eventConfig.date): Today {
  const daysLeft = days(today, eventDate);
  if (daysLeft < 0) return { phase: 'pasado', daysLeft, week: null };
  if (daysLeft === 0) return { phase: 'dia', daysLeft, week: null };
  // Si aún faltan más de ocho semanas, se va haciendo la primera.
  const week = buildPlan(eventDate).find((w) => w.weeksLeft === Math.min(8, weeksLeftOn(today, eventDate)))!;
  return { phase: week.phase, daysLeft, week };
}

/**
 * Lo que toca hoy en un ejercicio: lo del plan, corregido por lo último que se apuntó.
 * - Peso muerto: si la última vez no salieron las repeticiones, se repite ese peso en vez de subir.
 * - Dominadas: el lastre no pasa del que se ha demostrado más 2 kg, y solo sube si la última
 *   sesión salió entera y sobraba al menos una. En la descarga manda el plan.
 */
export function prescription(lift: Lift, week: WeekPlan, logs: readonly TrialLog[]): Dose {
  const plan = week.doses[lift];
  const last = [...logs].filter((l) => l.lift === lift).sort((a, b) => a.date.localeCompare(b.date)).pop();
  if (!last || week.phase === 'descarga') return plan;
  if (lift === 'peso_muerto') {
    const failed = last.reps < Math.min(plan.reps, EVENT_REPS) || last.reserve === 0;
    if (failed && last.weight < plan.weight) {
      return { ...plan, weight: last.weight, note: `La última vez fue al límite con ${last.weight} kg: repite ese peso antes de subir.` };
    }
    return plan;
  }
  if (plan.weight === 0) return plan;
  const clean = last.reps >= plan.reps && last.reserve !== null && last.reserve >= 1;
  const proven = clean ? last.weight + 2 : last.weight;
  if (proven < plan.weight) {
    return {
      ...plan,
      weight: Math.max(0, proven),
      note: clean ? `Vas por debajo del plan: hoy ${proven} kg, y subes otros 2 cuando vuelva a salir limpio.` : `La última vez fue justa: repite ${Math.max(0, proven)} kg hasta que sobre una.`,
    };
  }
  // Va por delante del plan: se le deja seguir subiendo desde lo que ya ha hecho.
  return proven > plan.weight ? { ...plan, weight: proven, note: 'Vas por delante del plan: sigue desde lo que ya has hecho.' } : plan;
}

/** Peso estimado para tres repeticiones a partir de una serie (fórmula de Epley), redondeado a 0,5 kg. */
export function estimate3RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const oneRm = reps === 1 ? weight : weight * (1 + reps / 30);
  return Math.round((oneRm / (1 + EVENT_REPS / 30)) * 2) / 2;
}

/** Peso corporal que se supone si aún no hay ninguna pesada. */
export const ASSUMED_BODY_KG = 80;

/**
 * Dónde está hoy cada ejercicio, expresado como en la prueba: kilos de barra a tres repeticiones,
 * o kilos de lastre a tres dominadas (calculado sobre el peso del cuerpo más el lastre).
 * Usa la mejor sesión de las últimas tres semanas, sin bajar nunca del punto de partida.
 */
export function currentLevel(lift: Lift, logs: readonly TrialLog[], today: ISODate, bodyKg: number = ASSUMED_BODY_KG): number {
  const recent = logs.filter((l) => l.lift === lift && l.date >= addDays(today, -21) && l.reps > 0);
  // El punto de partida cuenta siempre como suelo: una semana suave no significa haber perdido fuerza.
  const sets = [...recent, { ...START[lift] }];
  const value = (s: { weight: number; reps: number }) => (lift === 'dominada' ? estimate3RM(bodyKg + s.weight, s.reps) - bodyKg : estimate3RM(s.weight, s.reps));
  return Math.round(Math.max(...sets.map(value)) * 2) / 2;
}

/** Sesiones de un ejercicio apuntadas en la semana del plan. */
export function doneThisWeek(lift: Lift, week: WeekPlan, logs: readonly TrialLog[]): number {
  return new Set(logs.filter((l) => l.lift === lift && l.date >= week.from && l.date <= week.to).map((l) => l.date)).size;
}

/** «6 series de 1 repetición, sin lastre» · «3 series de 3 con 92,5 kg». */
export function doseText(lift: Lift, dose: Dose): string {
  const kg = String(dose.weight).replace('.', ',');
  const what = `${dose.sets} series de ${dose.reps} ${dose.reps === 1 ? 'repetición' : 'repeticiones'}`;
  if (lift === 'dominada') return `${what}, ${dose.weight > 0 ? `con ${kg} kg de lastre` : 'sin lastre'}`;
  return `${what} con ${kg} kg`;
}

// ---------- Días de dominadas, avisos y sesión guiada ----------

/**
 * Días de la semana para las dominadas (0 = lunes), siempre entre semana y dejando descanso
 * a los codos: cuatro días → L, M, J y V; tres → L, X y V; dos → L y X.
 */
const PULLUP_WEEKDAYS: Record<number, readonly number[]> = { 4: [0, 1, 3, 4], 3: [0, 2, 4], 2: [0, 2], 1: [0] };

/** ¿Tocan dominadas ese día según el plan? */
export function isPullupDay(date: ISODate, eventDate: ISODate = eventConfig.date): boolean {
  const week = todayPlan(date, eventDate).week;
  if (!week) return false;
  return (PULLUP_WEEKDAYS[week.doses.dominada.days] ?? []).includes(weekdayIndex(date));
}

const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** «lunes, martes, jueves y viernes». */
export function pullupDaysText(week: WeekPlan): string {
  const names = (PULLUP_WEEKDAYS[week.doses.dominada.days] ?? []).map((i) => DAY_NAMES[i]);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export interface TrialReminder {
  id: string;
  at: Date;
  title: string;
  body: string;
}

const NUDGES = [
  'Unos 20 minutos, con calentamiento y descansos guiados.',
  'Siguen pendientes. Cuanto antes las hagas, más frescas salen.',
  'Último aviso de hoy. Si no puedes, mañana no las dobles: sigue con el plan.',
];

/**
 * Avisos de dominadas para los próximos días: en cada día que toca y en el que aún no hay nada
 * apuntado, uno por cada hora configurada (hasta tres). Al apuntar la sesión dejan de salir.
 * `times` en formato HH:MM.
 */
export function planTrialReminders(logs: readonly TrialLog[], times: readonly string[], now: Date, today: ISODate, horizonDays = 14): TrialReminder[] {
  const done = new Set(logs.filter((l) => l.lift === 'dominada').map((l) => l.date));
  const hours = times
    .map((t) => /^(\d{1,2}):(\d{2})$/.exec(t.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ h: Number(m[1]), m: Number(m[2]) }))
    .filter((t) => t.h < 24 && t.m < 60)
    .sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m))
    .slice(0, 3);
  const out: TrialReminder[] = [];
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(today, i);
    if (!isPullupDay(date) || done.has(date)) continue;
    const week = todayPlan(date).week!;
    const dose = prescription('dominada', week, logs);
    hours.forEach((t, k) => {
      const at = fromISODate(date);
      at.setHours(t.h, t.m, 0, 0);
      if (at <= now) return;
      const grip = gripFor(date);
      out.push({
        id: `rem-dom-${date}-${k}`,
        at,
        title: `Dominadas · ${doseText('dominada', dose)}`,
        body: `${grip ? `Agarre ${GRIP_INFO[grip].label.toLowerCase()}. ` : ''}${NUDGES[Math.min(k, NUDGES.length - 1)]}`,
      });
    });
  }
  return out;
}

/** Descanso entre series de dominadas, en segundos. */
export const PULLUP_REST_SECONDS = 150;

/** Calentamiento antes de las series: unos 3–4 minutos. */
export const PULLUP_WARMUP: readonly string[] = [
  'Círculos de hombros y de brazos, 30 segundos hacia cada lado.',
  'Cuélgate de la barra 20 segundos, relajado.',
  'Colgado y con los brazos estirados, sube y baja los hombros 8 veces (sin doblar los codos).',
  'Una bajada lenta de 5 segundos: sube con un salto y baja frenando.',
];

/** Cuidado de codos, dos días por semana (martes y viernes; si esa semana no hay martes, el miércoles). */
export const ELBOW_CARE: readonly string[] = [
  'Curl de muñeca inverso con la mancuerna o una botella: 2 series de 15, suaves.',
  'Cuélgate relajado 2 veces, 20–30 segundos, dejando que el cuerpo estire.',
  'Si el codo molesta por dentro, mañana descansa de dominadas.',
];

export function isElbowCareDay(date: ISODate): boolean {
  if (!isPullupDay(date)) return false;
  const week = todayPlan(date).week!;
  const days = PULLUP_WEEKDAYS[week.doses.dominada.days] ?? [];
  const wd = weekdayIndex(date);
  return wd === 4 || wd === (days.includes(1) ? 1 : 2);
}

/**
 * Ejercicios de las sesiones de casa que el plan de la prueba ya cubre de sobra. Mientras el plan
 * esté activo no se piden por los dos lados: los codos no aguantan dominadas en el plan y además
 * en casa. Se quedan las flexiones, el curl y el resto.
 */
export const TRIAL_COVERS: readonly string[] = ['A.dominadas', 'A.negativas', 'C.dominadas'];

/** Quita de una sesión de casa lo que ya hace el plan, si está activo y la prueba aún no ha pasado. */
export function withoutTrialWork<T extends { key: string }>(slots: readonly T[], active: boolean, date: ISODate, eventDate: ISODate = eventConfig.date): T[] {
  if (!active || !todayPlan(date, eventDate).week) return [...slots];
  return slots.filter((s) => !TRIAL_COVERS.includes(s.key));
}

/**
 * Agarre de cada día de dominadas: el de la prueba se repite más, y los otros dos reparten
 * el esfuerzo entre músculos y dan un respiro a los codos. En la descarga, solo el de la prueba.
 * Con tres días por semana, el del medio alterna supino y neutro de una semana a otra.
 */
export function gripFor(date: ISODate, eventDate: ISODate = eventConfig.date): Grip | null {
  if (!isPullupDay(date, eventDate)) return null;
  const week = todayPlan(date, eventDate).week!;
  const days = PULLUP_WEEKDAYS[week.doses.dominada.days] ?? [];
  const i = days.indexOf(weekdayIndex(date));
  if (week.phase === 'descarga') return TEST_GRIP;
  if (days.length >= 4) return ([TEST_GRIP, 'supino', 'neutro', TEST_GRIP] as const)[i];
  if (days.length === 3) return i === 1 ? (week.weeksLeft % 2 === 0 ? 'supino' : 'neutro') : TEST_GRIP;
  return TEST_GRIP;
}

/** «lunes prono, martes supino, jueves neutro y viernes prono». */
export function gripsText(week: WeekPlan): string {
  const parts: string[] = [];
  for (let d = week.from; d <= week.to; d = addDays(d, 1)) {
    const g = gripFor(d);
    if (g) parts.push(`${DAY_NAMES[weekdayIndex(d)]} ${GRIP_INFO[g].label.toLowerCase()}`);
  }
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}
