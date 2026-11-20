import type { SQLiteDatabase } from 'expo-sqlite';

import { PLATEAU_DAYS, PLATEAU_SESSIONS, capacity, fitStrength, isPlateau, plateauAction, type DoneSession, type Observation, type Reserve } from '@/domain/coach';
import { EXERCISES } from '@/domain/exercises';
import { addDays, today as getToday, weekdayIndex, weekStart, type ISODate } from '@/domain/dates';
import {
  isCompleted,
  progress,
  type ChangeKind,
  type Feeling,
  type Prescription,
  type Tempo,
} from '@/domain/progression';
import {
  DEFAULT_TEMPLATE,
  assignKinds,
  dayStatus,
  parseTemplate,
  type DayStatus,
  type DayType,
  type Role,
  type SessionKind,
  type WeekTemplate,
} from '@/domain/schedule';
import { estimate1RM } from '@/domain/strength';
import { LEG_KEYS, initialPrescription, type Slot } from '@/domain/templates';
import { getExerciseHistory, getExerciseReserves } from './stats';
import { tripOn, type TravelGear, type Trip } from '@/domain/travel';

export type LogKind = SessionKind | 'gym';

export interface SessionLog {
  id: number;
  date: ISODate;
  kind: LogKind;
  status: 'done' | 'missed';
  feeling: Feeling | null;
  bench_weight: number | null;
  bench_reps: number | null;
  /** 1 si fue una sesión ligera. */
  light: number;
  bench_reserve: Reserve | null;
}

const now = () => new Date().toISOString();

// ---------- Semana ----------

interface TemplateVersion {
  from: ISODate;
  roles: WeekTemplate;
}

async function getTemplateVersions(db: SQLiteDatabase): Promise<TemplateVersion[]> {
  const rows = await db.getAllAsync<{ from_date: ISODate; roles: string }>(
    'SELECT from_date, roles FROM week_template ORDER BY from_date',
  );
  return rows.map((r) => ({ from: r.from_date, roles: parseTemplate(r.roles) }));
}

/** Semana tipo vigente para la semana que empieza en `monday`. */
function templateFor(versions: TemplateVersion[], monday: ISODate): WeekTemplate {
  let t: WeekTemplate = DEFAULT_TEMPLATE;
  for (const v of versions) if (v.from <= monday) t = v.roles;
  return t;
}

export async function getTemplate(db: SQLiteDatabase): Promise<WeekTemplate> {
  return templateFor(await getTemplateVersions(db), weekStart(getToday()));
}

/** Guarda la semana tipo a partir de la semana actual; las semanas anteriores no cambian. */
export async function saveTemplate(db: SQLiteDatabase, t: WeekTemplate) {
  await db.runAsync(
    'INSERT INTO week_template (from_date, roles) VALUES (?, ?) ON CONFLICT(from_date) DO UPDATE SET roles = excluded.roles',
    weekStart(getToday()),
    t.join(','),
  );
}

export async function getOverrides(db: SQLiteDatabase, from: ISODate, to: ISODate): Promise<Map<ISODate, Role>> {
  const rows = await db.getAllAsync<{ date: ISODate; role: Role }>(
    'SELECT date, role FROM day_override WHERE date BETWEEN ? AND ?',
    from,
    to,
  );
  return new Map(rows.map((r) => [r.date, r.role]));
}

/** Cambia lo que se hace un día concreto; `null` lo devuelve a la semana tipo. */
export async function setOverride(db: SQLiteDatabase, date: ISODate, role: Role | null) {
  if (role === null) {
    await db.runAsync('DELETE FROM day_override WHERE date = ?', date);
  } else {
    await db.runAsync(
      'INSERT INTO day_override (date, role) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET role = excluded.role',
      date,
      role,
    );
  }
}

export async function clearWeekOverrides(db: SQLiteDatabase, anyDate: ISODate) {
  const monday = weekStart(anyDate);
  await db.runAsync('DELETE FROM day_override WHERE date BETWEEN ? AND ?', monday, addDays(monday, 6));
}

// ---------- Viajes ----------

interface TripRow {
  id: number;
  from_date: ISODate;
  to_date: ISODate;
  mochila: number;
  mesa: number;
  gimnasio: number;
}

const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  from: r.from_date,
  to: r.to_date,
  gear: { mochila: !!r.mochila, mesa: !!r.mesa, gimnasio: !!r.gimnasio },
});

