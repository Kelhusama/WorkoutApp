import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup } from '@/db/backup';
import { getDriveFingerprint, getDriveLastBackup, saveLastExport, setDriveFingerprint, setDriveLastBackup } from '@/db/settings';
import { today } from '@/domain/dates';
import { currentAccount, googleTokens } from './auth';
import type { FetchLike } from './drive';
import { backupToDrive, decideSync, driveBackupDate, fingerprint, loadDriveBackup, localHasData } from './driveBackup';
import { needsSignIn } from './errors';

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
      // La huella se calcula antes de subir: es la de lo que realmente va en la copia.
      const print = fingerprint(await exportBackup(db));
      const savedAt = await backupToDrive(db, driveFetch, googleTokens);
      await setDriveLastBackup(db, savedAt);
      await setDriveFingerprint(db, print);
      // Una copia en Drive cuenta como copia fuera del móvil: deja de avisar en Hoy.
      await saveLastExport(db, today());
      listeners.forEach((l) => l(savedAt));
      setStatus({ state: 'guardado', at: savedAt });
      return savedAt;
    } finally {
      running = null;
    }
  })();
  return running;
}

export type SyncState =
  /** No hay sesión de Google (o no está disponible en este dispositivo). */
  | 'sin_sesion'
  /** Lo del móvil y lo de Drive coinciden. */
  | 'guardado'
  /** Hay cambios en el móvil que aún no se han podido subir (sin conexión, normalmente). */
  | 'pendiente'
  /** En Drive hay una copia que no es de este dispositivo: decide el usuario en Perfil. */
  | 'conflicto'
  /** La sesión de Google ha caducado. */
  | 'caducada';

export interface SyncStatus {
  state: SyncState;
  /** Cuándo se guardó por última vez en Drive (ISO), si se sabe. */
  at?: string | null;
}

let status: SyncStatus = { state: 'sin_sesion' };
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(next: SyncStatus) {
  status = next;
  statusListeners.forEach((l) => l(next));
}

export const syncStatus = () => status;

export function onSyncStatus(listener: (s: SyncStatus) => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

let syncing: Promise<void> | null = null;

/**
 * Sincroniza si hace falta. Es seguro llamarla a menudo: solo usa la red cuando hay cambios
 * (o cuando `checkRemote` pide comprobar si otro dispositivo ha escrito en Drive).
 * Sin conexión no falla: deja el estado en «pendiente» y lo reintenta la próxima vez.
 */
export function syncIfNeeded(db: SQLiteDatabase, opts: { checkRemote?: boolean } = {}): Promise<void> {
  syncing ??= (async () => {
    try {
      if (currentAccount() == null) return setStatus({ state: 'sin_sesion' });
      const lastSyncAt = await getDriveLastBackup(db);
      const uploaded = await getDriveFingerprint(db);
      const hasData = await localHasData(db);
      const local = fingerprint(await exportBackup(db));
      const changed = hasData && local !== uploaded;
      if (!changed && !opts.checkRemote) return setStatus({ state: lastSyncAt ? 'guardado' : 'sin_sesion', at: lastSyncAt });

      let remoteAt: string | null;
      try {
        remoteAt = await driveBackupDate(driveFetch, googleTokens);
      } catch (e) {
        if (needsSignIn(e)) return setStatus({ state: 'caducada', at: lastSyncAt });
        // Sin conexión: lo que haya cambiado se queda pendiente.
        return setStatus({ state: changed ? 'pendiente' : 'guardado', at: lastSyncAt });
      }
      const action = decideSync({ signedIn: true, hasData, local, uploaded, lastSyncAt, remoteAt });
      if (action === 'conflicto') return setStatus({ state: 'conflicto', at: lastSyncAt });
      if (action === 'nada') return setStatus({ state: 'guardado', at: lastSyncAt });
      try {
        await backupNow(db);
      } catch (e) {
        setStatus({ state: needsSignIn(e) ? 'caducada' : 'pendiente', at: lastSyncAt });
      }
    } catch {
      // Cualquier otro fallo no debe molestar al usuario: se reintenta en la siguiente ocasión.
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export const remoteBackupDate = () => driveBackupDate(driveFetch, googleTokens);

export const loadRemoteBackup = () => loadDriveBackup(driveFetch, googleTokens);
