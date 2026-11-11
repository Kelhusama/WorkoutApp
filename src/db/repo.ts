import type { SQLiteDatabase } from 'expo-sqlite';

import { weekStart, type ISODate } from '@/domain/dates';
import {
  isCompleted,
  progress,
  type ChangeKind,
  type Feeling,
  type Prescription,
  type Tempo,
} from '@/domain/progression';
import { DEFAULT_SECOND_GYM, type SecondGymDay, type SessionKind } from '@/domain/schedule';
import { estimate1RM } from '@/domain/strength';
import { TEMPLATES, initialPrescription } from '@/domain/templates';

export type LogKind = SessionKind | 'gym';

export interface SessionLog {
  id: number;
  date: ISODate;
  kind: LogKind;
  status: 'done' | 'missed';
  feeling: Feeling | null;
  bench_weight: number | null;
  bench_reps: number | null;
}

const now = () => new Date().toISOString();

// ---------- Semana ----------

export async function getSecondGym(db: SQLiteDatabase, date: ISODate): Promise<SecondGymDay> {
  const row = await db.getFirstAsync<{ second_gym: SecondGymDay }>(
    'SELECT second_gym FROM week_config WHERE week_start = ?',
    weekStart(date),
  );
  return row?.second_gym ?? DEFAULT_SECOND_GYM;
}

/** Configuración de segundo gimnasio de todas las semanas que empiezan en el rango. */
export async function getWeekConfigs(db: SQLiteDatabase, from: ISODate, to: ISODate) {
  const rows = await db.getAllAsync<{ week_start: ISODate; second_gym: SecondGymDay }>(
    'SELECT week_start, second_gym FROM week_config WHERE week_start BETWEEN ? AND ?',
    weekStart(from),
    to,
  );
  return new Map(rows.map((r) => [r.week_start, r.second_gym]));
}

export async function setSecondGym(db: SQLiteDatabase, date: ISODate, day: SecondGymDay) {
  await db.runAsync(
    'INSERT INTO week_config (week_start, second_gym) VALUES (?, ?) ON CONFLICT(week_start) DO UPDATE SET second_gym = excluded.second_gym',
    weekStart(date),
    day,
  );
}

// ---------- Prescripciones ----------

export async function getPrescriptions(
  db: SQLiteDatabase,
  kind: SessionKind,
): Promise<Record<string, Prescription>> {
  const slots = TEMPLATES[kind];
  const rows = await db.getAllAsync<{ slot_key: string; sets: number; reps: number; tempo: number }>(
    `SELECT slot_key, sets, reps, tempo FROM prescription WHERE slot_key IN (${slots.map(() => '?').join(',')})`,
    ...slots.map((s) => s.key),
  );
  const byKey = new Map(rows.map((r) => [r.slot_key, r]));
  const out: Record<string, Prescription> = {};
  for (const s of slots) {
    const r = byKey.get(s.key);
    out[s.key] = r ? { sets: r.sets, reps: r.reps, tempo: r.tempo as Tempo } : initialPrescription(s);
  }
  return out;
}

// ---------- Registros ----------

export async function getLogsBetween(db: SQLiteDatabase, from: ISODate, to: ISODate) {
  return db.getAllAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps FROM session_log WHERE date BETWEEN ? AND ? ORDER BY date',
    from,
    to,
  );
}

export async function getRecentLogs(db: SQLiteDatabase, limit = 20) {
  return db.getAllAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps FROM session_log ORDER BY date DESC, id DESC LIMIT ?',
    limit,
  );
}

export async function getSessionLog(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  return db.getFirstAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps FROM session_log WHERE date = ? AND kind = ?',
    date,
    kind,
  );
}

/** Valores registrados por ejercicio de una sesión ya guardada. */
export async function getSessionSets(db: SQLiteDatabase, sessionId: number): Promise<Record<string, number[]>> {
  const rows = await db.getAllAsync<{ slot_key: string; set_index: number; value: number }>(
    'SELECT slot_key, set_index, value FROM set_log WHERE session_id = ? ORDER BY slot_key, set_index',
    sessionId,
  );
  const out: Record<string, number[]> = {};
  for (const r of rows) (out[r.slot_key] ??= []).push(r.value);
  return out;
}

export async function markMissed(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  await db.runAsync(
    `INSERT INTO session_log (date, kind, status, created_at) VALUES (?, ?, 'missed', ?)
     ON CONFLICT(date, kind) DO UPDATE SET status = 'missed'`,
    date,
    kind,
    now(),
  );
}

export async function deleteLog(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  await db.runAsync('DELETE FROM session_log WHERE date = ? AND kind = ?', date, kind);
}

export interface SlotResult {
  slotKey: string;
  exerciseId: string;
  values: number[];
}

