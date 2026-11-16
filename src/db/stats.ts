import type { SQLiteDatabase } from 'expo-sqlite';

import type { Point } from '@/domain/body';
import type { ISODate } from '@/domain/dates';
import type { Bests, SessionSets } from '@/domain/stats';
import { estimate1RM } from '@/domain/strength';

/** Series de un ejercicio en cada sesión hecha, por orden de fecha. */
export async function getExerciseHistory(db: SQLiteDatabase, exerciseId: string): Promise<SessionSets[]> {
  const rows = await db.getAllAsync<{ date: ISODate; value: number }>(
    `SELECT s.date AS date, l.value AS value
       FROM set_log l JOIN session_log s ON s.id = l.session_id
      WHERE l.exercise_id = ? AND s.status = 'done'
      ORDER BY s.date, l.slot_key, l.set_index`,
    exerciseId,
  );
  const out: SessionSets[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.date === r.date) last.values.push(r.value);
    else out.push({ date: r.date, values: [r.value] });
  }
  return out;
}

/** Mejores marcas de cada ejercicio, sin contar la fecha indicada (la sesión que se está guardando). */
export async function getBests(db: SQLiteDatabase, excludeDate: ISODate = ''): Promise<Map<string, Bests>> {
  const rows = await db.getAllAsync<{ exercise_id: string; bestSet: number; bestTotal: number }>(
    `SELECT exercise_id, MAX(top) AS bestSet, MAX(total) AS bestTotal FROM (
       SELECT l.exercise_id AS exercise_id, MAX(l.value) AS top, SUM(l.value) AS total
         FROM set_log l JOIN session_log s ON s.id = l.session_id
        WHERE s.status = 'done' AND s.date <> ?
        GROUP BY l.exercise_id, s.date
     ) GROUP BY exercise_id`,
    excludeDate,
  );
  return new Map(rows.map((r) => [r.exercise_id, { bestSet: r.bestSet, bestTotal: r.bestTotal }]));
}

/** Ejercicios con algún registro: cuántas sesiones y la última fecha. */
export async function getExerciseSummaries(db: SQLiteDatabase) {
  return db.getAllAsync<{ exerciseId: string; sessions: number; lastDate: ISODate }>(
    `SELECT l.exercise_id AS exerciseId, COUNT(DISTINCT s.date) AS sessions, MAX(s.date) AS lastDate
       FROM set_log l JOIN session_log s ON s.id = l.session_id
      WHERE s.status = 'done'
      GROUP BY l.exercise_id
      ORDER BY lastDate DESC, exerciseId`,
  );
}

/** 1RM estimado de press de banca en cada sesión de gimnasio. */
export async function getBenchSeries(db: SQLiteDatabase): Promise<Point[]> {
  const rows = await db.getAllAsync<{ date: ISODate; bench_weight: number; bench_reps: number }>(
    `SELECT date, bench_weight, bench_reps FROM session_log
      WHERE bench_weight IS NOT NULL AND status = 'done' ORDER BY date`,
  );
  return rows.map((r) => ({ date: r.date, value: estimate1RM(r.bench_weight, r.bench_reps) }));
}

/** Mejor resultado de cada día de test de máximo. */
export async function getTestSeries(db: SQLiteDatabase, test: 'dominadas' | 'flexiones'): Promise<Point[]> {
  return db.getAllAsync<Point>(
    'SELECT date, MAX(value) AS value FROM test_log WHERE test = ? GROUP BY date ORDER BY date',
    test,
  );
}

// ---------- Fotos de progreso ----------

export type PhotoPose = 'frente' | 'lado' | 'espalda';

export interface ProgressPhoto {
  id: number;
  date: ISODate;
  pose: PhotoPose;
  uri: string;
}

export async function getPhotos(db: SQLiteDatabase): Promise<ProgressPhoto[]> {
  return db.getAllAsync<ProgressPhoto>('SELECT id, date, pose, uri FROM progress_photo ORDER BY date, id');
}

export async function addPhoto(db: SQLiteDatabase, p: Omit<ProgressPhoto, 'id'>): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO progress_photo (date, pose, uri, created_at) VALUES (?, ?, ?, ?)',
    p.date,
    p.pose,
    p.uri,
    new Date().toISOString(),
  );
  return r.lastInsertRowId;
}

export async function deletePhoto(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM progress_photo WHERE id = ?', id);
}