/** Viajes que tocan el rango de fechas (o todos si no se indica), por orden. */
export async function getTrips(db: SQLiteDatabase, from: ISODate = '0000-01-01', to: ISODate = '9999-12-31'): Promise<Trip[]> {
  const rows = await db.getAllAsync<TripRow>(
    'SELECT id, from_date, to_date, mochila, mesa, gimnasio FROM trip WHERE to_date >= ? AND from_date <= ? ORDER BY from_date',
    from,
    to,
  );
  return rows.map(toTrip);
}

export async function getTripOn(db: SQLiteDatabase, date: ISODate): Promise<Trip | null> {
  return tripOn(await getTrips(db, date, date), date) ?? null;
}

/** Guarda un viaje. Si se solapa con otros, los sustituye. Devuelve su id. */
export async function saveTrip(
  db: SQLiteDatabase,
  trip: { id?: number; from: ISODate; to: ISODate; gear: TravelGear },
): Promise<number> {
  const [from, to] = trip.from <= trip.to ? [trip.from, trip.to] : [trip.to, trip.from];
  let id = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('DELETE FROM trip WHERE (to_date >= ? AND from_date <= ?) OR id = ?', from, to, trip.id ?? -1);
    const r = await tx.runAsync(
      'INSERT INTO trip (from_date, to_date, mochila, mesa, gimnasio) VALUES (?, ?, ?, ?, ?)',
      from,
      to,
      trip.gear.mochila ? 1 : 0,
      trip.gear.mesa ? 1 : 0,
      trip.gear.gimnasio ? 1 : 0,
    );
    id = r.lastInsertRowId;
  });
  return id;
}

export async function deleteTrip(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM trip WHERE id = ?', id);
}

export interface PlannedDay {
  date: ISODate;
  type: DayType;
  status: DayStatus;
  log?: SessionLog;
  /** Viaje activo ese día, si lo hay. */
  trip?: Trip;
  /** El día se ha cambiado respecto a la semana tipo. */
  overridden: boolean;
}

const HOME_KINDS: readonly LogKind[] = ['A', 'B', 'C'];

/** Plan de cada día entre dos fechas (incluidas) con su estado según los registros. */
export async function loadDays(db: SQLiteDatabase, from: ISODate, to: ISODate) {
  const versions = await getTemplateVersions(db);
  const firstMonday = weekStart(from);
  const lastSunday = addDays(weekStart(to), 6);
  const overrides = await getOverrides(db, addDays(firstMonday, -1), lastSunday);
  const logs = await getLogsBetween(db, firstMonday, lastSunday);
  const trips = await getTrips(db, addDays(firstMonday, -1), lastSunday);
  const todayDate = getToday();
  // Un día ya registrado conserva lo que se hizo, cambie lo que cambie la semana tipo.
  const loggedRole = (d: ISODate): Role | null => {
    const l = logs.filter((x) => x.date === d);
    if (l.some((x) => x.kind === 'gym')) return 'gym';
    if (l.some((x) => HOME_KINDS.includes(x.kind))) return 'casa';
    return null;
  };
  // De viaje sin gimnasio de hotel, el día de gimnasio pasa a ser una sesión de casa adaptada.
  const plannedRole = (d: ISODate): Role => {
    const role = overrides.get(d) ?? templateFor(versions, weekStart(d))[weekdayIndex(d)];
    const trip = tripOn(trips, d);
    return role === 'gym' && trip && !trip.gear.gimnasio ? 'casa' : role;
  };
  const roleOn = (d: ISODate): Role => loggedRole(d) ?? plannedRole(d);

  const days: PlannedDay[] = [];
  for (let monday = firstMonday; monday <= to; monday = addDays(monday, 7)) {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const roles = dates.map(roleOn);
    const pinned = dates.map((d, i) =>
      roles[i] === 'casa' ? ((logs.find((l) => l.date === d && HOME_KINDS.includes(l.kind))?.kind as SessionKind) ?? null) : null,
    );
    const kinds = assignKinds(roles, roleOn(addDays(monday, -1)), pinned);
    dates.forEach((d, i) => {
      if (d < from || d > to) return;
      const type = kinds[i];
      const log = type === 'rest' ? undefined : logs.find((l) => l.date === d && l.kind === type);
      const trip = tripOn(trips, d);
      days.push({
        date: d,
        type,
        log,
        trip,
        status: dayStatus(type, d, todayDate, log?.status, !!trip),
        overridden: overrides.has(d),
      });
    });
  }
  return { days, template: templateFor(versions, weekStart(getToday())) };
}

