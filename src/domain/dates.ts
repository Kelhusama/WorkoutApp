/** Fecha local en formato YYYY-MM-DD. */
export type ISODate = string;

export const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const DAY_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Mediodía local, para evitar saltos por cambio de hora. */
export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(s: ISODate): number {
  return (fromISODate(s).getDay() + 6) % 7;
}

/** Lunes de la semana de la fecha dada. */
export function weekStart(s: ISODate): ISODate {
  return addDays(s, -weekdayIndex(s));
}

export function formatLong(s: ISODate): string {
  const d = fromISODate(s);
  return `${DAY_LONG[weekdayIndex(s)]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatShort(s: ISODate): string {
  const d = fromISODate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
