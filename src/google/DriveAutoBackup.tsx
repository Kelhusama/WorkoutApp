import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { autoBackupIfDue } from './sync';

/** Copia semanal en Drive: se comprueba al abrir la app y cada vez que vuelve a primer plano. */
export function DriveAutoBackup() {
  const db = useSQLiteContext();
  useEffect(() => {
    autoBackupIfDue(db);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') autoBackupIfDue(db);
    });
    return () => sub.remove();
  }, [db]);
  return null;
}