// ---------- Prescripciones ----------

/** Series y repeticiones vigentes de cada ejercicio de la sesión. */
export async function getPrescriptions(db: SQLiteDatabase, slots: readonly Slot[]): Promise<Record<string, Prescription>> {
  const rows = await db.getAllAsync<{ slot_key: string; sets: number; reps: number; tempo: number }>(
    `SELECT slot_key, sets, reps, tempo FROM prescription WHERE slot_key IN (${slots.map(() => '?').join(',')})`,
    ...slots.map((s) => s.key),
  );
  const byKey = new Map(rows.map((r) => [r.slot_key, r]));
  const out: Record<string, Prescription> = {};
  for (const s of slots) {
    const r = byKey.get(s.key);
    out[s.key] = r ? { sets: r.sets, reps: r.reps, tempo: r.tempo as Tempo } : initialPrescription(s);
  }
  return out;
}

// ---------- Registros ----------

export async function getLogsBetween(db: SQLiteDatabase, from: ISODate, to: ISODate) {
  return db.getAllAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps, light, bench_reserve FROM session_log WHERE date BETWEEN ? AND ? ORDER BY date',
    from,
    to,
  );
}

export async function getRecentLogs(db: SQLiteDatabase, limit = 20) {
  return db.getAllAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps, light, bench_reserve FROM session_log ORDER BY date DESC, id DESC LIMIT ?',
    limit,
  );
}

export async function getSessionLog(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  return db.getFirstAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps, light, bench_reserve FROM session_log WHERE date = ? AND kind = ?',
    date,
    kind,
  );
}

/** Reserva apuntada en cada ejercicio de una sesión ya guardada. */
export async function getSessionReserves(db: SQLiteDatabase, sessionId: number): Promise<Record<string, Reserve>> {
  const rows = await db.getAllAsync<{ slot_key: string; reserve: Reserve }>(
    'SELECT slot_key, reserve FROM effort_log WHERE session_id = ?',
    sessionId,
  );
  return Object.fromEntries(rows.map((r) => [r.slot_key, r.reserve]));
}

/** Valores registrados por ejercicio de una sesión ya guardada. */
export async function getSessionSets(db: SQLiteDatabase, sessionId: number): Promise<Record<string, number[]>> {
  const rows = await db.getAllAsync<{ slot_key: string; set_index: number; value: number }>(
    'SELECT slot_key, set_index, value FROM set_log WHERE session_id = ? ORDER BY slot_key, set_index',
    sessionId,
  );
  const out: Record<string, number[]> = {};
  for (const r of rows) (out[r.slot_key] ??= []).push(r.value);
  return out;
}

export async function markMissed(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  await db.runAsync(
    `INSERT INTO session_log (date, kind, status, created_at) VALUES (?, ?, 'missed', ?)
     ON CONFLICT(date, kind) DO UPDATE SET status = 'missed'`,
    date,
    kind,
    now(),
  );
}

export async function deleteLog(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  await db.runAsync('DELETE FROM session_log WHERE date = ? AND kind = ?', date, kind);
}

export interface SlotResult {
  slotKey: string;
  exerciseId: string;
  values: number[];
  /** Repeticiones que quedaban en la última serie, si se apuntó. */
  reserve?: Reserve | null;
}

export interface SlotChange {
  slotKey: string;
  exerciseId: string;
  change: ChangeKind;
  next: Prescription;
  /** Por qué el entrenador lo ha decidido. */
  reason: string;
}

/** Sesiones hechas desde una fecha (gimnasio incluido), para valorar la carga reciente. */
export async function getDoneSessions(db: SQLiteDatabase, from: ISODate): Promise<DoneSession[]> {
  return db.getAllAsync<DoneSession>(
    "SELECT date, kind, feeling FROM session_log WHERE status = 'done' AND date >= ? ORDER BY date",
    from,
  );
}

/**
 * Guarda una sesión de casa y aplica la progresión de cada ejercicio.
 * Si ya existía un registro ese día, se reemplaza (sin volver a progresar dos veces el mismo día).
 */
