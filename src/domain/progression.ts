export type Feeling = 'facil' | 'normal' | 'dura';

/** 0 = normal · 1 = bajada lenta (3–4 s) · 2 = bajada lenta + pausa arriba. */
export type Tempo = 0 | 1 | 2;

export interface Prescription {
  sets: number;
  /** Repeticiones por serie, o segundos si el ejercicio es por tiempo. */
  reps: number;
  tempo: Tempo;
}

export interface SlotRules {
  repsMin: number;
  repsMax: number;
  maxSets: number;
  /** Incremento: 1 repetición, o 5 s en ejercicios por tiempo. */
  step: number;
  allowsTempo: boolean;
}

export type ChangeKind = 'reps' | 'tempo' | 'sets' | 'variante' | 'none';

export interface ProgressionResult {
  next: Prescription;
  change: ChangeKind;
}

export const TEMPO_LABEL: Record<Tempo, string | null> = {
  0: null,
  1: 'Bajada lenta 3–4 s',
  2: 'Bajada lenta + pausa 1–2 s',
};

export const FEELING_LABEL: Record<Feeling, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dura: 'Dura',
};

/** Se completó si se hicieron todas las series con al menos las repeticiones objetivo. */
export function isCompleted(target: Prescription, done: number[]): boolean {
  return done.length >= target.sets && done.slice(0, target.sets).every((v) => v >= target.reps);
}

/**
 * Escalera de dificultad con peso fijo:
 * 1) más repeticiones hasta el tope → 2) tempo lento → 3) pausa → 4) una serie más → 5) variante.
 * Fácil sube un peldaño; normal solo sube repeticiones; dura o incompleta mantiene.
 */
export function progress(
  current: Prescription,
  rules: SlotRules,
  outcome: { completed: boolean; feeling: Feeling },
): ProgressionResult {
  const hold: ProgressionResult = { next: current, change: 'none' };
  if (!outcome.completed || outcome.feeling === 'dura') return hold;

  if (current.reps < rules.repsMax) {
    return {
      next: { ...current, reps: Math.min(rules.repsMax, current.reps + rules.step) },
      change: 'reps',
    };
  }
  if (outcome.feeling === 'normal') return hold;

  if (rules.allowsTempo && current.tempo < 2) {
    return {
      next: { ...current, tempo: (current.tempo + 1) as Tempo, reps: rules.repsMin },
      change: 'tempo',
    };
  }
  if (current.sets < rules.maxSets) {
    return { next: { ...current, sets: current.sets + 1, reps: rules.repsMin }, change: 'sets' };
  }
  return { next: current, change: 'variante' };
}
