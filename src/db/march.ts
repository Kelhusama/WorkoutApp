import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate } from '@/domain/dates';
import { evolve, type MarchEvent, type MarchState, type Walk } from '@/domain/march';
import { LAST_STEP } from '@/domain/marchPlan';

// ---------- Caminatas ----------

const WALK_COLUMNS = 'id, date, kind, km, minutes, elevation, pack_kg AS packKg, effort, notes';

/** Todas las caminatas, por orden de fecha. */
export async function getWalks(db: SQLiteDatabase): Promise<Walk[]> {
  const rows = await db.getAllAsync<Walk>(`SELECT ${WALK_COLUMNS} FROM walk_log ORDER BY date, id`);
  return rows.map((r) => ({ ...r }));
}

export async function getWalk(db: SQLiteDatabase, id: number): Promise<Walk | null> {
  const r = await db.getFirstAsync<Walk>(`SELECT ${WALK_COLUMNS} FROM walk_log WHERE id = ?`, id);
  return r ? { ...r } : null;
}

/** Guarda una caminata nueva o, si lleva `id`, la actualiza. Devuelve su id. */
export async function saveWalk(db: SQLiteDatabase, w: Omit<Walk, 'id'> & { id?: number }): Promise<number> {
  const values = [w.date, w.kind, w.km, w.minutes, w.elevation ?? null, w.packKg ?? null, w.effort ?? null, w.notes?.trim() || null];
  if (w.id !== undefined) {
    await db.runAsync(
      'UPDATE walk_log SET date = ?, kind = ?, km = ?, minutes = ?, elevation = ?, pack_kg = ?, effort = ?, notes = ? WHERE id = ?',
      ...values,
      w.id,
    );
    return w.id;
  }
  const r = await db.runAsync(
    'INSERT INTO walk_log (date, kind, km, minutes, elevation, pack_kg, effort, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ...values,
  );
  return r.lastInsertRowId;
}

export async function deleteWalk(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM walk_log WHERE id = ?', id);
}

// ---------- Estado del plan ----------

async function readSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

async function writeState(db: SQLiteDatabase, s: MarchState) {
  for (const [key, value] of [
    ['march_step', String(s.step)],
    ['march_since', s.since],
    ['march_completed', s.completed ? '1' : '0'],
  ] as const) {
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }
}

async function readState(db: SQLiteDatabase): Promise<MarchState | null> {
  const step = Number(await readSetting(db, 'march_step'));
  const since = await readSetting(db, 'march_since');
  if (!since || !Number.isInteger(step) || step < 1 || step > LAST_STEP) return null;
  return { step, since, completed: (await readSetting(db, 'march_completed')) === '1' };
}

/** Empieza (o reinicia) el plan en un escalón, contando desde hoy. */
export async function startMarch(db: SQLiteDatabase, step: number, today: ISODate) {
  await writeState(db, { step: Math.min(LAST_STEP, Math.max(1, Math.round(step))), since: today, completed: false });
}

/** Deja el plan. Las caminatas registradas se conservan. */
export async function stopMarch(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM settings WHERE key IN ('march_step', 'march_since', 'march_completed')");
}

export interface MarchSnapshot {
  /** `null` si no hay plan en marcha. */
  state: MarchState | null;
  /** Lo que ha cambiado al ponerlo al día (avances, retrocesos, reto completado). */
  events: MarchEvent[];
  walks: Walk[];
}

/** Lee el plan, lo pone al día con las caminatas registradas y guarda el resultado. */
export async function loadMarch(db: SQLiteDatabase, today: ISODate): Promise<MarchSnapshot> {
  const walks = await getWalks(db);
  const stored = await readState(db);
  if (!stored) return { state: null, events: [], walks };
  const { state, events } = evolve(stored, walks, today);
  if (events.length > 0) await writeState(db, state);
  return { state, events, walks };
}