export async function saveHomeSession(
  db: SQLiteDatabase,
  date: ISODate,
  kind: SessionKind,
  feeling: Feeling,
  results: SlotResult[],
  sessionSlots: readonly Slot[],
  /** Sesión ligera: se guarda, pero no sube ni baja nada. */
  light = false,
): Promise<SlotChange[]> {
  const prescriptions = await getPrescriptions(db, sessionSlots);
  const slots = new Map(sessionSlots.map((s) => [s.key, s]));
  const changes: SlotChange[] = [];

  await db.withExclusiveTransactionAsync(async (tx) => {
    const existing = await tx.getFirstAsync<{ id: number; status: string }>(
      'SELECT id, status FROM session_log WHERE date = ? AND kind = ?',
      date,
      kind,
    );
    const alreadyDone = existing?.status === 'done';
    if (existing) await tx.runAsync('DELETE FROM session_log WHERE id = ?', existing.id);

    const { lastInsertRowId: sessionId } = await tx.runAsync(
      `INSERT INTO session_log (date, kind, status, feeling, light, created_at) VALUES (?, ?, 'done', ?, ?, ?)`,
      date,
      kind,
      feeling,
      light ? 1 : 0,
      now(),
    );

    for (const r of results) {
      const target = prescriptions[r.slotKey];
      const slot = slots.get(r.slotKey);
      if (!target || !slot) continue;
      for (let i = 0; i < r.values.length; i++) {
        await tx.runAsync(
          'INSERT INTO set_log (session_id, slot_key, exercise_id, set_index, target, value, tempo) VALUES (?, ?, ?, ?, ?, ?, ?)',
          sessionId,
          r.slotKey,
          r.exerciseId,
          i,
          target.reps,
          r.values[i],
          target.tempo,
        );
      }
      if (r.reserve != null) {
        await tx.runAsync(
          'INSERT INTO effort_log (session_id, slot_key, exercise_id, reserve) VALUES (?, ?, ?, ?)',
          sessionId,
          r.slotKey,
          r.exerciseId,
          r.reserve,
        );
      }
      if (alreadyDone) continue;
      const completed = isCompleted(target, r.values);
      // ¿También falló la vez anterior, con este mismo objetivo? Entonces son dos seguidas.
      let misses = completed ? 0 : 1;
      if (!completed) {
        const prev = await tx.getAllAsync<{ target: number; value: number }>(
          `SELECT l.target AS target, l.value AS value FROM set_log l JOIN session_log s ON s.id = l.session_id
            WHERE l.slot_key = ? AND s.status = 'done' AND s.light = 0 AND s.date = (
              SELECT MAX(s2.date) FROM set_log l2 JOIN session_log s2 ON s2.id = l2.session_id
               WHERE l2.slot_key = ? AND s2.status = 'done' AND s2.light = 0 AND s2.date < ?)`,
          r.slotKey,
          r.slotKey,
          date,
        );
        if (prev.length > 0 && prev[0].target === target.reps && prev.some((p) => p.value < p.target)) misses = 2;
      }
      let result = progress(target, slot, { completed, feeling, reserve: r.reserve ?? null, misses, light });

      // Meseta: semanas pidiendo lo mismo sin que el nivel real mejore. Entonces decide el entrenador.
      if (result.change === 'none' && !light) {
        // Cuántas sesiones seguidas (las más recientes) se ha pedido exactamente lo mismo, y desde cuándo.
        const past = await tx.getAllAsync<{ date: ISODate; target: number; tempo: number; n: number }>(
          `SELECT s.date AS date, MIN(l.target) AS target, MIN(l.tempo) AS tempo, COUNT(*) AS n
             FROM set_log l JOIN session_log s ON s.id = l.session_id
            WHERE l.slot_key = ? AND s.status = 'done' AND s.light = 0 AND s.date <= ?
            GROUP BY s.date ORDER BY s.date DESC`,
          r.slotKey,
          date,
        );
        let sessions = 0;
        let since = date;
        for (const p of past) {
          if (p.target !== target.reps || p.tempo !== target.tempo || p.n < target.sets) break;
          sessions++;
          since = p.date;
        }
        const daysUnchanged = Math.round((Date.parse(date) - Date.parse(since)) / 86_400_000);
        if (daysUnchanged >= PLATEAU_DAYS && sessions >= PLATEAU_SESSIONS) {
          const history = await getExerciseHistory(tx, r.exerciseId);
          const reserves = await getExerciseReserves(tx, r.exerciseId);
          const unit = EXERCISES[r.exerciseId]?.measure === 'time' ? 5 : 1;
          const state = fitStrength(
            history.map((h) => capacity(h.date, h.values, reserves.get(h.date) ?? null, unit)).filter((o): o is Observation => o !== null),
          );
          if (state && isPlateau({ daysUnchanged, sessions, trend: state.trend })) {
            const atLimit = !completed || r.reserve === 0 || (r.reserve == null && feeling === 'dura');
            result = plateauAction(target, slot, { upper: !LEG_KEYS[kind].includes(r.slotKey), atLimit });
          }
        }
      }
      changes.push({ slotKey: r.slotKey, exerciseId: r.exerciseId, ...result });
      if (result.change !== 'none' && result.change !== 'variante') {
        // Una serie que falta en una sesión ligera no es un fallo: `progress` ya la deja como está.
        await tx.runAsync(
          `INSERT INTO prescription (slot_key, sets, reps, tempo, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slot_key) DO UPDATE SET sets = excluded.sets, reps = excluded.reps, tempo = excluded.tempo, updated_at = excluded.updated_at`,
          r.slotKey,
          result.next.sets,
          result.next.reps,
          result.next.tempo,
          now(),
        );
      }
    }
  });

  return changes;
}

