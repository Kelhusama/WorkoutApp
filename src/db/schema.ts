import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'forja.db';
const LATEST = 18;

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

  if (version === 5) {
    // Valores que da la báscula Huawei Scale 3, copiados a mano desde Huawei Salud.
    await db.execAsync(`
      ALTER TABLE body_log ADD COLUMN fat_free_mass REAL;
      ALTER TABLE body_log ADD COLUMN skeletal_muscle REAL;
      ALTER TABLE body_log ADD COLUMN water REAL;
      ALTER TABLE body_log ADD COLUMN protein REAL;
      ALTER TABLE body_log ADD COLUMN bone_mass REAL;
      ALTER TABLE body_log ADD COLUMN visceral_fat REAL;
      ALTER TABLE body_log ADD COLUMN scale_bmr REAL;
      ALTER TABLE body_log ADD COLUMN body_age REAL;
      ALTER TABLE body_log ADD COLUMN body_score REAL;
    `);
    version = 6;
  }

  if (version === 6) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trip (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_date TEXT NOT NULL,
        to_date TEXT NOT NULL,
        mochila INTEGER NOT NULL DEFAULT 0,
        mesa INTEGER NOT NULL DEFAULT 0,
        gimnasio INTEGER NOT NULL DEFAULT 0
      );
    `);
    version = 7;
  }

  if (version === 7) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS progress_photo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        pose TEXT NOT NULL CHECK (pose IN ('frente','lado','espalda')),
        uri TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    version = 8;
  }

  if (version === 8) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS walk_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('suave','cuestas','larga','extra','libre')),
        km REAL NOT NULL CHECK (km > 0),
        minutes REAL NOT NULL DEFAULT 0,
        elevation REAL,
        pack_kg REAL,
        effort INTEGER,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_walk_log_date ON walk_log (date);
    `);
    version = 9;
  }

  if (version === 9) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS stretch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        routine TEXT NOT NULL,
        stretch_id TEXT NOT NULL,
        seconds INTEGER NOT NULL CHECK (seconds > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_stretch_log_date ON stretch_log (date);
    `);
    version = 10;
  }

  if (version === 10) {
    // Flexibilidad: sesiones del programa por niveles y resultados de los tests mensuales.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS flex_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        level INTEGER NOT NULL CHECK (level IN (1,2,3)),
        seconds INTEGER NOT NULL CHECK (seconds > 0),
        exercises TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_flex_session_date ON flex_session (date);
      CREATE TABLE IF NOT EXISTS flex_test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        test_id TEXT NOT NULL,
        value REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_flex_test_date ON flex_test (date);
    `);
    version = 11;
  }

  if (version === 11) {
    // Entrenador adaptativo: repeticiones que quedaban en la última serie de cada ejercicio.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS effort_log (
        session_id INTEGER NOT NULL REFERENCES session_log(id) ON DELETE CASCADE,
        slot_key TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        reserve INTEGER NOT NULL CHECK (reserve IN (0,1,2)),
        PRIMARY KEY (session_id, slot_key)
      );
      CREATE INDEX IF NOT EXISTS idx_effort_log_exercise ON effort_log (exercise_id);
    `);
    version = 12;
  }

  if (version === 12) {
    // Sesión ligera: se apunta, pero el entrenador no mueve el plan con ella.
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(session_log)');
    if (!cols.some((c) => c.name === 'light')) {
      await db.execAsync('ALTER TABLE session_log ADD COLUMN light INTEGER NOT NULL DEFAULT 0');
    }
    version = 13;
  }

  if (version === 13) {
    // Banca: lo que quedaba en la mejor serie, para proponer la carga del próximo día.
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(session_log)');
    if (!cols.some((c) => c.name === 'bench_reserve')) {
      await db.execAsync('ALTER TABLE session_log ADD COLUMN bench_reserve INTEGER');
    }
    version = 14;
  }

  if (version === 14) {
    // Entrenador, capa 4: bloques de prueba entre un test y el siguiente, cada uno con su variante.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS coach_block (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal TEXT NOT NULL CHECK (goal IN ('dominadas','flexiones')),
        variant TEXT NOT NULL CHECK (variant IN ('base','cortas','largas')),
        start_date TEXT NOT NULL,
        start_value REAL NOT NULL,
        end_date TEXT,
        end_value REAL
      );
    `);
    version = 15;
  }

  if (version === 15) {
    // Versiones más duras de un ejercicio: en qué etapa va cada hueco y con cuál se hizo cada serie.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS slot_stage (
        slot_key TEXT PRIMARY KEY NOT NULL,
        stage INTEGER NOT NULL DEFAULT 0
      );
    `);
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(set_log)');
    if (!cols.some((c) => c.name === 'stage')) {
      await db.execAsync('ALTER TABLE set_log ADD COLUMN stage INTEGER NOT NULL DEFAULT 0');
    }
    version = 16;
  }

  if (version === 16) {
    // Día de movilidad en la semana y sesión de casa enfocada.
    // La tabla de cambios por día solo admitía tres papeles: se rehace para admitir «movilidad».
    await db.execAsync(`
      DROP TABLE IF EXISTS day_override_new;
      CREATE TABLE day_override_new (
        date TEXT PRIMARY KEY NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('gym','casa','movilidad','rest'))
      );
      INSERT INTO day_override_new (date, role) SELECT date, role FROM day_override;
      DROP TABLE day_override;
      ALTER TABLE day_override_new RENAME TO day_override;
    `);
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(session_log)');
    if (!cols.some((c) => c.name === 'focus')) {
      await db.execAsync('ALTER TABLE session_log ADD COLUMN focus INTEGER NOT NULL DEFAULT 0');
    }
    version = 17;
  }

  if (version === 17) {
    // Prueba del 16 de enero: sesiones de dominadas con lastre y de peso muerto.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trial_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        lift TEXT NOT NULL CHECK (lift IN ('dominada','peso_muerto')),
        weight REAL NOT NULL CHECK (weight >= 0),
        reps INTEGER NOT NULL CHECK (reps > 0),
        sets INTEGER NOT NULL CHECK (sets > 0),
        reserve INTEGER CHECK (reserve IN (0,1,2))
      );
      CREATE INDEX IF NOT EXISTS idx_trial_log_date ON trial_log (date);
    `);
    version = 18;
  }

  await db.execAsync(`PRAGMA user_version = ${LATEST}`);
}
