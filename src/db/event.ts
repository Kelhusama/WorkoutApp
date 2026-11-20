import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate } from '@/domain/dates';
import { setEventConfig, type TrialLog } from '@/domain/event';

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

/** Lee la fecha y los objetivos guardados y los deja vigentes. Se llama al abrir la app. */
export async function loadEventConfig(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key LIKE 'event_%'");
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const num = (s: string | undefined) => (s && Number.isFinite(Number(s)) && Number(s) > 0 ? Number(s) : undefined);
  const targets: Partial<Record<'dominada' | 'peso_muerto', number>> = {};
  const pull = num(v.event_target_dominada);
  const dead = num(v.event_target_peso_muerto);
  if (pull !== undefined) targets.dominada = pull;
  if (dead !== undefined) targets.peso_muerto = dead;
  setEventConfig({ date: /^\d{4}-\d{2}-\d{2}$/.test(v.event_date ?? '') ? v.event_date : undefined, targets });
}

export async function saveEventConfig(db: SQLiteDatabase, c: { date: ISODate; dominada: number; peso_muerto: number }): Promise<void> {
  const put = (key: string, value: string) =>
    db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  await put('event_date', c.date);
  await put('event_target_dominada', String(c.dominada));
  await put('event_target_peso_muerto', String(c.peso_muerto));
  setEventConfig({ date: c.date, targets: { dominada: c.dominada, peso_muerto: c.peso_muerto } });
}
