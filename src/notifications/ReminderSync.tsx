import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncReminders } from './reminders';

/** Reprograma los avisos al abrir la app y cada vez que vuelve a primer plano. */
export function ReminderSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    syncReminders(db);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncReminders(db);
    });
    return () => sub.remove();
  }, [db]);
  return null;
}
