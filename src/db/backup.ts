import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Copia de seguridad en JSON de todos los datos (menos las fotos, que son archivos del móvil).
 * Sirve para cambiar de teléfono o para pasar de Expo Go a la app instalada.
 */

/** Orden de restauración: `session_log` antes que `set_log`, que la referencia. */
const TABLES = [
  'settings',
  'profile',
  'week_template',
  'day_override',
  'trip',
  'prescription',
  'slot_stage',
  'session_log',
  'set_log',
  'effort_log',
  'test_log',
  'body_log',
  'walk_log',
  'stretch_log',
  'flex_session',
  'flex_test',
  'coach_block',
  'trial_log',
  'hang_log',
  'workout',
] as const;

type Row = Record<string, string | number | null>;

export interface Backup {
  app: 'forja';
  /** Versión del esquema de la base de datos que generó la copia. */
  schema: number;
  exportedAt: string;
  tables: Record<string, Row[]>;
}

async function schemaVersion(db: SQLiteDatabase): Promise<number> {
  const r = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return r?.user_version ?? 0;
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables: Record<string, Row[]> = {};
  // Una base antigua puede no tener aún todas las tablas: las que falten van vacías.
  const existing = new Set((await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name));
  for (const t of TABLES) tables[t] = existing.has(t) ? (await db.getAllAsync<Row>(`SELECT * FROM ${t}`)).map((r) => ({ ...r })) : [];
  return { app: 'forja', schema: await schemaVersion(db), exportedAt: new Date().toISOString(), tables };
}

/** Comprueba que el texto es una copia válida de esta app y la devuelve. */
export function parseBackup(json: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'forja' || typeof b.schema !== 'number' || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('El archivo no es una copia de seguridad de esta app.');
  }
  return b as Backup;
}

export function backupSummary(b: Backup): { sessions: number; measurements: number; date: string } {
  return {
    sessions: (b.tables.session_log ?? []).length,
    measurements: (b.tables.body_log ?? []).length,
    date: b.exportedAt.slice(0, 10),
  };
}

/**
 * Sustituye TODOS los datos por los de la copia. Si algo falla, no cambia nada.
 * Admite copias de versiones anteriores de la app; rechaza las de versiones más nuevas.
 */
export async function importBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  const current = await schemaVersion(db);
  if (backup.schema > current) {
    throw new Error('La copia es de una versión más nueva de la app. Actualiza la app antes de restaurarla.');
  }
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const t of [...TABLES].reverse()) await tx.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const info = await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
      const known = new Set(info.map((c) => c.name));
      for (const row of backup.tables[t] ?? []) {
        // Solo columnas que existen hoy: una copia antigua puede traer menos, nunca nombres arbitrarios.
        const cols = Object.keys(row).filter((c) => known.has(c));
        if (cols.length === 0) continue;
        await tx.runAsync(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          ...cols.map((c) => row[c]),
        );
      }
    }
  });
}