export interface SlotChange {
  slotKey: string;
  exerciseId: string;
  change: ChangeKind;
  next: Prescription;
}

/**
 * Guarda una sesión de casa y aplica la progresión de cada ejercicio.
 * Si ya existía un registro ese día, se reemplaza (sin volver a progresar dos veces el mismo día).
 */
export async function saveHomeSession(
  db: SQLiteDatabase,
  date: ISODate,
  kind: SessionKind,
  feeling: Feeling,
  results: SlotResult[],
): Promise<SlotChange[]> {
  const prescriptions = await getPrescriptions(db, kind);
  const slots = new Map(TEMPLATES[kind].map((s) => [s.key, s]));
  const changes: SlotChange[] = [];

  await db.withExclusiveTransactionAsync(async (tx) => {
    const existing = await tx.getFirstAsync<{ id: number; status: string }>(
      'SELECT id, status FROM session_log WHERE date = ? AND kind = ?',
      date,
      kind,
    );
    const alreadyDone = existing?.status === 'done';
    if (existing) await tx.runAsync('DELETE FROM session_log WHERE id = ?', existing.id);

    const { lastInsertRowId: sessionId } = await tx.runAsync(
      `INSERT INTO session_log (date, kind, status, feeling, created_at) VALUES (?, ?, 'done', ?, ?)`,
      date,
      kind,
      feeling,
      now(),
    );

    for (const r of results) {
      const target = prescriptions[r.slotKey];
      const slot = slots.get(r.slotKey);
      if (!target || !slot) continue;
      for (let i = 0; i < r.values.length; i++) {
        await tx.runAsync(
          'INSERT INTO set_log (session_id, slot_key, exercise_id, set_index, target, value, tempo) VALUES (?, ?, ?, ?, ?, ?, ?)',
          sessionId,
          r.slotKey,
          r.exerciseId,
          i,
          target.reps,
          r.values[i],
          target.tempo,
        );
      }
      if (alreadyDone) continue;
      const result = progress(target, slot, { completed: isCompleted(target, r.values), feeling });
      changes.push({ slotKey: r.slotKey, exerciseId: r.exerciseId, ...result });
      if (result.change !== 'none' && result.change !== 'variante') {
        await tx.runAsync(
          `INSERT INTO prescription (slot_key, sets, reps, tempo, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slot_key) DO UPDATE SET sets = excluded.sets, reps = excluded.reps, tempo = excluded.tempo, updated_at = excluded.updated_at`,
          r.slotKey,
          result.next.sets,
          result.next.reps,
          result.next.tempo,
          now(),
        );
      }
    }
  });

  return changes;
}

export async function saveGymSession(
  db: SQLiteDatabase,
  date: ISODate,
  feeling: Feeling,
  bench: { weight: number; reps: number } | null,
) {
  await db.runAsync(
    `INSERT INTO session_log (date, kind, status, feeling, bench_weight, bench_reps, created_at)
     VALUES (?, 'gym', 'done', ?, ?, ?, ?)
     ON CONFLICT(date, kind) DO UPDATE SET status = 'done', feeling = excluded.feeling,
       bench_weight = excluded.bench_weight, bench_reps = excluded.bench_reps`,
    date,
    feeling,
    bench?.weight ?? null,
    bench?.reps ?? null,
    now(),
  );
}

// ---------- Objetivos ----------

export async function getLastBench(db: SQLiteDatabase) {
  return db.getFirstAsync<{ date: ISODate; bench_weight: number; bench_reps: number }>(
    'SELECT date, bench_weight, bench_reps FROM session_log WHERE bench_weight IS NOT NULL ORDER BY date DESC LIMIT 1',
  );
}

export async function getBestBench1RM(db: SQLiteDatabase): Promise<number | null> {
  const rows = await db.getAllAsync<{ bench_weight: number; bench_reps: number }>(
    'SELECT bench_weight, bench_reps FROM session_log WHERE bench_weight IS NOT NULL',
  );
  if (rows.length === 0) return null;
  return Math.max(...rows.map((r) => estimate1RM(r.bench_weight, r.bench_reps)));
}

export async function addTest(db: SQLiteDatabase, date: ISODate, test: 'dominadas' | 'flexiones', value: number) {
  await db.runAsync('INSERT INTO test_log (date, test, value) VALUES (?, ?, ?)', date, test, value);
}

export async function getBestTests(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ test: 'dominadas' | 'flexiones'; best: number; last_date: ISODate }>(
    'SELECT test, MAX(value) AS best, MAX(date) AS last_date FROM test_log GROUP BY test',
  );
  return Object.fromEntries(rows.map((r) => [r.test, r])) as Partial<
    Record<'dominadas' | 'flexiones', { best: number; last_date: ISODate }>
  >;
}
