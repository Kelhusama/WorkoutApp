import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup, parseBackup, type Backup } from '../db/backup';
import { downloadBackupFile, findBackupFile, uploadBackupFile, type FetchLike } from './drive';
import { needsSignIn } from './errors';

/** Lógica de la copia en Drive, independiente del móvil (se prueba con un `fetch` falso). */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** ¿Toca copia semanal? Sí si nunca se hizo o la última tiene 7 días o más. */
export function isWeeklyBackupDue(lastBackupAt: string | null, now: Date): boolean {
  if (!lastBackupAt) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last >= WEEK_MS;
}

/**
 * Decide la copia automática al abrir la app. Dos protecciones para no pisar una copia buena:
 * - nunca con la app vacía;
 * - solo si esta instalación ya guardó o restauró una copia (`lastBackupAt` conocido). En un
 *   móvil nuevo la primera copia es manual, después de decidir si se restaura la de Drive.
 */
export function shouldAutoBackup(s: { signedIn: boolean; hasData: boolean; lastBackupAt: string | null; now: Date }): boolean {
  return s.signedIn && s.hasData && s.lastBackupAt != null && isWeeklyBackupDue(s.lastBackupAt, s.now);
}

/** Hay algo que merezca copiarse: alguna sesión o alguna medición. */
export async function localHasData(db: SQLiteDatabase): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM session_log) + (SELECT COUNT(*) FROM body_log) AS n',
  );
  return (r?.n ?? 0) > 0;
}

/** De dónde sale el token de acceso; `refresh` descarta el que Drive ha rechazado y pide otro. */
export interface TokenSource {
  get(): Promise<string>;
  refresh(rejected: string): Promise<string>;
}

/** Ejecuta una operación de Drive; si el token está caducado (401), lo renueva y reintenta una vez. */
export async function withToken<T>(tokens: TokenSource, run: (token: string) => Promise<T>): Promise<T> {
  const token = await tokens.get();
  try {
    return await run(token);
  } catch (e) {
    if (!needsSignIn(e)) throw e;
    return run(await tokens.refresh(token));
  }
}

/** Sube todos los datos a Drive. Devuelve la fecha y hora (ISO) de la copia según Drive. */
export async function backupToDrive(db: SQLiteDatabase, fetchFn: FetchLike, tokens: TokenSource): Promise<string> {
  const content = JSON.stringify(await exportBackup(db));
  const file = await withToken(tokens, (t) => uploadBackupFile(fetchFn, t, content));
  return file.modifiedTime;
}

/** Fecha y hora (ISO) de la copia que hay en Drive, o null si no hay. */
export async function driveBackupDate(fetchFn: FetchLike, tokens: TokenSource): Promise<string | null> {
  return (await withToken(tokens, (t) => findBackupFile(fetchFn, t)))?.modifiedTime ?? null;
}

/** Descarga y valida la copia de Drive (sin tocar los datos), o null si no hay. */
export async function loadDriveBackup(
  fetchFn: FetchLike,
  tokens: TokenSource,
): Promise<{ backup: Backup; modifiedTime: string } | null> {
  const found = await withToken(tokens, (t) => downloadBackupFile(fetchFn, t));
  if (!found) return null;
  return { backup: parseBackup(found.content), modifiedTime: found.file.modifiedTime };
}

// ---------- Sincronización: el móvil manda y la nube es su copia ----------

/** Ajustes que cambian solos al sincronizar: no cuentan como «cambios del usuario». */
const VOLATILE_SETTINGS = /^(drive_|last_export$)/;

/**
 * Huella del contenido de una copia: cambia si y solo si cambia algún dato del usuario.
 * No depende de la hora de la copia ni de los ajustes internos de la propia sincronización.
 */
export function fingerprint(backup: Backup): string {
  const tables: Record<string, unknown> = {};
  for (const name of Object.keys(backup.tables).sort()) {
    const rows = backup.tables[name];
    tables[name] = name === 'settings' ? rows.filter((r) => !VOLATILE_SETTINGS.test(String(r.key))) : rows;
  }
  const text = JSON.stringify(tables);
  // FNV-1a de 32 bits: de sobra para detectar cambios, sin dependencias.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${text.length.toString(36)}-${h.toString(36)}`;
}

export type SyncAction =
  /** No hay nada que hacer. */
  | 'nada'
  /** Hay cambios locales sin subir. */
  | 'subir'
  /** En Drive hay una copia que este dispositivo no ha subido: hay que preguntar antes de pisarla. */
  | 'conflicto';

/**
 * Decide qué hacer. Reglas, en orden:
 * 1. Sin sesión o con la app vacía, nada: una app vacía nunca pisa una copia.
 * 2. Si en Drive hay una copia que no viene de este dispositivo (nunca hemos subido, o es
 *    posterior a nuestra última subida), conflicto: decide el usuario.
 * 3. Si lo local es igual que lo último que subimos, nada.
 * 4. Si no, subir.
 * `remoteAt` es undefined cuando no se ha podido consultar Drive (sin conexión).
 */
export function decideSync(s: {
  signedIn: boolean;
  hasData: boolean;
  /** Huella de lo que hay ahora en el móvil. */
  local: string;
  /** Huella de lo último que este dispositivo subió o restauró, o null. */
  uploaded: string | null;
  /** Cuándo subió o restauró este dispositivo por última vez (ISO de Drive), o null. */
  lastSyncAt: string | null;
  /** Fecha de la copia que hay en Drive (ISO), null si no hay ninguna. */
  remoteAt: string | null;
}): SyncAction {
  if (!s.signedIn || !s.hasData) return 'nada';
  if (s.remoteAt !== null) {
    if (s.lastSyncAt === null) return 'conflicto';
    // Un segundo de margen: Drive redondea las horas.
    if (Date.parse(s.remoteAt) - Date.parse(s.lastSyncAt) > 1000) return 'conflicto';
  }
  return s.local === s.uploaded ? 'nada' : 'subir';
}
