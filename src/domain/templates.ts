import { lightSets } from './coach';
import { EXERCISES, type Exercise } from './exercises';
import type { Prescription, SlotRules } from './progression';
import type { RoutineItem } from './routines';
import type { SessionKind } from './schedule';
import { EXERCISE_MUSCLES } from './volume';

export interface Slot extends SlotRules {
  /** Identificador estable para guardar la progresión, p. ej. 'A.dominadas'. */
  key: string;
  exerciseId: string;
  initialSets: number;
  note?: string;
}

export const slot = (
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
    slot('A.tibial', 'elevacion_tibial', 2, 15, 25, 3),
    slot('A.gemelo', 'elevacion_talones', 2, 10, 20, 3),
    slot('A.hollow', 'hollow', 2, 15, 40, 3, {
      allowsTempo: false,
      step: 5,
      note: 'La postura de la dominada estricta. Empieza con las rodillas dobladas si cuesta.',
    }),
  ],
  B: [
    slot('B.flexiones', 'flexion_estricta', 4, 4, 8, 5),
    slot('B.inclinadas', 'flexion_inclinada', 3, 10, 15, 4),
    slot('B.pica', 'flexion_pica', 3, 5, 8, 4),
    slot('B.muneca', 'curl_muneca', 2, 15, 20, 3),
    slot('B.muneca_inv', 'curl_muneca_inverso', 2, 15, 20, 3),
    slot('B.copenhague', 'plancha_copenhague', 2, 15, 40, 3, {
      allowsTempo: false,
      step: 5,
      note: 'Empieza apoyando la rodilla; pasa al pie cuando aguantes 40 s.',
    }),
    slot('B.abduccion', 'abduccion_cadera', 2, 12, 20, 3),
    slot('B.deadbug', 'dead_bug', 2, 6, 12, 3, { allowsTempo: false, note: 'Lento y con la zona lumbar pegada al suelo.' }),
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
    slot('C.zancada', 'zancada_estatica', 2, 8, 15, 3),
    slot('C.pm1', 'peso_muerto_una_pierna', 2, 8, 12, 3),
    slot('C.rodillas', 'rodillas_colgado', 2, 5, 12, 3, {
      allowsTempo: false,
      note: 'Sin balanceo. Si el agarre va justo después de las dominadas, haz la barca en su lugar.',
    }),
  ],
};

/**
 * Orden de importancia dentro de cada sesión, para las rutinas corta y media. El objetivo que manda son
 * las dominadas: primero ellas y lo que las ayuda (remo, curl, la barca que da su postura, colgarse para
 * el agarre); después flexiones y hombro; al final pierna y accesorios, que rotan entre versiones.
 */
export const PRIORITY: Record<SessionKind, readonly string[]> = {
  A: ['A.dominadas', 'A.negativas', 'A.remo', 'A.curl', 'A.hollow', 'A.gemelo', 'A.tibial'],
  B: ['B.flexiones', 'B.inclinadas', 'B.deadbug', 'B.pica', 'B.copenhague', 'B.muneca', 'B.abduccion', 'B.muneca_inv'],
  C: ['C.dominadas', 'C.press', 'C.martillo', 'C.colgarse', 'C.rodillas', 'C.pajaros', 'C.zancada', 'C.pm1'],
};

/** Claves del bloque de pierna de cada sesión: no necesita material, así que también se hace de viaje. */
export const LEG_KEYS: Record<SessionKind, string[]> = {
  A: ['A.tibial', 'A.gemelo'],
  B: ['B.copenhague', 'B.abduccion'],
  C: ['C.zancada', 'C.pm1'],
};

/** Abdomen de cada sesión. De viaje se hace el que no necesita barra. */
export const CORE_KEYS: Record<SessionKind, string> = { A: 'A.hollow', B: 'B.deadbug', C: 'C.rodillas' };

export function initialPrescription(s: Slot): Prescription {
  return { sets: s.initialSets, reps: s.repsMin, tempo: 0 };
}

export function exerciseFor(s: Slot): Exercise {
  const ex = EXERCISES[s.exerciseId];
  if (!ex) throw new Error(`Ejercicio desconocido: ${s.exerciseId}`);
  return ex;
}

/**
 * Descanso recomendado entre series, en segundos. Coincide con los botones del temporizador.
 * Aguantes y abdomen, poco; dominadas, lo más largo; el resto, un minuto o minuto y medio.
 * En sesión ligera se dejan repeticiones sin hacer, así que basta un minuto como mucho.
 */
