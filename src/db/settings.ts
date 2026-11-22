import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_REMINDERS, type ReminderSettings } from '@/domain/reminders';

async function get(db: SQLiteDatabase, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

async function set(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function getReminderSettings(db: SQLiteDatabase): Promise<ReminderSettings> {
  const enabled = await get(db, 'reminders_enabled');
  const times = await get(db, 'reminder_times');
  return {
    enabled: enabled == null ? DEFAULT_REMINDERS.enabled : enabled === '1',
    times: times == null ? DEFAULT_REMINDERS.times : times.split(',').filter(Boolean),
  };
}

export async function saveReminderSettings(db: SQLiteDatabase, s: ReminderSettings) {
  await set(db, 'reminders_enabled', s.enabled ? '1' : '0');
  await set(db, 'reminder_times', s.times.join(','));
}

/** Lo que el usuario ha marcado para una semana (por su lunes): 'menos', 'normal' o 'mas'. */
export async function getWeekLoad(db: SQLiteDatabase, monday: string): Promise<'menos' | 'normal' | 'mas'> {
  const v = await get(db, `week_load.${monday}`);
  return v === 'menos' || v === 'mas' ? v : 'normal';
}

export async function saveWeekLoad(db: SQLiteDatabase, monday: string, load: 'menos' | 'normal' | 'mas') {
  await set(db, `week_load.${monday}`, load);
}

/** ¿Está activo el plan de la prueba (avisos de dominadas)? */
export async function getTrialActive(db: SQLiteDatabase): Promise<boolean> {
  return (await get(db, 'trial_active')) === '1';
}

export async function saveTrialActive(db: SQLiteDatabase, active: boolean) {
  await set(db, 'trial_active', active ? '1' : '0');
}

/** Fecha de la marcha de 50 km, si ya se sabe (AAAA-MM-DD). */
export async function getMarchDate(db: SQLiteDatabase): Promise<string | null> {
  const v = await get(db, 'march_date');
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function saveMarchDate(db: SQLiteDatabase, date: string | null) {
  await set(db, 'march_date', date ?? '');
}

/** Fecha de la última copia sacada fuera del móvil (AAAA-MM-DD), o null. */
export async function getLastExport(db: SQLiteDatabase): Promise<string | null> {
  const v = await get(db, 'last_export');
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function saveLastExport(db: SQLiteDatabase, date: string) {
  await set(db, 'last_export', date);
}

/** ¿Hay algo apuntado que se perdería sin copia? */
export async function hasUserData(db: SQLiteDatabase): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM session_log) + (SELECT COUNT(*) FROM body_log) + (SELECT COUNT(*) FROM trial_log) + (SELECT COUNT(*) FROM test_log) AS n',
  );
  return (r?.n ?? 0) > 0;
}

/** Fecha y hora (ISO) de la última copia en Drive guardada o restaurada desde este móvil. */
export const getDriveLastBackup = (db: SQLiteDatabase) => get(db, 'drive_last_backup');

export const setDriveLastBackup = (db: SQLiteDatabase, iso: string) => set(db, 'drive_last_backup', iso);
