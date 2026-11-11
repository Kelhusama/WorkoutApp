import type { SQLiteDatabase } from 'expo-sqlite';

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
import { TEMPLATES, initialPrescription } from '@/domain/templates';

export type LogKind = SessionKind | 'gym';

export interface SessionLog {
  id: number;
  date: ISODate;
  kind: LogKind;
  status: 'done' | 'missed';
  feeling: Feeling | null;
  bench_weight: number | null;
  bench_reps: number | null;
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

export interface PlannedDay {
  date: ISODate;
  type: DayType;
  status: DayStatus;
  log?: SessionLog;
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
  const todayDate = getToday();
  // Un día ya registrado conserva lo que se hizo, cambie lo que cambie la semana tipo.
  const loggedRole = (d: ISODate): Role | null => {
    const l = logs.filter((x) => x.date === d);
    if (l.some((x) => x.kind === 'gym')) return 'gym';
    if (l.some((x) => HOME_KINDS.includes(x.kind))) return 'casa';
    return null;
  };
  const roleOn = (d: ISODate): Role =>
    loggedRole(d) ?? overrides.get(d) ?? templateFor(versions, weekStart(d))[weekdayIndex(d)];

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
      days.push({ date: d, type, log, status: dayStatus(type, d, todayDate, log?.status), overridden: overrides.has(d) });
    });
  }
  return { days, template: templateFor(versions, weekStart(getToday())) };
}

// ---------- Prescripciones ----------

export async function getPrescriptions(
  db: SQLiteDatabase,
  kind: SessionKind,
): Promise<Record<string, Prescription>> {
  const slots = TEMPLATES[kind];
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
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps FROM session_log WHERE date BETWEEN ? AND ? ORDER BY date',
    from,
    to,
  );
}

export async function getRecentLogs(db: SQLiteDatabase, limit = 20) {
  return db.getAllAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps FROM session_log ORDER BY date DESC, id DESC LIMIT ?',
    limit,
  );
}

export async function getSessionLog(db: SQLiteDatabase, date: ISODate, kind: LogKind) {
  return db.getFirstAsync<SessionLog>(
    'SELECT id, date, kind, status, feeling, bench_weight, bench_reps FROM session_log WHERE date = ? AND kind = ?',
    date,
    kind,
  );
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
}

export interface SlotChange {
  slotKey: string;
  exerciseId: string;
  change: ChangeKind;
  next: Prescription;
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
): Promise<SlotChange[]> {
  const prescriptions = await getPrescriptions(db, kind);
  const slots = new Map(TEMPLATES[kind].map((s) => [s.key, s]));
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
      `INSERT INTO session_log (date, kind, status, feeling, created_at) VALUES (?, ?, 'done', ?, ?)`,
      date,
      kind,
      feeling,
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
      if (alreadyDone) continue;
      const result = progress(target, slot, { completed: isCompleted(target, r.values), feeling });
      changes.push({ slotKey: r.slotKey, exerciseId: r.exerciseId, ...result });
      if (result.change !== 'none' && result.change !== 'variante') {
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
  bench: { weight: number; reps: number } | null,
) {
  await db.runAsync(
    `INSERT INTO session_log (date, kind, status, feeling, bench_weight, bench_reps, created_at)
     VALUES (?, 'gym', 'done', ?, ?, ?, ?)
     ON CONFLICT(date, kind) DO UPDATE SET status = 'done', feeling = excluded.feeling,
       bench_weight = excluded.bench_weight, bench_reps = excluded.bench_reps`,
    date,
    feeling,
    bench?.weight ?? null,
    bench?.reps ?? null,
    now(),
  );
}

// ---------- Objetivos ----------

export async function getLastBench(db: SQLiteDatabase) {
  return db.getFirstAsync<{ date: ISODate; bench_weight: number; bench_reps: number }>(
    'SELECT date, bench_weight, bench_reps FROM session_log WHERE bench_weight IS NOT NULL ORDER BY date DESC LIMIT 1',
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

export async function getBestTests(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ test: 'dominadas' | 'flexiones'; best: number; last_date: ISODate }>(
    'SELECT test, MAX(value) AS best, MAX(date) AS last_date FROM test_log GROUP BY test',
  );
  return Object.fromEntries(rows.map((r) => [r.test, r])) as Partial<
    Record<'dominadas' | 'flexiones', { best: number; last_date: ISODate }>
  >;
}
