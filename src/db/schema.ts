import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'forja.db';
const LATEST = 22;

export interface MigrateOptions {
  /**
   * Se llama una vez, antes de tocar nada, cuando hay datos y la base está en una versión antigua.
   * Sirve para guardar una copia de seguridad. Si falla, la migración sigue: no debe bloquear la app.
   */
  beforeUpgrade?: (fromVersion: number) => Promise<void>;
}

/** Añade una columna solo si aún no existe: repetir el paso no da error. */
async function addColumn(db: SQLiteDatabase, table: string, column: string, definition: string) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Lleva la base de datos a la última versión, paso a paso.
 *
 * Garantías:
 * - **Cada paso es atómico**: va en su propia transacción junto con su número de versión. Si un paso
 *   falla, se deshace entero y la base queda exactamente como estaba antes de ese paso.
 * - **Se reanuda donde se quedó**: los pasos ya hechos no se repiten, y los que añaden columnas o tablas
 *   comprueban antes si existen, así que repetirlos tampoco rompe nada.
 * - **Nunca se borra un dato para migrar**: los pasos solo añaden tablas y columnas, o copian una tabla a otra.
 * - **Una base más nueva que la app no se toca** (por ejemplo, si se instala una versión antigua).
 */
export async function migrate(db: SQLiteDatabase, options: MigrateOptions = {}) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= LATEST) return;

  if (version > 0 && options.beforeUpgrade) {
    try {
      await options.beforeUpgrade(version);
    } catch (e) {
      console.warn('No se pudo guardar la copia previa a la actualización', e);
    }
  }

  /** Ejecuta el paso que lleva de `from` a `from + 1`, si es el que toca. */
  const step = async (from: number, run: () => Promise<void>) => {
    if (version !== from) return;
    await db.execAsync('BEGIN');
    try {
      await run();
      await db.execAsync(`PRAGMA user_version = ${from + 1}`);
      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw new Error(`No se pudo actualizar la base de datos (paso ${from} → ${from + 1}). Tus datos no han cambiado. ${e instanceof Error ? e.message : String(e)}`);
    }
    version = from + 1;
  };

  await step(0, async () => {
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
  });

  await step(1, async () => {
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
  });

  await step(2, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  });

  await step(3, async () => {
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
  });

  await step(4, async () => {
    // Semana tipo con fecha de inicio: cambiarla no reescribe las semanas pasadas.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS week_template (
        from_date TEXT PRIMARY KEY NOT NULL,
        roles TEXT NOT NULL
      );
    `);
  });

  await step(5, async () => {
    // Valores que da la báscula Huawei Scale 3, copiados a mano desde Huawei Salud.
    for (const c of ['fat_free_mass', 'skeletal_muscle', 'water', 'protein', 'bone_mass', 'visceral_fat', 'scale_bmr', 'body_age', 'body_score']) {
      await addColumn(db, 'body_log', c, 'REAL');
    }
  });

  await step(6, async () => {
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
  });

  await step(7, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS progress_photo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        pose TEXT NOT NULL CHECK (pose IN ('frente','lado','espalda')),
        uri TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  });

  await step(8, async () => {
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
  });

  await step(9, async () => {
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
  });

  await step(10, async () => {
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
  });

  await step(11, async () => {
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
  });

  await step(12, async () => {
    // Sesión ligera: se apunta, pero el entrenador no mueve el plan con ella.
    await addColumn(db, 'session_log', 'light', 'INTEGER NOT NULL DEFAULT 0');
  });

  await step(13, async () => {
    // Banca: lo que quedaba en la mejor serie, para proponer la carga del próximo día.
    await addColumn(db, 'session_log', 'bench_reserve', 'INTEGER');
  });

  await step(14, async () => {
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
  });

  await step(15, async () => {
    // Versiones más duras de un ejercicio: en qué etapa va cada hueco y con cuál se hizo cada serie.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS slot_stage (
        slot_key TEXT PRIMARY KEY NOT NULL,
        stage INTEGER NOT NULL DEFAULT 0
      );
    `);
    await addColumn(db, 'set_log', 'stage', 'INTEGER NOT NULL DEFAULT 0');
  });

  await step(16, async () => {
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
    await addColumn(db, 'session_log', 'focus', 'INTEGER NOT NULL DEFAULT 0');
  });

  await step(17, async () => {
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
  });

  await step(18, async () => {
    // Agarre con el que se hicieron las dominadas del plan.
    await addColumn(db, 'trial_log', 'grip', 'TEXT');
  });

  await step(19, async () => {
    // Colgarse: mejor intento de cada día.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS hang_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        seconds INTEGER NOT NULL CHECK (seconds > 0)
      );
    `);
  });

  await step(20, async () => {
    // Qué se trabajó en el gimnasio (tirón, empuje, pierna), para medir la carga real.
    await addColumn(db, 'session_log', 'gym_work', 'TEXT');
  });

  await step(21, async () => {
    // De viaje ya solo se pregunta si hay una mancuerna. Se guardaba en «mochila»: pasa a su propia columna.
    // Las columnas antiguas (mochila, mesa) se quedan, sin usar: migrar nunca quita nada.
    await addColumn(db, 'trip', 'mancuerna', 'INTEGER NOT NULL DEFAULT 0');
    await db.execAsync('UPDATE trip SET mancuerna = mochila WHERE mancuerna = 0 AND mochila = 1');
  });

}
