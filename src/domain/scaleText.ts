import type { BodyEntry } from './body';
import type { ISODate } from './dates';

/**
 * Lee el texto de una captura de «Datos de medición del cuerpo» de Huawei Salud
 * (copiado con «Copiar texto» del móvil o, más adelante, leído por la app) y saca los valores.
 *
 * El texto puede llegar ficha a ficha (etiqueta, valor, etiqueta, valor…) o fila a fila
 * (tres etiquetas y luego sus tres valores). En los dos casos cada valor corresponde a la
 * etiqueta más antigua que aún no tiene valor, comprobando la unidad y que el número sea creíble.
 */

type Unit = '%' | 'kg' | 'kcal' | '';
type ScaleField = Exclude<keyof BodyEntry, 'date' | 'waist' | 'neck' | 'hip' | 'arm' | 'chest'>;

interface FieldDef {
  /** `null` = se reconoce para no descolocar el resto, pero no se guarda (el IMC lo calcula la app). */
  field: ScaleField | null;
  label: RegExp;
  unit: Unit;
  min: number;
  max: number;
}

// El orden importa: las etiquetas más específicas van antes.
const FIELDS: FieldDef[] = [
  { field: null, label: /\bimc\b/, unit: '', min: 10, max: 60 },
  { field: 'visceralFat', label: /grasa visceral/, unit: '', min: 1, max: 30 },
  { field: 'bodyFat', label: /grasa corporal/, unit: '%', min: 3, max: 60 },
  { field: 'fatFreeMass', label: /masa libre/, unit: 'kg', min: 30, max: 120 },
  { field: 'skeletalMuscle', label: /masa mus\w*/, unit: 'kg', min: 15, max: 70 },
  { field: 'scaleBmr', label: /tasa metab\w*|metabolismo basal/, unit: 'kcal', min: 800, max: 3500 },
  { field: 'water', label: /agua en el cuerpo|agua corporal/, unit: '%', min: 30, max: 75 },
  { field: 'boneMass', label: /contenido de ma\w*|contenido mineral\w*|masa osea/, unit: 'kg', min: 1, max: 6 },
  { field: 'protein', label: /proteinas?/, unit: '%', min: 5, max: 30 },
  { field: 'bodyAge', label: /edad corporal/, unit: '', min: 10, max: 99 },
  { field: 'bodyScore', label: /puntuacion\w*/, unit: '', min: 1, max: 100 },
];

export const SCALE_FIELD_LABEL: Record<ScaleField, string> = {
  weight: 'Peso',
  bodyFat: '% de grasa',
  skeletalMuscle: 'Músculo esquelético',
  fatFreeMass: 'Masa libre de grasa',
  water: '% de agua',
  protein: '% de proteína',
  boneMass: 'Masa ósea',
  visceralFat: 'Grasa visceral',
  scaleBmr: 'Metabolismo basal',
  bodyAge: 'Edad corporal',
  bodyScore: 'Puntuación',
};

export interface ScaleReading {
  values: Partial<Record<ScaleField, number>>;
  /** Fecha de la medición si aparece en el texto. */
  date: ISODate | null;
  /** Campos encontrados, en el orden del formulario. */
  found: ScaleField[];
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');

const DATE_RE = new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${MONTHS.join('|')})[a-z]*\\.?(?:\\s*(?:de\\s+)?(20\\d{2}))?`);

/** «mié, 30 sept, 7:24» → fecha. Sin año en el texto, se toma el más reciente que no sea futuro. */
function findDate(text: string, today: ISODate): ISODate | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS.indexOf(m[2]) + 1;
  if (day < 1 || day > 31) return null;
  let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  let date = `${year}-${pad(month)}-${pad(day)}`;
  if (!m[3] && date > today) date = `${--year}-${pad(month)}-${pad(day)}`;
  return date;
}

type Item = { at: number; kind: 'label'; def: FieldDef } | { at: number; kind: 'value'; value: number; unit: Unit; decimal: boolean };

function itemsOf(line: string): Item[] {
  const items: Item[] = [];
  const taken: [number, number][] = [];
  for (const def of FIELDS) {
    const re = new RegExp(def.label.source, 'g');
    for (let m = re.exec(line); m; m = re.exec(line)) {
      const span: [number, number] = [m.index, m.index + m[0].length];
      if (taken.some(([a, b]) => span[0] < b && a < span[1])) continue; // ya es parte de otra etiqueta
      taken.push(span);
      items.push({ at: m.index, kind: 'label', def });
    }
  }
  const num = /(\d+(?:[.,]\d+)?)\s*(kcal|kg|%)?/g;
  for (let m = num.exec(line); m; m = num.exec(line)) {
    const before = line[m.index - 1];
    const after = line[m.index + m[1].length];
    if (before === ':' || after === ':') continue; // horas como 7:24
    items.push({
      at: m.index,
      kind: 'value',
      value: Number(m[1].replace(',', '.')),
      unit: (m[2] ?? '') as Unit,
      decimal: /[.,]/.test(m[1]),
    });
  }
  return items.sort((a, b) => a.at - b.at);
}

export function parseScaleText(raw: string, today: ISODate): ScaleReading {
  const text = normalize(raw);
  const date = findDate(text, today);
  // El resumen «Composición corporal» repite agua, proteínas y grasa en kg: no se lee.
  const body = text.split(/composicion corporal/)[0];
  // Fuera el título y la línea de la fecha: contienen «grasa corporal» y números que no son medidas.
  const lines = body.split(/\r?\n/).filter((l) => !/bascula|datos de medicion/.test(l) && !DATE_RE.test(l));

  const values: Partial<Record<ScaleField, number>> = {};
  const pending: FieldDef[] = [];

  for (const line of lines) {
    for (const item of itemsOf(line)) {
      if (item.kind === 'label') {
        const seen = item.def.field && values[item.def.field] !== undefined;
        if (!seen && !pending.includes(item.def)) pending.push(item.def);
        continue;
      }
      const fits = (d: FieldDef) => item.value >= d.min && item.value <= d.max && (item.unit === '' || d.unit === item.unit);
      const i = pending.findIndex(fits);
      if (i >= 0) {
        // Las etiquetas anteriores que se han saltado se quedan sin valor: no deben coger uno posterior.
        const def = pending.splice(0, i + 1)[i];
        if (def.field) values[def.field] = item.value;
      } else if (
        values.weight === undefined &&
        pending.length === 0 &&
        Object.keys(values).length === 0 &&
        item.value >= 30 &&
        item.value <= 300 &&
        (item.unit === 'kg' || (item.unit === '' && item.decimal))
      ) {
        // El peso va en grande antes de las fichas, sin etiqueta.
        values.weight = item.value;
      }
    }
  }

  const order = Object.keys(SCALE_FIELD_LABEL) as ScaleField[];
  return { values, date, found: order.filter((f) => values[f] !== undefined) };
}
