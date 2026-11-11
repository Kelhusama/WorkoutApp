import { fromISODate, type ISODate } from './dates';

export type Sex = 'H' | 'M';

export interface Profile {
  heightCm: number;
  birthDate: ISODate;
  sex: Sex;
  /** Factor de actividad para el gasto diario. */
  activity: number;
}

export interface BodyEntry {
  date: ISODate;
  weight: number;
  waist?: number | null;
  neck?: number | null;
  hip?: number | null;
  arm?: number | null;
  chest?: number | null;
  /** % de grasa medido por una báscula de bioimpedancia, si lo hay. */
  bodyFat?: number | null;
}

export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: 'Sedentario', detail: 'Trabajo sentado, poco movimiento' },
  { factor: 1.375, label: 'Ligero', detail: '1–3 entrenos por semana' },
  { factor: 1.55, label: 'Moderado', detail: '3–5 entrenos por semana' },
  { factor: 1.725, label: 'Alto', detail: '6–7 entrenos por semana' },
] as const;

export type Tone = 'low' | 'good' | 'warn' | 'bad';

export interface Range {
  /** Límite superior (exclusivo). El último tramo usa Infinity. */
  max: number;
  label: string;
  tone: Tone;
}

export interface IndicatorDef {
  id: string;
  name: string;
  unit: string;
  decimals: number;
  what: string;
  formula: string;
  note?: string;
  /** Datos necesarios, para explicar por qué falta un valor. */
  needs: string;
  ranges?: (profile: Profile) => Range[];
  compute: (e: BodyEntry, profile: Profile, history: BodyEntry[]) => number | null;
}

export function ageOn(birthDate: ISODate, on: ISODate): number {
  const b = fromISODate(birthDate);
  const d = fromISODate(on);
  let age = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--;
  return age;
}

export function bmi(weight: number, heightCm: number): number {
  const h = heightCm / 100;
  return weight / (h * h);
}

