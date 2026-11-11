import { EXERCISES, type Exercise } from './exercises';
import type { Prescription, SlotRules } from './progression';
import type { SessionKind } from './schedule';

export interface Slot extends SlotRules {
  /** Identificador estable para guardar la progresión, p. ej. 'A.dominadas'. */
  key: string;
  exerciseId: string;
  initialSets: number;
  note?: string;
}

const slot = (
  key: string,
  exerciseId: string,
  initialSets: number,
  repsMin: number,
  repsMax: number,
  maxSets: number,
  opts: { allowsTempo?: boolean; step?: number; note?: string } = {},
): Slot => ({
  key,
  exerciseId,
  initialSets,
  repsMin,
  repsMax,
  maxSets,
  step: opts.step ?? 1,
  allowsTempo: opts.allowsTempo ?? true,
  note: opts.note,
});

export const TEMPLATES: Record<SessionKind, Slot[]> = {
  A: [
    slot('A.dominadas', 'dominada_supina', 5, 2, 4, 7, {
      allowsTempo: false,
      note: 'Alterna agarre supino y neutro. Sin llegar al fallo.',
    }),
    slot('A.negativas', 'negativa_dominada', 3, 1, 3, 4, { allowsTempo: false }),
    slot('A.remo', 'remo_mancuerna', 3, 10, 15, 4),
    slot('A.curl', 'curl_concentrado', 3, 8, 12, 4),
  ],
  B: [
    slot('B.flexiones', 'flexion_estricta', 4, 4, 8, 5),
    slot('B.inclinadas', 'flexion_inclinada', 3, 10, 15, 4),
    slot('B.pica', 'flexion_pica', 3, 5, 8, 4),
    slot('B.muneca', 'curl_muneca', 2, 15, 20, 3),
    slot('B.muneca_inv', 'curl_muneca_inverso', 2, 15, 20, 3),
  ],
  C: [
    slot('C.dominadas', 'dominada_neutra', 3, 2, 3, 4, {
      allowsTempo: false,
      note: 'Suave: si cuesta, usa la goma.',
    }),
    slot('C.press', 'press_militar_una_mano', 3, 8, 12, 4),
    slot('C.martillo', 'curl_martillo', 3, 10, 12, 4),
    slot('C.pajaros', 'pajaros', 2, 12, 20, 3),
    slot('C.colgarse', 'colgarse', 2, 30, 60, 3, { allowsTempo: false, step: 5 }),
  ],
};

export function initialPrescription(s: Slot): Prescription {
  return { sets: s.initialSets, reps: s.repsMin, tempo: 0 };
}

export function exerciseFor(s: Slot): Exercise {
  const ex = EXERCISES[s.exerciseId];
  if (!ex) throw new Error(`Ejercicio desconocido: ${s.exerciseId}`);
  return ex;
}

export function unitFor(ex: Exercise): string {
  return ex.measure === 'time' ? ' s' : '';
}
