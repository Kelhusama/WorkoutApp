import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncIfNeeded } from './sync';

/** Cada cuánto se mira, con la app abierta, si hay cambios sin subir. No usa la red si no los hay. */
const EVERY_MS = 2 * 60 * 1000;

/**
 * Mantiene Drive al día con el móvil, sin que el usuario haga nada:
 * - al abrir la app y al volver a ella, comprobando además si otro dispositivo ha escrito;
 * - al mandarla a segundo plano, que es cuando se acaba de apuntar algo;
 * - y cada dos minutos mientras está abierta.
 */
export function DriveAutoBackup() {
  const db = useSQLiteContext();
  useEffect(() => {
    syncIfNeeded(db, { checkRemote: true });
    const sub = AppState.addEventListener('change', (s) => {
      syncIfNeeded(db, { checkRemote: s === 'active' });
    });
    const timer = setInterval(() => syncIfNeeded(db), EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [db]);
  return null;
}
