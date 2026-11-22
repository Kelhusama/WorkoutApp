import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate } from '@/domain/dates';
import type { Load, State, Workout } from '@/domain/workouts';

interface Row {
  id: number;
  date: ISODate;
  type: string;
  title: string;
  minutes: number | null;
  load: number | null;
  state: string | null;
  notes: string | null;
  source: string | null;
  source_id: number | null;
}

const toWorkout = (r: Row): Workout => ({
  id: r.id,
  date: r.date,
  type: r.type,
  title: r.title,
  minutes: r.minutes,
  load: (r.load as Load | null) ?? null,
  state: (r.state as State | null) ?? null,
  notes: r.notes,
  source: r.source,
  sourceId: r.source_id,
});

const COLUMNS = 'id, date, type, title, minutes, load, state, notes, source, source_id';

/**
 * De dónde sale cada entrenamiento con detalles. Cada origen dice qué filas son entrenamientos y cómo se
 * rellenan los campos comunes. `load` es la carga por defecto, deducida de lo apuntado en el detalle.
 */
const SOURCES: { table: string; from: string; id: string; date: string; type: string; title: string; minutes: string; load: string }[] = [
  {
    table: 'session_log',
    from: "session_log s WHERE s.status = 'done'",
    id: 's.id',
    date: 's.date',
    type: "CASE s.kind WHEN 'gym' THEN 'gimnasio' ELSE 'casa' END",
    title: "CASE s.kind WHEN 'gym' THEN 'Gimnasio' WHEN 'A' THEN 'Tirón' WHEN 'B' THEN 'Empuje' ELSE 'Mixta suave' END",
    minutes: 'NULL',
    // Una sesión corta es suave por definición; si no, lo que se contestó al acabar.
    load: "CASE WHEN s.light = 1 THEN 1 WHEN s.feeling = 'facil' THEN 1 WHEN s.feeling = 'normal' THEN 2 WHEN s.feeling = 'dura' THEN 3 ELSE NULL END",
  },
  {
    table: 'trial_log',
    from: 'trial_log s WHERE 1 = 1',
    id: 's.id',
    date: 's.date',
    type: "CASE s.lift WHEN 'dominada' THEN 'dominadas' ELSE 'peso_muerto' END",
    title: "CASE s.lift WHEN 'dominada' THEN 'Dominadas' ELSE 'Peso muerto' END",
    minutes: 'NULL',
    // Lo que quedaba en la última serie: nada, fuerte; una o dos, media; tres o más, suave.
    load: 'CASE s.reserve WHEN 0 THEN 3 WHEN 1 THEN 2 WHEN 2 THEN 1 ELSE NULL END',
  },
  {
    table: 'flex_session',
    from: 'flex_session s WHERE 1 = 1',
    id: 's.id',
    date: 's.date',
    type: "'movilidad'",
    title: "'Flexibilidad'",
    minutes: 'MAX(1, CAST(ROUND(s.seconds / 60.0) AS INTEGER))',
    load: '1',
  },
  {
    table: 'stretch_log',
    // Una rutina de estiramientos son varias filas: cuenta como un entrenamiento por día y rutina.
    from: '(SELECT MIN(id) AS id, date, SUM(seconds) AS seconds FROM stretch_log GROUP BY date, routine) s WHERE 1 = 1',
    id: 's.id',
    date: 's.date',
    type: "'estiramientos'",
    title: "'Estiramientos'",
    minutes: 'MAX(1, CAST(ROUND(s.seconds / 60.0) AS INTEGER))',
    load: '1',
  },
  {
    table: 'walk_log',
    from: 'walk_log s WHERE 1 = 1',
    id: 's.id',
    date: 's.date',
    type: "'caminata'",
    title: "'Caminata ' || REPLACE(CAST(ROUND(s.km, 1) AS TEXT), '.', ',') || ' km'",
    minutes: 'CASE WHEN s.minutes > 0 THEN CAST(ROUND(s.minutes) AS INTEGER) ELSE NULL END',
    // El esfuerzo de la caminata va de 1 a 10.
    load: 'CASE WHEN s.effort IS NULL THEN NULL WHEN s.effort <= 3 THEN 1 WHEN s.effort <= 6 THEN 2 ELSE 3 END',
  },
];

let syncing: Promise<void> = Promise.resolve();

async function doSync(db: SQLiteDatabase) {
  const stamp = new Date().toISOString();
  // Todo o nada: si algo falla a mitad, la tabla se queda como estaba. Aquí nunca se toca el detalle, solo la tabla general.
  await db.execAsync('SAVEPOINT sync_workouts');
  try {
    await syncSources(db, stamp);
    await db.execAsync('RELEASE sync_workouts');
  } catch (e) {
    await db.execAsync('ROLLBACK TO sync_workouts; RELEASE sync_workouts');
    throw e;
  }
}