export function restSeconds(s: Slot, light = false): number {
  if (light) return Math.min(60, restSeconds(s));
  const ex = exerciseFor(s);
  if (ex.measure === 'time' || ex.muscles.includes('Abdomen')) return 45;
  if (ex.equipment === 'barra') return 120;
  // Accesorios de antebrazo: no hace falta más de un minuto.
  if (ex.id.startsWith('curl_muneca')) return 60;
  if (ex.equipment === 'ninguno' && !ex.muscles.includes('Pecho') && !ex.muscles.includes('Tríceps') && !ex.muscles.includes('Hombro')) return 60;
  return 90;
}

export function restText(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
}

export function unitFor(ex: Exercise): string {
  return ex.measure === 'time' ? ' s' : '';
}

/**
 * Versiones más duras de cada ejercicio, en orden, con el material que ya hay en casa
 * (mochila, una silla, las gomas). Al completar toda la escalera de series y repeticiones
 * se pasa a la siguiente y la escalera vuelve a empezar. Sin banco.
 */
export const STAGES: Record<string, readonly string[]> = {
  'A.dominadas': ['Con mochila lastrada, unos 3 kg', 'Con mochila lastrada, unos 6 kg'],
  'C.dominadas': ['Con mochila lastrada, unos 3 kg', 'Con mochila lastrada, unos 6 kg'],
  'A.remo': ['Con la goma pisada y sujeta junto a la mancuerna'],
  'A.curl': ['Con la goma pisada y sujeta junto a la mancuerna'],
  'B.flexiones': ['Con los pies sobre una silla', 'Con mochila lastrada, unos 5 kg', 'Pies sobre una silla y mochila lastrada'],
  'B.inclinadas': ['Con las manos más bajas: un escalón o un libro grueso'],
  'B.pica': ['Con los pies sobre una silla'],
  'C.press': ['Con la goma pisada y sujeta junto a la mancuerna'],
  'C.martillo': ['Con la goma pisada y sujeta junto a la mancuerna'],
};

/** Cómo se hace el ejercicio en la etapa indicada; null en la versión normal (etapa 0). */
export function stageNote(slotKey: string, stage: number): string | null {
  return stage > 0 ? (STAGES[slotKey]?.[stage - 1] ?? null) : null;
}

/** ¿Queda una versión más dura después de esta etapa? */
export function hasNextStage(slotKey: string, stage: number): boolean {
  return stage < (STAGES[slotKey]?.length ?? 0);
}

/** Sesión de casa enfocada: solo lo que persigue los objetivos. Comparte progresión con las sesiones normales. */
export const FOCUS_KEYS: readonly string[] = ['A.dominadas', 'B.flexiones', 'A.curl', 'B.inclinadas'];

/**
 * Con el plan de dominadas activo, la sesión enfocada deja las dominadas a ese plan y se dedica
 * a lo demás: tres tipos de flexión y tres ejercicios con la mancuerna.
 */
export const FOCUS_KEYS_WITH_PULLUP_PLAN: readonly string[] = ['B.flexiones', 'B.inclinadas', 'B.pica', 'A.curl', 'C.martillo', 'C.press'];

export function focusSlots(pullupPlan = false): Slot[] {
  const all = Object.values(TEMPLATES).flat();
  return (pullupPlan ? FOCUS_KEYS_WITH_PULLUP_PLAN : FOCUS_KEYS).map((k) => all.find((s) => s.key === k)!);
}

/**
 * Lo que necesitan las rutinas de cada ejercicio de la sesión: cuánto se tarda, qué músculos trabaja
 * y si puede alternarse con otro. `order` son las claves por importancia; lo que no esté, al final.
 */
export function routineItems(slots: readonly Slot[], targets: Record<string, Prescription>, order: readonly string[]): RoutineItem[] {
  return slots.map((s, i) => {
    const ex = exerciseFor(s);
    const t = targets[s.key];
    const base = { amount: t.reps, byTime: ex.measure === 'time', perSide: ex.perArm };
    const rank = order.indexOf(s.key);
    return {
      key: s.key,
      rank: rank < 0 ? order.length + i : rank,
      full: { ...base, sets: t.sets, rest: restSeconds(s) },
      light: { ...base, sets: lightSets(t.sets), rest: restSeconds(s, true) },
      groups: Object.keys(EXERCISE_MUSCLES[s.exerciseId] ?? {}),
      // Las dominadas y sus bajadas lentas, siempre solas y con el descanso entero.
      solo: /^(dominada|negativa)/.test(s.exerciseId),
    };
  });
}
