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

export type ChangeKind = 'reps' | 'tempo' | 'sets' | 'variante' | 'baja' | 'none';

export interface ProgressionResult {
  next: Prescription;
  change: ChangeKind;
  /** Por qué el entrenador ha decidido esto, en una frase. */
  reason: string;
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

export interface Outcome {
  completed: boolean;
  feeling: Feeling;
  /** Lo que quedaba en la última serie de este ejercicio: 0 nada · 1 una o dos · 2 tres o más. */
  reserve?: 0 | 1 | 2 | null;
  /** Sesiones seguidas sin completarlo, contando esta. */
  misses?: number;
  /** Sesión ligera: se apunta, pero no mueve el plan. */
  light?: boolean;
}

/**
 * Escalera de dificultad con peso fijo:
 * 1) más repeticiones hasta el tope → 2) tempo lento → 3) pausa → 4) una serie más → 5) variante.
 *
 * Manda lo que quedaba en la última serie de cada ejercicio; si no se apuntó, la sensación de la sesión.
 * Con margen sube (dos de golpe si sobraban tres o más); al límite se repite;
 * dos sesiones seguidas sin completarlo, baja un peldaño.
 */
export function progress(current: Prescription, rules: SlotRules, outcome: Outcome): ProgressionResult {
  const hold = (reason: string): ProgressionResult => ({ next: current, change: 'none', reason });
  if (outcome.light) return hold('Sesión ligera: hoy no se sube ni se baja.');

  if (!outcome.completed) {
    if ((outcome.misses ?? 1) < 2) return hold('No salieron todas las series: se repite.');
    const reason = 'Dos sesiones seguidas sin completarlo: bajo un peldaño para que vuelva a salir bien.';
    if (current.reps > rules.repsMin) {
      return { next: { ...current, reps: Math.max(rules.repsMin, current.reps - rules.step) }, change: 'baja', reason };
    }
    if (current.tempo > 0) {
      return { next: { ...current, tempo: (current.tempo - 1) as Tempo, reps: rules.repsMax }, change: 'baja', reason };
    }
    return hold('Se repite: ya está en el punto más bajo de la escalera.');
  }

  const asked = outcome.reserve != null;
  const margin = asked ? outcome.reserve! : outcome.feeling === 'facil' ? 2 : outcome.feeling === 'normal' ? 1 : 0;
  if (margin === 0) {
    return hold(asked ? 'Completado al límite: se repite para afianzarlo.' : 'La sesión fue dura: se repite.');
  }

  if (current.reps < rules.repsMax) {
    const jump = asked && margin === 2 ? 2 : 1;
    return {
      next: { ...current, reps: Math.min(rules.repsMax, current.reps + rules.step * jump) },
      change: 'reps',
      reason: jump === 2 ? 'Te sobraban tres o más: subes dos de golpe.' : 'Completado con margen: un poco más.',
    };
  }

  // En el tope del rango: con la reserva apuntada basta con que quede margen; sin ella, que haya sido fácil.
  if (!asked && margin < 2) return hold('En el tope del rango: cuando resulte fácil, sube la dificultad.');
  const reason = 'Tope del rango completado con margen: sube la dificultad.';
  if (rules.allowsTempo && current.tempo < 2) {
    return { next: { ...current, tempo: (current.tempo + 1) as Tempo, reps: rules.repsMin }, change: 'tempo', reason };
  }
  if (current.sets < rules.maxSets) {
    return { next: { ...current, sets: current.sets + 1, reps: rules.repsMin }, change: 'sets', reason };
  }
  return { next: current, change: 'variante', reason: 'Has completado toda la escalera de este ejercicio.' };
}
