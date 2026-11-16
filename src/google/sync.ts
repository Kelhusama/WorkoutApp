import type { SQLiteDatabase } from 'expo-sqlite';

import { getDriveLastBackup, setDriveLastBackup } from '@/db/settings';
import { currentAccount, googleTokens } from './auth';
import type { FetchLike } from './drive';
import { backupToDrive, driveBackupDate, loadDriveBackup, localHasData, shouldAutoBackup } from './driveBackup';

/** Une la lógica de Drive con el `fetch` del móvil, los tokens de Google y la base de datos. */

const driveFetch: FetchLike = (url, init) => fetch(url, init);

type Listener = (savedAt: string) => void;
const listeners = new Set<Listener>();

/** Avisa cada vez que se guarda una copia en Drive (manual o automática). */
export function onDriveBackup(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let running: Promise<string> | null = null;

/** Guarda la copia en Drive. Si ya hay una subida en marcha, espera a esa en vez de lanzar otra. */
export function backupNow(db: SQLiteDatabase): Promise<string> {
  running ??= (async () => {
    try {
      const savedAt = await backupToDrive(db, driveFetch, googleTokens);
      await setDriveLastBackup(db, savedAt);
      listeners.forEach((l) => l(savedAt));
      return savedAt;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Copia semanal al abrir la app: en silencio, y sin molestar si falla (se reintenta la próxima vez). */
export async function autoBackupIfDue(db: SQLiteDatabase, now = new Date()): Promise<void> {
  try {
    const signedIn = currentAccount() != null;
    if (!signedIn) return;
    const due = shouldAutoBackup({
      signedIn,
      hasData: await localHasData(db),
      lastBackupAt: await getDriveLastBackup(db),
      now,
    });
    if (due) await backupNow(db);
  } catch {
    // sin conexión, sesión caducada…: la tarjeta de Perfil muestra el error cuando el usuario lo intente a mano
  }
}

export const remoteBackupDate = () => driveBackupDate(driveFetch, googleTokens);

export const loadRemoteBackup = () => loadDriveBackup(driveFetch, googleTokens);
