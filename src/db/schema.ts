import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'forja.db';
const LATEST = 5;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= LATEST) return;

  if (version === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS week_config (
        week_start TEXT PRIMARY KEY NOT NULL,
        second_gym TEXT NOT NULL CHECK (second_gym IN ('X','J'))
      );
      CREATE TABLE IF NOT EXISTS prescription (
        slot_key TEXT PRIMARY KEY NOT NULL,
        sets INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        tempo INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('A','B','C','gym')),
        status TEXT NOT NULL CHECK (status IN ('done','missed')),
        feeling TEXT CHECK (feeling IN ('facil','normal','dura')),
        bench_weight REAL,
        bench_reps INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (date, kind)
      );
      CREATE TABLE IF NOT EXISTS set_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES session_log(id) ON DELETE CASCADE,
        slot_key TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        target INTEGER NOT NULL,
        value INTEGER NOT NULL,
        tempo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_set_log_exercise ON set_log (exercise_id);
      CREATE TABLE IF NOT EXISTS test_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        test TEXT NOT NULL CHECK (test IN ('dominadas','flexiones')),
        value INTEGER NOT NULL
      );
    `);
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        height_cm REAL NOT NULL,
        birth_date TEXT NOT NULL,
        sex TEXT NOT NULL CHECK (sex IN ('H','M')),
        activity REAL NOT NULL DEFAULT 1.55
      );
      CREATE TABLE IF NOT EXISTS body_log (
        date TEXT PRIMARY KEY NOT NULL,
        weight REAL NOT NULL,
        waist REAL,
        neck REAL,
        hip REAL,
        arm REAL,
        chest REAL,
        body_fat REAL,
        source TEXT NOT NULL DEFAULT 'manual'
      );
    `);
    version = 2;
  }

  if (version === 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    version = 3;
  }

  if (version === 3) {
    // Cambios puntuales por día. Las semanas que tenían el gimnasio el miércoles se convierten en cambios.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS day_override (
        date TEXT PRIMARY KEY NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('gym','casa','rest'))
      );
      INSERT OR REPLACE INTO day_override (date, role)
        SELECT date(week_start, '+2 days'), 'gym' FROM week_config WHERE second_gym = 'X';
      INSERT OR REPLACE INTO day_override (date, role)
        SELECT date(week_start, '+3 days'), 'casa' FROM week_config WHERE second_gym = 'X';
    `);
    version = 4;
  }

  if (version === 4) {
    // Semana tipo con fecha de inicio: cambiarla no reescribe las semanas pasadas.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS week_template (
        from_date TEXT PRIMARY KEY NOT NULL,
        roles TEXT NOT NULL
      );
    `);
    version = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${LATEST}`);
}
