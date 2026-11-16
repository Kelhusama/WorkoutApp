import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate } from '@/domain/dates';
import { flexProgress, type FlexLevel, type FlexProgress, type FlexResult, type FlexState } from '@/domain/flexibility';

export interface FlexSession {
  id: number;
  date: ISODate;
  level: FlexLevel;
  /** Segundos de trabajo, sin contar las pausas para colocarse. */
  seconds: number;
  /** Ejercicios hechos, al menos en parte. */
  exercises: string[];
}

/** Guarda una sesión. No guarda nada (y devuelve `null`) si no se llegó a hacer ningún ejercicio. */
export async function saveFlexSession(
  db: SQLiteDatabase,
  session: { date: ISODate; level: FlexLevel; seconds: number; exercises: readonly string[] },
): Promise<number | null> {
  const exercises = [...new Set(session.exercises)];
  const seconds = Math.round(session.seconds);
  if (exercises.length === 0 || seconds <= 0) return null;
  const r = await db.runAsync(
    'INSERT INTO flex_session (date, level, seconds, exercises) VALUES (?, ?, ?, ?)',
    session.date,
    session.level,
    seconds,
    exercises.join(','),
  );
  return r.lastInsertRowId;
}

/** Sesiones entre dos fechas (incluidas), o todas, de la más antigua a la más reciente. */
export async function getFlexSessions(db: SQLiteDatabase, from: ISODate = '0000-01-01', to: ISODate = '9999-12-31'): Promise<FlexSession[]> {
  const rows = await db.getAllAsync<{ id: number; date: ISODate; level: number; seconds: number; exercises: string }>(
    'SELECT id, date, level, seconds, exercises FROM flex_session WHERE date BETWEEN ? AND ? ORDER BY date, id',
    from,
    to,
  );
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    level: r.level as FlexLevel,
    seconds: r.seconds,
    exercises: r.exercises ? r.exercises.split(',') : [],
  }));
}

export async function deleteFlexSession(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM flex_session WHERE id = ?', id);
}

export async function addFlexTest(db: SQLiteDatabase, date: ISODate, testId: string, value: number): Promise<number> {
  const r = await db.runAsync('INSERT INTO flex_test (date, test_id, value) VALUES (?, ?, ?)', date, testId, value);
  return r.lastInsertRowId;
}

/** Resultados de un test, o de todos, del más antiguo al más reciente. */
export async function getFlexTests(db: SQLiteDatabase, testId?: string): Promise<(FlexResult & { id: number })[]> {
  const rows = testId
    ? await db.getAllAsync<FlexResult & { id: number }>(
        'SELECT id, date, test_id AS testId, value FROM flex_test WHERE test_id = ? ORDER BY date, id',
        testId,
      )
    : await db.getAllAsync<FlexResult & { id: number }>('SELECT id, date, test_id AS testId, value FROM flex_test ORDER BY date, id');
  return rows.map((r) => ({ ...r }));
}

export async function deleteFlexTest(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM flex_test WHERE id = ?', id);
}

// El nivel y el inicio del bloque se guardan en `settings`, que ya va en la copia de seguridad.
const KEY_LEVEL = 'flex_level';
const KEY_BLOCK = 'flex_block_start';

export async function getFlexState(db: SQLiteDatabase): Promise<FlexState | null> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings WHERE key IN (?, ?)', KEY_LEVEL, KEY_BLOCK);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const level = Number(map.get(KEY_LEVEL));
  const blockStart = map.get(KEY_BLOCK);
  if (!blockStart || !/^\d{4}-\d{2}-\d{2}$/.test(blockStart) || ![1, 2, 3].includes(level)) return null;
  return { level: level as FlexLevel, blockStart };
}

export async function saveFlexState(db: SQLiteDatabase, state: FlexState): Promise<void> {
  const sql = 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  await db.runAsync(sql, KEY_LEVEL, String(state.level));
  await db.runAsync(sql, KEY_BLOCK, state.blockStart);
}

export interface FlexSnapshot {
  sessions: FlexSession[];
  tests: (FlexResult & { id: number })[];
  progress: FlexProgress;
}

/** Todo lo que necesitan las pantallas, con el nivel calculado a día de hoy. No escribe nada. */
export async function loadFlex(db: SQLiteDatabase, today: ISODate): Promise<FlexSnapshot> {
  const [sessions, tests, state] = [await getFlexSessions(db), await getFlexTests(db), await getFlexState(db)];
  return { sessions, tests, progress: flexProgress(sessions.map((s) => s.date), state, today) };
}

/**
 * Guarda una sesión y deja anotados el nivel y el bloque en los que queda el programa.
 * Devuelve el progreso tras la sesión, o `null` si no había nada que guardar.
 */
export async function recordFlexSession(
  db: SQLiteDatabase,
  session: { date: ISODate; level: FlexLevel; seconds: number; exercises: readonly string[] },
): Promise<FlexProgress | null> {
  const id = await saveFlexSession(db, session);
  if (id === null) return null;
  const { progress } = await loadFlex(db, session.date);
  await saveFlexState(db, { level: progress.level, blockStart: progress.blockStart });
  return progress;
}
