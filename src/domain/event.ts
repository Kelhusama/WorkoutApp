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
export const eventConfig: {
  date: ISODate;
  targets: Record<'dominada' | 'peso_muerto', number>;
  /** Discos que hay para el cinturón, en kg. Lista vacía = ninguno. null = sin indicar: no se limita nada. */
  plates: number[] | null;
} = {
  date: EVENT_DATE,
  targets: { dominada: 12, peso_muerto: 100 },
  plates: null,
};

export function setEventConfig(c: { date?: ISODate; targets?: Partial<Record<'dominada' | 'peso_muerto', number>>; plates?: number[] | null }) {
  if (c.date) eventConfig.date = c.date;
  if (c.targets) Object.assign(eventConfig.targets, c.targets);
  if (c.plates !== undefined) eventConfig.plates = c.plates;
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
  /** Hoy toca test de máximo: una sola serie con todas las repeticiones limpias que salgan. */
  test?: boolean;
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
      dominada: d(4, 5, 2, 0, 'De dos en dos, perfectas, con 2–3 minutos entre series. Nunca al fallo.'),
      peso_muerto: d(1, 4, 5, 80, 'Técnica limpia, sin prisa por subir.'),
    },
  },
  7: {
    phase: 'base',
    title: 'Más repeticiones',
    doses: {
      dominada: d(4, 6, 2, 0, 'Una serie más que la semana pasada. Si la segunda repetición no sale limpia, haz una.'),
      peso_muerto: d(1, 4, 4, 85, 'Sube solo si la semana pasada salió con margen.'),
    },
  },
  6: {
    phase: 'base',
    title: 'Volumen sin lastre',
    doses: {
      dominada: d(4, 6, 2, 0, 'Seis series de dos. El jueves, test de máximo: una sola serie con todas las que salgan limpias.'),
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
function planned(lift: Lift, week: WeekPlan, logs: readonly TrialLog[]): Dose {
  const plan = week.doses[lift];
  // Lo del día suave (viernes, sin lastre) no dice nada de la fuerza: no cuenta para decidir el lastre siguiente.
  const last = [...logs]
    .filter((l) => l.lift === lift && !(lift === 'dominada' && isEasyPullupDay(l.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop();
  if (!last || week.phase === 'descarga') return plan;
  if (lift === 'peso_muerto') {
    const failed = last.reps < Math.min(plan.reps, EVENT_REPS) || last.reserve === 0;
    if (failed && last.weight < plan.weight) {
      return { ...plan, weight: last.weight, note: `La última vez fue al límite con ${last.weight} kg: repite ese peso antes de subir.` };
    }
    return plan;
  }
  if (plan.weight === 0) {
    // Sin lastre se ajustan las repeticiones por serie, según lo que quedaba la última vez.
    // Nunca más de tres por serie: es lo que pide la prueba, y de ahí en adelante se progresa con lastre.
    if (last.weight > 0 || last.reserve === null) return plan;
    if (last.reserve === 0 && last.reps < plan.reps) {
      const reps = Math.max(1, last.reps);
      return { ...plan, reps, note: `La última vez fue al límite: series de ${reps} hasta que sobre alguna.` };
    }
    if (last.reserve === 2 && last.reps >= plan.reps && plan.reps < EVENT_REPS) {
      const reps = Math.min(EVENT_REPS, Math.max(plan.reps, last.reps) + 1);
      return { ...plan, reps, note: `La última vez te sobraban tres o más: hoy series de ${reps}. Si la última no sale limpia, vuelve a ${reps - 1}.` };
    }
    return plan;
  }
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

/** Lastres que se pueden montar con unos discos: todas las sumas posibles, de menor a mayor, empezando por 0. */
export function loadsWith(plates: readonly number[]): number[] {
  let sums = new Set<number>([0]);
  for (const p of plates) sums = new Set([...sums, ...[...sums].map((s) => Math.round((s + p) * 100) / 100)]);
  return [...sums].sort((a, b) => a - b);
}

/**
 * Repeticiones sin lastre que equivalen a hacer `reps` con `kilos` colgados: hacer más
 * repeticiones es subir de nivel igual que añadir peso (misma fórmula que el nivel estimado).
 */
export function repsInsteadOf(reps: number, kilos: number, bodyKg: number = ASSUMED_BODY_KG): number {
  const equivalent = (1 + kilos / bodyKg) * (30 + reps) - 30;
  return Math.max(reps + 1, Math.round(equivalent));
}

/**
 * Ajusta el lastre de una dosis de dominadas a los discos que hay.
 * - Si con los discos sale un peso a medio kilo del pedido, se usa ese.
 * - Si no llega, se pone lo más cercano por debajo y los kilos que faltan se cambian por repeticiones.
 */
export function fitToPlates(dose: Dose, plates: readonly number[] | null): Dose {
  if (plates === null || dose.weight <= 0) return dose;
  const loads = loadsWith(plates);
  const near = loads.filter((l) => Math.abs(l - dose.weight) <= 0.5).sort((a, b) => Math.abs(a - dose.weight) - Math.abs(b - dose.weight))[0];
  if (near !== undefined) return { ...dose, weight: near };
  const best = loads.filter((l) => l < dose.weight).pop() ?? 0;
  const reps = repsInsteadOf(dose.reps, dose.weight - best);
  const kg = (v: number) => String(v).replace('.', ',');
  if (plates.length === 0) {
    return {
      ...dose,
      weight: 0,
      reps,
      note: `El plan pedía ${dose.reps} con ${kg(dose.weight)} kg, pero aún no tienes discos: ${reps} sin lastre equivalen a ese esfuerzo. Si no salen todas limpias, quédate en ${reps - 1}.`,
    };
  }
  return { ...dose, weight: best, reps, note: `Con tus discos llegas a ${kg(best)} kg (el plan pedía ${kg(dose.weight)}): lo que falta se compensa con ${reps} repeticiones en vez de ${dose.reps}.` };
}

/**
 * Lo que toca hoy en un ejercicio: lo del plan, corregido por lo último apuntado y,
 * en las dominadas, por los discos que hay para el cinturón.
 */
export function prescription(lift: Lift, week: WeekPlan, logs: readonly TrialLog[]): Dose {
  const dose = planned(lift, week, logs);
  return lift === 'dominada' ? fitToPlates(dose, eventConfig.plates) : dose;
}

/** Aviso si se acerca (o ya ha llegado) la semana con lastre y no hay ningún disco. */
export function platesWarning(today: ISODate): string | null {
  if (eventConfig.plates === null || eventConfig.plates.length > 0) return null;
  const first = buildPlan().find((w) => w.doses.dominada.weight > 0);
  if (!first || todayPlan(today).week === null) return null;
  const left = days(today, first.from);
  if (left > 28) return null;
  const d = fromISODate(first.from);
  const when = `${d.getDate()}/${d.getMonth() + 1}`;
  return left > 0
    ? `El ${when} empieza el lastre en dominadas y aún no tienes discos para el cinturón. Con tres discos de 2 kg vale para todo el plan. Faltan ${left} días.`
    : 'Ya toca lastre en las dominadas y no tienes discos: mientras tanto las haces sin peso y bajando despacio, pero consíguelos cuanto antes.';
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

/** «5 series de 2 repeticiones, sin lastre» · «3 series de 3 con 92,5 kg». */
export function doseText(lift: Lift, dose: Dose): string {
  const kg = String(dose.weight).replace('.', ',');
  const what = `${dose.sets} series de ${dose.reps} ${dose.reps === 1 ? 'repetición' : 'repeticiones'}`;
  if (lift === 'dominada') return `${what}, ${dose.weight > 0 ? `con ${kg} kg de lastre` : 'sin lastre'}`;
  return `${what} con ${kg} kg`;
}

/**
 * El viernes es el día suave de dominadas: cierra la semana, viene detrás del jueves y deja el fin de
 * semana para recuperar. Mismas repeticiones, un tercio menos de series, sin lastre y sin apurar.
 */
export function isEasyPullupDay(date: ISODate, eventDate: ISODate = eventConfig.date): boolean {
  return weekdayIndex(date) === 4 && isPullupDay(date, eventDate);
}

/** Último día fuerte de dominadas de una semana (el jueves, con cuatro días): ahí van los intentos al máximo. */
export function lastHardPullupDay(week: WeekPlan): ISODate | null {
  let last: ISODate | null = null;
  for (let d = week.from; d <= week.to; d = addDays(d, 1)) if (isPullupDay(d) && !isEasyPullupDay(d)) last = d;
  return last;
}

/** Semana del test de máximo sin lastre: la última antes de empezar con el lastre. */
export const MAX_TEST_WEEK = 6;

/** ¿Toca hoy el test de máximo? Una vez en todo el plan, el último día fuerte de la tercera semana. */
export function isMaxTestDay(date: ISODate, eventDate: ISODate = eventConfig.date): boolean {
  const week = todayPlan(date, eventDate).week;
  return !!week && week.weeksLeft === MAX_TEST_WEEK && lastHardPullupDay(week) === date;
}

/** Lo que toca de dominadas un día concreto: lo de la semana, el test de máximo, o la versión suave del viernes. */
export function pullupDose(date: ISODate, week: WeekPlan, logs: readonly TrialLog[]): Dose {
  const dose = prescription('dominada', week, logs);
  if (isMaxTestDay(date)) {
    return {
      ...dose,
      test: true,
      sets: 1,
      weight: 0,
      note: 'Test de máximo: calienta bien, descansa tres minutos y haz una sola serie con todas las que salgan limpias. Para cuando se rompa la técnica, no cuando no puedas más.',
    };
  }
  if (!isEasyPullupDay(date)) return dose;
  return {
    ...dose,
    sets: Math.min(dose.sets, Math.max(2, Math.ceil((dose.sets * 2) / 3))),
    weight: 0,
    note: 'Día suave: sin lastre, menos series y dejando margen en todas. Hoy se pule la técnica, no se busca el límite.',
  };
}

export interface PullupMark {
  state: 'hecho' | 'toca' | 'sin_hacer';
  /** Día suave (viernes). */
  easy: boolean;
}

export const PULLUP_MARK_LABEL: Record<PullupMark['state'], string> = { hecho: 'hechas', toca: 'tocan', sin_hacer: 'sin hacer' };

/**
 * Las dominadas del plan en un día del calendario: hechas si hay registro; si no, lo que marque el plan
 * cuando está activo. `paused`: ese día se está de viaje sin barra, así que no tocan.
 */
export function pullupMark(date: ISODate, logs: readonly TrialLog[], today: ISODate, active: boolean, paused = false): PullupMark | null {
  const easy = isEasyPullupDay(date);
  if (logs.some((l) => l.lift === 'dominada' && l.date === date)) return { state: 'hecho', easy };
  if (!active || paused || !isPullupDay(date)) return null;
  return { state: date < today ? 'sin_hacer' : 'toca', easy };
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
  // Los días anteriores al comienzo del plan no cuentan: no hay semana a la que sumarlos.
  if (!week || date < week.from) return false;
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
  'Unos 20 minutos, con calentamiento y descansos guiados. Cada sesión suma para el 16 de enero.',
  'Te están esperando. Cuanto antes las hagas, más frescas salen. ¡Tú puedes!',
  'Último aviso de hoy: aún estás a tiempo. Si no puede ser, mañana no las dobles: sigue con el plan.',
];

/**
 * Avisos de dominadas para los próximos días: en cada día que toca y en el que aún no hay nada
 * apuntado, uno por cada hora configurada (hasta tres). Al apuntar la sesión dejan de salir.
 * `times` en formato HH:MM.
 */
/**
 * `paused`: días de viaje sin barra (ni gimnasio de hotel). Esos días el plan de dominadas no avisa:
 * lo sustituye el remo de la sesión de viaje.
 */
export function planTrialReminders(
  logs: readonly TrialLog[],
  times: readonly string[],
  now: Date,
  today: ISODate,
  horizonDays = 14,
  paused: ReadonlySet<ISODate> = new Set(),
): TrialReminder[] {
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
    if (!isPullupDay(date) || done.has(date) || paused.has(date)) continue;
    const week = todayPlan(date).week!;
    const dose = pullupDose(date, week, logs);
    hours.forEach((t, k) => {
      const at = fromISODate(date);
      at.setHours(t.h, t.m, 0, 0);
      if (at <= now) return;
      const grips = gripPlanText(gripPlan(dose.sets, date));
      out.push({
        id: `rem-dom-${date}-${k}`,
        at,
        title: `Dominadas${isEasyPullupDay(date) ? ' (día suave)' : ''} · ${dose.test ? 'test de máximo' : doseText('dominada', dose)}`,
        body: `${grips ? `${grips[0].toUpperCase()}${grips.slice(1)}. ` : ''}${NUDGES[Math.min(k, NUDGES.length - 1)]}`,
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

/** Sesiones de dominadas en 7 días a partir de las cuales se considera que hay más carga de la planificada. */
export const PULL_OVERLOAD_SESSIONS = 5;

/**
 * ¿Van los brazos cargados de tanta dominada? Mira las sesiones de dominadas apuntadas antes de hoy:
 * - las dos últimas (dentro de la semana) acabaron al límite, sin nada en reserva; o
 * - hay más sesiones en 7 días de las que pide el plan.
 * Devuelve el motivo, o null si no hay nada que avisar. No mira la sensación general: solo el tirón,
 * que es lo que cargan los codos.
 */
export function pullFatigue(logs: readonly TrialLog[], today: ISODate): string | null {
  const recent = logs
    .filter((l) => l.lift === 'dominada' && l.date < today && l.date >= addDays(today, -7))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastTwo = recent.slice(0, 2);
  if (lastTwo.length === 2 && lastTwo.every((l) => l.reserve === 0)) {
    return 'Tus dos últimas sesiones de dominadas acabaron al límite: hoy afloja en todo lo que tire de brazos.';
  }
  const days = new Set(recent.map((l) => l.date)).size;
  if (days >= PULL_OVERLOAD_SESSIONS) {
    return `Llevas ${days} días de dominadas en una semana, más de lo que pide el plan: hoy afloja en todo lo que tire de brazos.`;
  }
  return null;
}

/** Kilos de lastre que se suelen ganar por semana de entrenamiento a este nivel: entre poco y bastante. */
export const WEEKLY_GAIN_KG = { low: 0.5, high: 1.25 } as const;

/**
 * Lastre realista para el día de la prueba, a tres repeticiones: donde estás hoy más lo que se suele ganar en las
 * semanas de entrenamiento que quedan (la última es de descarga y no suma). Es una estimación para decidir con
 * los pies en el suelo, no una promesa: el test de máximo la afina.
 */
export function realisticTarget(logs: readonly TrialLog[], today: ISODate, bodyKg: number = ASSUMED_BODY_KG, eventDate: ISODate = eventConfig.date): { low: number; high: number; weeks: number } {
  const level = Math.max(0, currentLevel('dominada', logs, today, bodyKg));
  const weeks = Math.max(0, Math.min(8, weeksLeftOn(today, eventDate)) - 1);
  const round = (v: number) => Math.round(v * 2) / 2;
  return { low: round(level + WEEKLY_GAIN_KG.low * weeks), high: round(level + WEEKLY_GAIN_KG.high * weeks), weeks };
}

/**
 * Bajadas lentas para acabar la sesión: dan mucha fuerza para la dominada con lastre, pero cargan el codo.
 * Solo los días frescos (el anterior no hubo dominadas), nunca el viernes suave, el día del test ni en la
 * descarga, y tampoco si los brazos ya van cargados.
 */
export function slowNegatives(date: ISODate, logs: readonly TrialLog[], eventDate: ISODate = eventConfig.date): number {
  const week = todayPlan(date, eventDate).week;
  if (!week || week.phase === 'descarga' || !isPullupDay(date, eventDate)) return 0;
  if (isEasyPullupDay(date, eventDate) || isMaxTestDay(date, eventDate) || isPullupDay(addDays(date, -1), eventDate)) return 0;
  return pullFatigue(logs, date) ? 0 : 2;
}

/** De viaje solo hay barra si el hotel tiene gimnasio. Sin barra, las dominadas del plan se paran ese día. */
export function pullupsPausedBy(gear: { gimnasio: boolean } | null | undefined): boolean {
  return gear != null && !gear.gimnasio;
}

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
/**
 * Agarre de cada serie de la sesión de hoy. La primera mitad siempre en el agarre de la prueba, que es
 * el que hay que dominar y se hace más fresco; el resto, en el agarre del día (supino o neutro), que
 * reparte la carga del codo. Los días de prono, todas en prono. No se elige: lo marca el plan.
 */
export function gripPlan(sets: number, date: ISODate, eventDate: ISODate = eventConfig.date): Grip[] {
  const accent = gripFor(date, eventDate) ?? TEST_GRIP;
  const main = accent === TEST_GRIP ? sets : Math.ceil(sets / 2);
  return Array.from({ length: Math.max(0, sets) }, (_, i) => (i < main ? TEST_GRIP : accent));
}

/** «3 series en prono y 3 en supino». */
export function gripPlanText(grips: readonly Grip[]): string {
  const parts: string[] = [];
  for (const g of ['prono', 'supino', 'neutro'] as const) {
    const n = grips.filter((x) => x === g).length;
    if (n > 0) parts.push(`${parts.length === 0 ? `${n} ${n === 1 ? 'serie' : 'series'}` : n} en ${GRIP_INFO[g].label.toLowerCase()}`);
  }
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

export function gripsText(week: WeekPlan): string {
  const parts: string[] = [];
  for (let d = week.from; d <= week.to; d = addDays(d, 1)) {
    const g = gripFor(d);
    // Los días de supino o neutro, la primera mitad de las series sigue siendo en prono.
    if (g) parts.push(`${DAY_NAMES[weekdayIndex(d)]} ${g === TEST_GRIP ? '' : `${GRIP_INFO[TEST_GRIP].label.toLowerCase()} y `}${GRIP_INFO[g].label.toLowerCase()}`);
  }
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

// ---------- Colgarse ----------

export interface HangLog {
  date: ISODate;
  /** Segundos aguantados en el mejor intento del día. */
  seconds: number;
}

export interface HangDose {
  /** Hoy toca intento al máximo (no hay marca todavía, o es el último día fuerte de dominadas de la semana). */
  max: boolean;
  sets: number;
  /** Segundos por serie; 0 si es intento al máximo. */
  seconds: number;
  text: string;
}

/** Mejor marca de las últimas cuatro semanas, o null si no hay. */
export function hangBest(logs: readonly HangLog[], today: ISODate): number | null {
  const recent = logs.filter((l) => l.date >= addDays(today, -28) && l.seconds > 0);
  return recent.length ? Math.max(...recent.map((l) => l.seconds)) : null;
}

/**
 * Colgarse al final de la sesión de dominadas: un intento al máximo el último día de dominadas
 * de la semana (o si aún no hay marca) y, el resto, dos series a tres cuartos de la mejor marca.
 * En la descarga no se busca el máximo.
 */
export function hangDose(logs: readonly HangLog[], today: ISODate): HangDose {
  const best = hangBest(logs, today);
  const week = todayPlan(today).week;
  // El intento al máximo va el último día fuerte de dominadas de la semana (el jueves, con cuatro días):
  // el viernes es día suave y no es momento de buscar marcas.
  // Tampoco el día del test de máximo de dominadas: un intento al límite por día.
  const lastDay = !!week && lastHardPullupDay(week) === today && !isMaxTestDay(today);
  if (best === null) return { max: true, sets: 1, seconds: 0, text: 'Cuélgate una vez hasta que no puedas más y apunta los segundos: será tu marca de partida.' };
  if (lastDay && week?.phase !== 'descarga') {
    return { max: true, sets: 1, seconds: 0, text: `Un intento al máximo. Tu marca es ${best} s: a por un par de segundos más.` };
  }
  const seconds = Math.max(10, Math.round((best * 0.75) / 5) * 5);
  return { max: false, sets: 2, seconds, text: `2 series de ${seconds} s, con un minuto de descanso. Sin llegar al límite.` };
}