async function syncSources(db: SQLiteDatabase, stamp: string) {
  for (const s of SOURCES) {
    // Lo que se ha borrado en el detalle deja de ser un entrenamiento.
    await db.runAsync(`DELETE FROM workout WHERE source = ? AND source_id NOT IN (SELECT ${s.id} FROM ${s.from})`, s.table);
    // Lo nuevo entra con sus campos comunes.
    await db.runAsync(
      `INSERT INTO workout (date, type, title, minutes, load, source, source_id, created_at)
       SELECT ${s.date}, ${s.type}, ${s.title}, ${s.minutes}, ${s.load}, ?, ${s.id}, ?
         FROM ${s.from} AND NOT EXISTS (SELECT 1 FROM workout w WHERE w.source = ? AND w.source_id = ${s.id})`,
      s.table,
      stamp,
      s.table,
    );
    // Lo que ya estaba se pone al día si el detalle cambió. La carga y la duración que el usuario
    // haya corregido a mano (edited = 1) no se tocan; la duración medida tampoco se pisa con un vacío.
    await db.runAsync(
      `UPDATE workout SET
         date = (SELECT ${s.date} FROM ${s.from} AND ${s.id} = workout.source_id),
         type = (SELECT ${s.type} FROM ${s.from} AND ${s.id} = workout.source_id),
         title = (SELECT ${s.title} FROM ${s.from} AND ${s.id} = workout.source_id),
         load = CASE WHEN edited = 1 THEN load ELSE (SELECT ${s.load} FROM ${s.from} AND ${s.id} = workout.source_id) END,
         minutes = CASE WHEN edited = 1 THEN minutes ELSE COALESCE((SELECT ${s.minutes} FROM ${s.from} AND ${s.id} = workout.source_id), minutes) END
       WHERE source = ?`,
      s.table,
    );
  }
}

/**
 * Pone la tabla general de entrenamientos al día con lo que hay apuntado en cada pantalla.
 * Se puede llamar las veces que haga falta: no duplica nada. Las llamadas se encadenan para que no se pisen.
 */
export function syncWorkouts(db: SQLiteDatabase): Promise<void> {
  syncing = syncing.catch(() => {}).then(() => doSync(db));
  return syncing;
}

/** Entrenamientos entre dos fechas (incluidas), por orden. */
export async function getWorkouts(db: SQLiteDatabase, from: ISODate, to: ISODate): Promise<Workout[]> {
  // Si poner la tabla al día fallara, se enseña lo que haya: el calendario y la pantalla Hoy no pueden depender de ello.
  await syncWorkouts(db).catch((e) => console.warn('No se pudieron poner al día los entrenamientos', e));
  const rows = await db.getAllAsync<Row>(`SELECT ${COLUMNS} FROM workout WHERE date BETWEEN ? AND ? ORDER BY date, id`, from, to);
  return rows.map(toWorkout);
}

export async function getWorkout(db: SQLiteDatabase, id: number): Promise<Workout | null> {
  const r = await db.getFirstAsync<Row>(`SELECT ${COLUMNS} FROM workout WHERE id = ?`, id);
  return r ? toWorkout(r) : null;
}

/** Apunta un entrenamiento sin detalles: tipo, duración, carga y cómo estabas. */
export async function addWorkout(
  db: SQLiteDatabase,
  w: { date: ISODate; type: string; title: string; minutes: number | null; load: Load | null; state: State | null; notes: string | null },
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO workout (date, type, title, minutes, load, state, notes, edited, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
    w.date,
    w.type,
    w.title,
    w.minutes,
    w.load,
    w.state,
    w.notes?.trim() ? w.notes.trim() : null,
    new Date().toISOString(),
  );
  return r.lastInsertRowId;
}

/** Corrige los campos comunes de un entrenamiento. Desde ese momento la carga y la duración ya no se recalculan solas. */
export async function updateWorkout(
  db: SQLiteDatabase,
  id: number,
  w: { minutes: number | null; load: Load | null; state: State | null; notes: string | null },
): Promise<void> {
  await db.runAsync('UPDATE workout SET minutes = ?, load = ?, state = ?, notes = ?, edited = 1 WHERE id = ?', w.minutes, w.load, w.state, w.notes?.trim() ? w.notes.trim() : null, id);
}

/** Borra un entrenamiento apuntado sin detalles. Los que tienen detalle se borran desde su pantalla. */
export async function deleteWorkout(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout WHERE id = ? AND source IS NULL', id);
}

/**
 * Añade a un entrenamiento con detalle lo que no sale de ese detalle: cómo estabas y cuánto duró de verdad.
 * No marca nada como corregido a mano: la carga sigue saliendo de lo apuntado en la sesión.
 */
export async function setWorkoutMeta(db: SQLiteDatabase, source: string, sourceId: number, meta: { state?: State | null; minutes?: number | null }): Promise<void> {
  await syncWorkouts(db);
  if (meta.state !== undefined) await db.runAsync('UPDATE workout SET state = ? WHERE source = ? AND source_id = ?', meta.state, source, sourceId);
  if (meta.minutes != null && meta.minutes > 0) await db.runAsync('UPDATE workout SET minutes = ? WHERE source = ? AND source_id = ?', Math.round(meta.minutes), source, sourceId);
}
