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
