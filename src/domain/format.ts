import type { Exercise } from './exercises';
import { TEMPO_LABEL, type ChangeKind, type Prescription } from './progression';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 repeticiones" · "30 segundos". */
export function amountText(value: number, ex: Exercise, short = false): string {
  if (ex.measure === 'time') return short ? `${value} s` : plural(value, 'segundo', 'segundos');
  return short ? `${value} reps` : plural(value, 'repetición', 'repeticiones');
}

/** "5 series de 2 repeticiones por brazo". */
export function prescriptionText(p: Prescription, ex: Exercise): string {
  return `${plural(p.sets, 'serie', 'series')} de ${amountText(p.reps, ex)}${ex.perArm ? ' con cada brazo' : ''}`;
}

export function describeChange(change: ChangeKind, next: Prescription, ex: Exercise): string {
  const p = prescriptionText(next, ex);
  switch (change) {
    case 'reps':
      return `Sube: la próxima vez, ${p}.`;
    case 'tempo':
      return `Nuevo reto: ${TEMPO_LABEL[next.tempo]!.toLowerCase()}. Vuelves a ${p}.`;
    case 'sets':
      return `Una serie más: ${p}.`;
    case 'variante':
      return 'Has llegado al tope: listo para una variante más difícil.';
    case 'none':
      return `Se mantiene: ${p}.`;
  }
}

/** "5 series · 2 reps" para listas compactas. */
export function prescriptionShort(p: Prescription, ex: Exercise): string {
  return `${plural(p.sets, 'serie', 'series')} · ${amountText(p.reps, ex, true)}${ex.perArm ? '/brazo' : ''}`;
}
