import type { BodyEntry, Profile } from './body';
import { addDays, type ISODate } from './dates';
import { trendRatePerWeek, trendWeight } from './insights';

/**
 * «Cómo voy»: objetivos de físico con respaldo (docs/VISION_FOTOS.md), calculados
 * con lo que ya se apunta: peso, cinta y altura. Sin nota global, solo tendencias y un consejo.
 */

export type Verdict = 'bien' | 'neutro' | 'atencion' | 'mal' | 'sin_datos';

export interface Checkpoint {
  id: 'cintura' | 'peso' | 'brazo' | 'pecho';
  title: string;
  /** Dato principal ya formateado, o null si aún no se puede calcular. */
  value: string | null;
  verdict: Verdict;
  advice: string;
}

const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;
const days = (a: ISODate, b: ISODate) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Cintura dividida por altura: por debajo de 0,5 es la zona saludable, también en gente musculada. */
function waistCheck(profile: Profile | null, sorted: readonly BodyEntry[]): Checkpoint {
  const base = { id: 'cintura' as const, title: 'Cintura respecto a tu altura' };
  const last = [...sorted].reverse().find((e) => e.waist != null);
  if (!profile || !last) {
    return { ...base, value: null, verdict: 'sin_datos', advice: profile ? 'Mide tu cintura con la cinta, a la altura del ombligo.' : 'Completa tu perfil con la altura.' };
  }
  const ratio = last.waist! / profile.heightCm;
  const goalCm = Math.floor(profile.heightCm * 0.5 * 10 - 1e-9) / 10;
  const value = fmt(ratio, 2);
  if (ratio < 0.5) return { ...base, value, verdict: 'bien', advice: 'Por debajo de 0,5: zona saludable. Toca mantenerla.' };
  const gap = `Para bajar de 0,5 tu cintura debe quedar en ${fmt(goalCm)} cm: te sobran ${fmt(last.waist! - goalCm)} cm.`;
  return ratio < 0.6 ? { ...base, value, verdict: 'atencion', advice: gap } : { ...base, value, verdict: 'mal', advice: `${gap} Es la medida que más conviene bajar.` };
}

/** Ritmo de peso: entre el 0,5 y el 1 % por semana se pierde grasa conservando músculo. */
function weightCheck(sorted: readonly BodyEntry[]): Checkpoint {
  const base = { id: 'peso' as const, title: 'Ritmo de peso' };
  const trend = trendWeight(sorted);
  const rate = trendRatePerWeek(trend);
  if (rate === null) {
    return { ...base, value: null, verdict: 'sin_datos', advice: 'Pésate cada semana: con dos o tres semanas se ve el ritmo real.' };
  }
  const pct = (rate / trend[trend.length - 1].value) * 100;
  const value = `${signed(rate, 2)} kg por semana`;
  if (pct < -1) return { ...base, value, verdict: 'mal', advice: 'Bajas demasiado deprisa y puedes perder músculo: come un poco más.' };
  if (pct <= -0.5) return { ...base, value, verdict: 'bien', advice: 'Ritmo ideal para perder grasa conservando el músculo.' };
  if (pct < -0.1) return { ...base, value, verdict: 'bien', advice: 'Bajas despacio. Va bien para conservar músculo; si quieres ir más rápido, recorta un poco la comida.' };
  if (pct <= 0.1) return { ...base, value, verdict: 'neutro', advice: 'Peso estable. Para perder grasa hace falta comer algo menos de lo que gastas.' };
  return { ...base, value, verdict: 'atencion', advice: 'El peso sube. Si buscas perder grasa, revisa lo que comes; si la cintura no sube, puede ser músculo.' };
}

/** Brazo o pecho con cinta: una subida sostenida de medio centímetro o más ya es creíble. */
function girthCheck(id: 'brazo' | 'pecho', key: 'arm' | 'chest', sorted: readonly BodyEntry[]): Checkpoint {
  const base = { id, title: id === 'brazo' ? 'Brazo' : 'Pecho' };
  const withValue = sorted.filter((e) => e[key] != null);
  const last = withValue[withValue.length - 1];
  if (!last) return { ...base, value: null, verdict: 'sin_datos', advice: `Mide tu ${id} con la cinta una vez al mes, siempre en frío y en el mismo punto.` };
  // Se compara con la medida más reciente que tenga al menos cuatro semanas.
  const ref = [...withValue].reverse().find((e) => days(e.date, last.date) >= 28);
  if (!ref) return { ...base, value: `${fmt(last[key]!)} cm`, verdict: 'sin_datos', advice: 'Con otra medida dentro de un mes se verá si crece.' };
  const delta = last[key]! - ref[key]!;
  const weeks = Math.round(days(ref.date, last.date) / 7);
  const value = `${signed(delta)} cm en ${weeks} semanas`;
  if (delta >= 0.5) return { ...base, value, verdict: 'bien', advice: 'Crece. Lo que estás haciendo funciona.' };
  if (delta <= -0.5) return { ...base, value, verdict: 'atencion', advice: 'Baja. Si estás perdiendo peso puede ser grasa; lo que importa es que la fuerza siga subiendo.' };
  return { ...base, value, verdict: 'neutro', advice: 'Sin cambio claro: menos de medio centímetro entra en el error de la cinta.' };
}

export function howAmIDoing(profile: Profile | null, entries: readonly BodyEntry[]): Checkpoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return [waistCheck(profile, sorted), weightCheck(sorted), girthCheck('brazo', 'arm', sorted), girthCheck('pecho', 'chest', sorted)];
}

/** Cada cuánto tocan cinta y fotos. Más a menudo no aporta y obsesiona. */
export const CHECK_EVERY_DAYS = 30;

/** ¿Toca ya la revisión mensual de cinta y fotos? */
export function monthlyCheck(entries: readonly BodyEntry[], photoDates: readonly ISODate[], today: ISODate): { due: boolean; detail: string } {
  const limit = addDays(today, -CHECK_EVERY_DAYS);
  const lastTape = entries.filter((e) => e.waist != null || e.arm != null || e.chest != null).reduce((m, e) => (e.date > m ? e.date : m), '');
  const lastPhoto = photoDates.reduce((m, d) => (d > m ? d : m), '');
  const tape = lastTape <= limit;
  const photo = lastPhoto <= limit;
  if (!tape && !photo) return { due: false, detail: '' };
  const what = tape && photo ? 'cinta y fotos' : tape ? 'cinta' : 'fotos';
  const never = (tape && !lastTape) || (photo && !lastPhoto && !tape);
  return { due: true, detail: never ? `Aún no tienes ${what}: hazlo hoy para tener el punto de partida.` : `Hace más de un mes de tu última vez con ${what}.` };
}
