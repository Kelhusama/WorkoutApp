import type { SQLiteDatabase } from 'expo-sqlite';

import { GOAL_SLOTS, onTest, type Block, type GoalId, type TestOutcome, type Variant } from '@/domain/bandit';
import type { ISODate } from '@/domain/dates';

/** Bloques de prueba del entrenador, del más antiguo al más reciente. */
export async function getBlocks(db: SQLiteDatabase, goal?: GoalId): Promise<Block[]> {
  const rows = await db.getAllAsync<{
    id: number;
    goal: GoalId;
    variant: Variant;
    start_date: ISODate;
    start_value: number;
    end_date: ISODate | null;
    end_value: number | null;
  }>('SELECT id, goal, variant, start_date, start_value, end_date, end_value FROM coach_block ORDER BY start_date, id');
  return rows
    .filter((r) => !goal || r.goal === goal)
    .map((r) => ({ id: r.id, goal: r.goal, variant: r.variant, startDate: r.start_date, startValue: r.start_value, endDate: r.end_date, endValue: r.end_value }));
}

/** Variante del bloque abierto para cada ejercicio afectado, p. ej. { 'A.dominadas': 'cortas' }. */
export async function getSlotVariants(db: SQLiteDatabase): Promise<Record<string, Variant>> {
  const out: Record<string, Variant> = {};
  for (const b of await getBlocks(db)) {
    if (b.endDate !== null) continue;
    for (const key of GOAL_SLOTS[b.goal]) out[key] = b.variant;
  }
  return out;
}

/**
 * Avanza los bloques al apuntar un test: abre el primero, deja seguir el actual si es pronto,
 * o lo cierra con su resultado y abre el siguiente con la variante elegida.
 */
export async function advanceBlocks(db: SQLiteDatabase, goal: GoalId, date: ISODate, value: number, random: () => number = Math.random): Promise<TestOutcome> {
  const blocks = await getBlocks(db, goal);
  const outcome = onTest(blocks, goal, date, value, random);
  if (outcome.kind === 'pronto') return outcome;
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (outcome.kind === 'cambio') {
      await tx.runAsync('UPDATE coach_block SET end_date = ?, end_value = ? WHERE goal = ? AND end_date IS NULL', date, value, goal);
    }
    await tx.runAsync('INSERT INTO coach_block (goal, variant, start_date, start_value) VALUES (?, ?, ?, ?)', goal, outcome.variant, date, value);
  });
  return outcome;
}
