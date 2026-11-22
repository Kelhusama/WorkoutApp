import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { today } from '@/domain/dates';
import { exportBackup, parseBackup, type Backup } from './backup';

/**
 * Copias automáticas dentro del móvil.
 *
 * Protegen de un error de la app o de una actualización que salga mal: se puede volver a la copia
 * del día anterior. NO protegen de perder o cambiar de móvil ni de desinstalar la app, porque viven
 * en la carpeta de la propia app. Para eso está «Exportar copia» (y, más adelante, Google Drive).
 */

/** Copias diarias que se conservan. */
const KEEP = 7;
const PREFIX = 'forja-auto-';

const folder = () => {
  const dir = new Directory(Paths.document, 'copias');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
};

export interface Snapshot {
  name: string;
  uri: string;
  /** Fecha de la copia (AAAA-MM-DD). */
  date: string;
}

/** Copias automáticas guardadas, de la más reciente a la más antigua. */
export function listSnapshots(): Snapshot[] {
  if (Platform.OS === 'web') return [];
  return folder()
    .list()
    .filter((f): f is File => f instanceof File && f.name.startsWith(PREFIX) && f.name.endsWith('.json'))
    .map((f) => ({ name: f.name, uri: f.uri, date: f.name.slice(PREFIX.length, PREFIX.length + 10) }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Guarda una copia ahora. `tag` distingue las que se hacen justo antes de actualizar la base de datos. */
export async function writeSnapshot(db: SQLiteDatabase, tag = ''): Promise<void> {
  if (Platform.OS === 'web') return;
  const file = new File(folder(), `${PREFIX}${today()}${tag ? `-${tag}` : ''}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(await exportBackup(db)));
  // Se conservan las últimas; las previas a una actualización cuentan igual que las diarias.
  for (const old of listSnapshots().slice(KEEP)) {
    try {
      new File(old.uri).delete();
    } catch {
      // Si no se puede borrar una copia vieja, no pasa nada: se intentará la próxima vez.
    }
  }
}

/** Una copia al día, la primera vez que se abre la app. */
export async function dailySnapshot(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') return;
  if (listSnapshots().some((s) => s.date === today() && !s.name.includes('-antes-'))) return;
  await writeSnapshot(db);
}

export async function readSnapshot(s: Snapshot): Promise<Backup> {
  return parseBackup(await new File(s.uri).text());
}
