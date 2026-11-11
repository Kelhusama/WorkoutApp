/** 1RM estimado (fórmula de Epley), redondeado a 0,5 kg. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const raw = reps === 1 ? weight : weight * (1 + reps / 30);
  return Math.round(raw * 2) / 2;
}

export interface Goal {
  id: 'dominadas' | 'flexiones' | 'banca';
  title: string;
  unit: string;
  start: number;
  target: number;
  milestones: number[];
}

export const GOALS: Goal[] = [
  { id: 'dominadas', title: 'Dominadas seguidas', unit: '', start: 4, target: 10, milestones: [6, 8, 10] },
  { id: 'flexiones', title: 'Flexiones estrictas', unit: '', start: 7, target: 50, milestones: [15, 25, 40, 50] },
  { id: 'banca', title: 'Press de banca (1RM est.)', unit: ' kg', start: 50, target: 80, milestones: [60, 70, 80] },
];

/** Progreso 0–1 desde el punto de partida hasta la meta. */
export function goalProgress(goal: Goal, current: number): number {
  const span = goal.target - goal.start;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (current - goal.start) / span));
}

export function nextMilestone(goal: Goal, current: number): number | null {
  return goal.milestones.find((m) => m > current) ?? null;
}