/** % de grasa con la fórmula de la Marina de EE. UU. (medidas en cm). */
export function navyBodyFat(sex: Sex, heightCm: number, waist: number, neck: number, hip?: number | null): number | null {
  if (sex === 'H') {
    if (waist - neck <= 0) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  if (!hip || waist + hip - neck <= 0) return null;
  return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
}

/** % de grasa: el de la báscula si existe; si no, la fórmula de la Marina. */
export function bodyFatOf(e: BodyEntry, p: Profile): { value: number; source: 'bascula' | 'formula' } | null {
  if (e.bodyFat != null) return { value: e.bodyFat, source: 'bascula' };
  if (e.waist == null || e.neck == null) return null;
  const v = navyBodyFat(p.sex, p.heightCm, e.waist, e.neck, e.hip);
  return v == null ? null : { value: v, source: 'formula' };
}

export function leanMass(e: BodyEntry, p: Profile): number | null {
  const bf = bodyFatOf(e, p);
  return bf ? e.weight * (1 - bf.value / 100) : null;
}

/** Metabolismo basal (Mifflin-St Jeor). */
export function bmrMifflin(weight: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weight + 6.25 * heightCm - 5 * age + (sex === 'H' ? 5 : -161);
}

/** Cambio semanal de peso en % usando la medición más cercana a 7 días antes (entre 5 y 14 días). */
export function weeklyChangePct(e: BodyEntry, history: BodyEntry[]): number | null {
  const t = fromISODate(e.date).getTime();
  const DAY = 86_400_000;
  const prev = history
    .filter((h) => h.date < e.date)
    .map((h) => ({ h, days: (t - fromISODate(h.date).getTime()) / DAY }))
    .filter((x) => x.days >= 5 && x.days <= 14)
    .sort((a, b) => Math.abs(a.days - 7) - Math.abs(b.days - 7))[0];
  if (!prev) return null;
  return ((e.weight - prev.h.weight) / prev.h.weight) * 100 * (7 / prev.days);
}

export const INDICATORS: IndicatorDef[] = [
  {
    id: 'imc',
    name: 'IMC',
    unit: '',
    decimals: 1,
    what: 'Relación entre peso y altura. Útil como referencia general, pero no distingue músculo de grasa.',
    formula: 'peso (kg) ÷ altura (m)²',
    note: 'Con bastante músculo puede marcar «sobrepeso» sin serlo: míralo junto al % de grasa y la cintura.',
    needs: 'peso y altura',
    ranges: () => [
      { max: 18.5, label: 'Bajo peso', tone: 'low' },
      { max: 25, label: 'Normal', tone: 'good' },
      { max: 30, label: 'Sobrepeso', tone: 'warn' },
      { max: Infinity, label: 'Obesidad', tone: 'bad' },
    ],
    compute: (e, p) => bmi(e.weight, p.heightCm),
  },
  {
    id: 'ica',
    name: 'Cintura / altura',
    unit: '',
    decimals: 2,
    what: 'Índice cintura-altura: indica grasa abdominal, la más relacionada con riesgo cardiovascular. Regla fácil: la cintura debería medir menos de la mitad de tu altura.',
    formula: 'cintura (cm) ÷ altura (cm)',
    needs: 'cintura',
    ranges: () => [
      { max: 0.4, label: 'Muy bajo', tone: 'low' },
      { max: 0.5, label: 'Saludable', tone: 'good' },
      { max: 0.6, label: 'Riesgo aumentado', tone: 'warn' },
      { max: Infinity, label: 'Riesgo alto', tone: 'bad' },
    ],
    compute: (e, p) => (e.waist ? e.waist / p.heightCm : null),
  },
  {
    id: 'grasa',
    name: '% de grasa',
    unit: '%',
    decimals: 1,
    what: 'Porcentaje de tu peso que es grasa. Es el mejor indicador para saber si pierdes grasa y no músculo.',
    formula:
      'Fórmula de la Marina de EE. UU.: 495 ÷ (1,0324 − 0,19077·log₁₀(cintura − cuello) + 0,15456·log₁₀(altura)) − 450. En mujeres añade la cadera. Si registras el dato de una báscula, se usa ese.',
    note: 'Error típico de ±3–4 puntos: fíjate en la tendencia más que en el número exacto. Mide siempre igual: cintura a la altura del ombligo y cuello bajo la nuez.',
    needs: 'cintura y cuello (y cadera en mujeres)',
    ranges: (p) =>
      p.sex === 'H'
        ? [
            { max: 6, label: 'Esencial', tone: 'low' },
            { max: 14, label: 'Atlético', tone: 'good' },
            { max: 18, label: 'En forma', tone: 'good' },
            { max: 25, label: 'Medio', tone: 'warn' },
            { max: Infinity, label: 'Alto', tone: 'bad' },
          ]
        : [
            { max: 14, label: 'Esencial', tone: 'low' },
            { max: 21, label: 'Atlético', tone: 'good' },
            { max: 25, label: 'En forma', tone: 'good' },
            { max: 32, label: 'Medio', tone: 'warn' },
            { max: Infinity, label: 'Alto', tone: 'bad' },
          ],
    compute: (e, p) => bodyFatOf(e, p)?.value ?? null,
  },
  {
    id: 'magra',
    name: 'Masa magra',
    unit: ' kg',
    decimals: 1,
    what: 'Todo lo que no es grasa: músculo, hueso, agua y órganos. Si baja el peso y esto se mantiene, estás perdiendo grasa.',
    formula: 'peso × (1 − % grasa ÷ 100)',
    needs: 'cintura y cuello',
    compute: (e, p) => leanMass(e, p),
  },
  {
    id: 'ffmi',
    name: 'FFMI',
    unit: '',
    decimals: 1,
    what: 'Índice de masa libre de grasa: como el IMC pero solo con la masa magra. Mide cuánto músculo tienes para tu altura.',
    formula: 'masa magra ÷ altura (m)² + 6,1 × (1,8 − altura (m))  (normalizado a 1,80 m)',
    note: 'Por encima de 25 es muy difícil llegar de forma natural.',
    needs: 'cintura y cuello',
    ranges: (p) =>
      p.sex === 'H'
        ? [
            { max: 18, label: 'Bajo', tone: 'low' },
            { max: 20, label: 'Medio', tone: 'warn' },
            { max: 22, label: 'Bueno', tone: 'good' },
            { max: 23, label: 'Excelente', tone: 'good' },
            { max: Infinity, label: 'Superior', tone: 'good' },
          ]
        : [
            { max: 15, label: 'Bajo', tone: 'low' },
            { max: 17, label: 'Medio', tone: 'warn' },
            { max: 18, label: 'Bueno', tone: 'good' },
            { max: 19, label: 'Excelente', tone: 'good' },
            { max: Infinity, label: 'Superior', tone: 'good' },
          ],
    compute: (e, p) => {
      const lm = leanMass(e, p);
      if (lm == null) return null;
      const h = p.heightCm / 100;
      return lm / (h * h) + 6.1 * (1.8 - h);
    },
  },
  {
    id: 'ritmo',
    name: 'Ritmo semanal',
    unit: '%',
    decimals: 2,
    what: 'Cuánto cambia tu peso por semana. Para perder grasa sin perder músculo, lo ideal es bajar entre un 0,25 % y un 1 % por semana.',
    formula: '(peso actual − peso de hace ~7 días) ÷ peso de hace ~7 días × 100',
    note: 'Necesita una medición de hace entre 5 y 14 días. Pésate siempre en las mismas condiciones (por la mañana, en ayunas).',
    needs: 'una medición de la semana anterior',
    ranges: () => [
      { max: -1, label: 'Demasiado rápido', tone: 'bad' },
      { max: -0.25, label: 'Ideal para perder grasa', tone: 'good' },
      { max: 0.25, label: 'Estable', tone: 'warn' },
      { max: Infinity, label: 'Subiendo', tone: 'bad' },
    ],
    compute: (e, _p, history) => weeklyChangePct(e, history),
  },
  {
    id: 'basal',
    name: 'Metabolismo basal',
    unit: ' kcal',
    decimals: 0,
    what: 'Energía que gasta tu cuerpo en reposo total.',
    formula: 'Mifflin-St Jeor: 10 × peso + 6,25 × altura (cm) − 5 × edad + 5 (hombres) / − 161 (mujeres)',
    needs: 'peso, altura y fecha de nacimiento',
    compute: (e, p) => bmrMifflin(e.weight, p.heightCm, ageOn(p.birthDate, e.date), p.sex),
  },
  {
    id: 'gasto',
    name: 'Gasto diario',
    unit: ' kcal',
    decimals: 0,
    what: 'Calorías que gastas al día contando tu actividad. Para perder grasa, come unas 300–500 kcal menos que esto.',
    formula: 'metabolismo basal × factor de actividad',
    needs: 'peso, altura y fecha de nacimiento',
    compute: (e, p) => bmrMifflin(e.weight, p.heightCm, ageOn(p.birthDate, e.date), p.sex) * p.activity,
  },
];

export interface Point {
  date: ISODate;
  value: number;
}

/** Histórico de un indicador; `entries` en orden cronológico. */
export function seriesFor(def: IndicatorDef, entries: BodyEntry[], profile: Profile): Point[] {
  const out: Point[] = [];
  entries.forEach((e, i) => {
    const v = def.compute(e, profile, entries.slice(0, i));
    if (v != null && Number.isFinite(v)) out.push({ date: e.date, value: v });
  });
  return out;
}

export function rangeFor(def: IndicatorDef, profile: Profile, value: number): Range | null {
  const ranges = def.ranges?.(profile);
  if (!ranges) return null;
  return ranges.find((r) => value < r.max) ?? ranges[ranges.length - 1];
}

export function formatValue(def: IndicatorDef, v: number): string {
  const s = v.toFixed(def.decimals).replace('.', ',');
  return `${def.id === 'ritmo' && v > 0 ? '+' : ''}${s}${def.unit}`;
}

/** Recomendaciones derivadas para perder grasa manteniendo músculo. */
export function targets(e: BodyEntry, p: Profile) {
  const tdee = bmrMifflin(e.weight, p.heightCm, ageOn(p.birthDate, e.date), p.sex) * p.activity;
  return {
    kcalMin: Math.round((tdee - 500) / 10) * 10,
    kcalMax: Math.round((tdee - 300) / 10) * 10,
    proteinMin: Math.round(e.weight * 1.6),
    proteinMax: Math.round(e.weight * 2.2),
  };
}
