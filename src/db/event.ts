import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate } from '@/domain/dates';
import type { TrialLog } from '@/domain/event';

export type SavedTrialLog = TrialLog & { id: number };

/** Sesiones apuntadas para la prueba, de la más antigua a la más reciente. */
export async function getTrialLogs(db: SQLiteDatabase): Promise<SavedTrialLog[]> {
  return db.getAllAsync<SavedTrialLog>('SELECT id, date, lift, weight, reps, sets, reserve, grip FROM trial_log ORDER BY date, id');
}

export async function addTrialLog(db: SQLiteDatabase, log: TrialLog): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO trial_log (date, lift, weight, reps, sets, reserve, grip) VALUES (?, ?, ?, ?, ?, ?, ?)',
    log.date,
    log.lift,
    log.weight,
    log.reps,
    log.sets,
    log.reserve,
    log.grip ?? null,
  );
  return r.lastInsertRowId;
}

export async function deleteTrialLog(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM trial_log WHERE id = ?', id);
}

/** Último peso corporal apuntado, o null si no hay ninguno. */
export async function getLastBodyWeight(db: SQLiteDatabase): Promise<{ date: ISODate; weight: number } | null> {
  return db.getFirstAsync<{ date: ISODate; weight: number }>('SELECT date, weight FROM body_log ORDER BY date DESC LIMIT 1');
}
