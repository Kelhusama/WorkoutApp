import { addDays, type ISODate } from './dates';

/**
 * Prueba del 16 de enero de 2027: peso muerto y dominadas con lastre, a tres repeticiones.
 * (El press de banca lo hace otro compañero del equipo.)
 *
 * El plan cuenta hacia atrás desde el día de la prueba, semana a semana, y dice exactamente
 * cuántos días, series, repeticiones y kilos tocan. Lo apuntado en cada sesión lo ajusta.
 */

export const EVENT_DATE: ISODate = '2027-01-16';
export const EVENT_NAME = 'Prueba del 16 de enero';
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
      peso_muerto: d(1, 2, 3, 97.5, 'Dos series de tres. Si van sobradas, prueba una serie con 100 kg.'),
    },
  },
  1: {
    phase: 'descarga',
    title: 'Descarga',
    doses: {
      dominada: d(2, 3, 2, 4, 'Mitad de trabajo, con algo menos de lastre que tu tope. Último día, el 11 o el 12; el 14 y el 15, descanso.'),
      peso_muerto: d(1, 2, 2, 85, 'Solo para mantener el gesto. Hazlo a principios de semana.'),
    },
  },
};

const days = (a: ISODate, b: ISODate) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Semanas que faltan en una fecha: 1 en los siete días anteriores a la prueba, 2 en los siete de antes… */
export function weeksLeftOn(date: ISODate, eventDate: ISODate = EVENT_DATE): number {
  return Math.ceil(days(date, eventDate) / 7);
}

/** El plan entero, de la primera semana a la última. Cada semana acaba el día de la semana anterior al de la prueba. */
export function buildPlan(eventDate: ISODate = EVENT_DATE): WeekPlan[] {
  return [8, 7, 6, 5, 4, 3, 2, 1].map((w) => ({
    weeksLeft: w,
    from: addDays(eventDate, -7 * w),
    to: addDays(eventDate, -7 * (w - 1) - 1),
    ...TEMPLATE[w],
  }));
}

export interface TrialLog {
  date: ISODate;
  lift: Lift;
  weight: number;
  reps: number;
  sets: number;
  /** Lo que quedaba en la última serie: 0 nada · 1 una o dos · 2 tres o más. */
  reserve: 0 | 1 | 2 | null;
}

export interface Today {
  phase: Phase;
  daysLeft: number;
  /** Semana del plan en curso; null el día de la prueba o después. */
  week: WeekPlan | null;
}

export function todayPlan(today: ISODate, eventDate: ISODate = EVENT_DATE): Today {
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