export async function saveGymSession(
  db: SQLiteDatabase,
  date: ISODate,
  feeling: Feeling,
  bench: { weight: number; reps: number; reserve?: Reserve | null } | null,
) {
  await db.runAsync(
    `INSERT INTO session_log (date, kind, status, feeling, bench_weight, bench_reps, bench_reserve, created_at)
     VALUES (?, 'gym', 'done', ?, ?, ?, ?, ?)
     ON CONFLICT(date, kind) DO UPDATE SET status = 'done', feeling = excluded.feeling,
       bench_weight = excluded.bench_weight, bench_reps = excluded.bench_reps, bench_reserve = excluded.bench_reserve`,
    date,
    feeling,
    bench?.weight ?? null,
    bench?.reps ?? null,
    bench?.reserve ?? null,
    now(),
  );
}

// ---------- Objetivos ----------

/** Último día con banca apuntada; con `before`, el último anterior a esa fecha. */
export async function getLastBench(db: SQLiteDatabase, before: ISODate = '9999-12-31') {
  return db.getFirstAsync<{ date: ISODate; bench_weight: number; bench_reps: number; bench_reserve: Reserve | null }>(
    'SELECT date, bench_weight, bench_reps, bench_reserve FROM session_log WHERE bench_weight IS NOT NULL AND date < ? ORDER BY date DESC LIMIT 1',
    before,
  );
}

export async function getBestBench1RM(db: SQLiteDatabase): Promise<number | null> {
  const rows = await db.getAllAsync<{ bench_weight: number; bench_reps: number }>(
    'SELECT bench_weight, bench_reps FROM session_log WHERE bench_weight IS NOT NULL',
  );
  if (rows.length === 0) return null;
  return Math.max(...rows.map((r) => estimate1RM(r.bench_weight, r.bench_reps)));
}

export async function addTest(db: SQLiteDatabase, date: ISODate, test: 'dominadas' | 'flexiones', value: number) {
  await db.runAsync('INSERT INTO test_log (date, test, value) VALUES (?, ?, ?)', date, test, value);
}

export interface TestResult {
  id: number;
  date: ISODate;
  value: number;
}

/** Resultados de un test, del más reciente al más antiguo. */
export async function getTests(db: SQLiteDatabase, test: 'dominadas' | 'flexiones'): Promise<TestResult[]> {
  const rows = await db.getAllAsync<TestResult>('SELECT id, date, value FROM test_log WHERE test = ? ORDER BY date DESC, id DESC', test);
  return rows.map((r) => ({ ...r }));
}

export async function deleteTest(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM test_log WHERE id = ?', id);
}

export async function getBestTests(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ test: 'dominadas' | 'flexiones'; best: number; last_date: ISODate }>(
    'SELECT test, MAX(value) AS best, MAX(date) AS last_date FROM test_log GROUP BY test',
  );
  return Object.fromEntries(rows.map((r) => [r.test, r])) as Partial<
    Record<'dominadas' | 'flexiones', { best: number; last_date: ISODate }>
  >;
}
