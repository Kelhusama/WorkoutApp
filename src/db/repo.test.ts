/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, today, weekStart } from '../domain/dates';
import { TEMPLATES } from '../domain/templates';
import { NO_GEAR, travelSlots } from '../domain/travel';
import {
  clearWeekOverrides,
  deleteTrip,
  getPrescriptions,
  getTripOn,
  getTrips,
  loadDays,
  markMissed,
  saveGymSession,
  saveHomeSession,
  saveTemplate,
  saveTrip,
  setOverride,
} from './repo';
import { migrate } from './schema';
import { createTestDb } from './testDb';

const monday = weekStart(today());
const week = async (db: ReturnType<typeof createTestDb>, m = monday) =>
  (await loadDays(db, m, addDays(m, 6))).days.map((d) => d.type);

test('migraciones desde cero y semana por defecto', async () => {
  const db = createTestDb();
  await migrate(db);
  await migrate(db); // idempotente
  assert.deepEqual(await week(db), ['gym', 'B', 'A', 'gym', 'C', 'rest', 'rest']);
});

test('la migración convierte las semanas con gimnasio el miércoles', async () => {
  const db = createTestDb();
  // Simula una base de datos de la versión anterior (v3) con el gimnasio el miércoles esta semana.
  await db.execAsync(`
    CREATE TABLE week_config (week_start TEXT PRIMARY KEY, second_gym TEXT);
    CREATE TABLE prescription (slot_key TEXT PRIMARY KEY, sets INT, reps INT, tempo INT, updated_at TEXT);
    CREATE TABLE session_log (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, kind TEXT, status TEXT, feeling TEXT,
      bench_weight REAL, bench_reps INT, notes TEXT, created_at TEXT, UNIQUE(date, kind));
    CREATE TABLE set_log (id INTEGER PRIMARY KEY, session_id INT, slot_key TEXT, exercise_id TEXT, set_index INT, target INT, value INT, tempo INT);
    CREATE TABLE test_log (id INTEGER PRIMARY KEY, date TEXT, test TEXT, value INT);
    CREATE TABLE profile (id INTEGER PRIMARY KEY, height_cm REAL, birth_date TEXT, sex TEXT, activity REAL);
    CREATE TABLE body_log (date TEXT PRIMARY KEY, weight REAL);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
    PRAGMA user_version = 3;
  `);
  await db.runAsync("INSERT INTO week_config VALUES (?, 'X')", monday);
  await migrate(db);
  assert.deepEqual(await week(db), ['gym', 'B', 'gym', 'C', 'A', 'rest', 'rest']);
});

test('cambiar un día solo afecta a esa semana y se puede deshacer', async () => {
  const db = createTestDb();
  await migrate(db);
  await setOverride(db, addDays(monday, 5), 'casa'); // sábado a casa
  const k = await week(db);
  assert.notEqual(k[5], 'rest');
  assert.deepEqual(await week(db, addDays(monday, 7)), ['gym', 'B', 'A', 'gym', 'C', 'rest', 'rest']);
  await clearWeekOverrides(db, monday);
  assert.equal((await week(db))[5], 'rest');
});

test('la semana tipo nueva no reescribe semanas pasadas', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveTemplate(db, ['gym', 'casa', 'gym', 'casa', 'gym', 'rest', 'rest']);
  assert.deepEqual((await week(db)).filter((t) => t === 'gym').length, 3);
  assert.deepEqual(await week(db, addDays(monday, -7)), ['gym', 'B', 'A', 'gym', 'C', 'rest', 'rest']);
});

test('un día registrado conserva lo hecho aunque cambie el plan', async () => {
  const db = createTestDb();
  await migrate(db);
  const lastWeek = addDays(monday, -7);
  await saveGymSession(db, addDays(lastWeek, 1), 'normal', null); // martes pasado fue al gimnasio
  await markMissed(db, addDays(lastWeek, 2), 'A');
  const days = (await loadDays(db, lastWeek, addDays(lastWeek, 6))).days;
  assert.equal(days[1].type, 'gym');
  assert.equal(days[1].status, 'done');
  assert.equal(days[2].type, 'A');
  assert.equal(days[2].status, 'missed');
});

// ---------- Viajes ----------

test('de viaje sin gimnasio de hotel, el día de gimnasio pasa a sesión de casa', async () => {
  const db = createTestDb();
  await migrate(db);
  const next = addDays(monday, 7);
  await saveTrip(db, { from: next, to: addDays(next, 6), gear: NO_GEAR });
  const noGym = await loadDays(db, next, addDays(next, 6));
  assert.equal(noGym.days.filter((d) => d.type === 'gym').length, 0);
  assert.ok(noGym.days.every((d) => d.trip));
  // Sigue sin haber tirón justo después de lo que era gimnasio... y los descansos se mantienen.
  assert.equal(noGym.days.filter((d) => d.type === 'rest').length, 2);

  await saveTrip(db, { from: next, to: addDays(next, 6), gear: { ...NO_GEAR, gimnasio: true } });
  const withGym = await loadDays(db, next, addDays(next, 6));
  assert.equal(withGym.days.filter((d) => d.type === 'gym').length, 2);
});

test('un día de viaje pasado sin entrenar no cuenta como fallo', async () => {
  const db = createTestDb();
  await migrate(db);
  const last = addDays(monday, -7);
  await saveTrip(db, { from: addDays(last, 1), to: addDays(last, 2), gear: NO_GEAR });
  const { days } = await loadDays(db, last, addDays(last, 6));
  assert.equal(days[0].status, 'missed'); // lunes, sin viaje
  assert.equal(days[1].status, 'excused');
  assert.equal(days[2].status, 'excused');
  assert.equal(days[3].status, 'missed');
});

test('guardar un viaje que se solapa sustituye al anterior; se puede borrar', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveTrip(db, { from: '2026-12-01', to: '2026-12-05', gear: NO_GEAR });
  const id = await saveTrip(db, { from: '2026-12-04', to: '2026-12-08', gear: { ...NO_GEAR, mesa: true } });
  let trips = await getTrips(db);
  assert.equal(trips.length, 1);
  assert.deepEqual([trips[0].from, trips[0].to, trips[0].gear.mesa], ['2026-12-04', '2026-12-08', true]);
  assert.equal((await getTripOn(db, '2026-12-06'))?.id, id);
  assert.equal(await getTripOn(db, '2026-12-02'), null);
  // Editar el mismo viaje (fechas al revés se ordenan)
  await saveTrip(db, { id, from: '2026-12-10', to: '2026-12-09', gear: NO_GEAR });
  trips = await getTrips(db);
  assert.deepEqual([trips.length, trips[0].from, trips[0].to], [1, '2026-12-09', '2026-12-10']);
  await deleteTrip(db, trips[0].id);
  assert.equal((await getTrips(db)).length, 0);
});

test('la sesión de viaje guarda su propia progresión sin tocar la de casa', async () => {
  const db = createTestDb();
  await migrate(db);
  const slots = travelSlots('A', NO_GEAR);
  const before = await getPrescriptions(db, slots);
  const results = slots.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: Array(before[s.key].sets).fill(before[s.key].reps) }));
  const changes = await saveHomeSession(db, '2026-12-01', 'A', 'facil', results, slots);
  assert.equal(changes.length, slots.length);
  const after = await getPrescriptions(db, slots);
  assert.equal(after['V.A.remo_toalla'].reps, before['V.A.remo_toalla'].reps + 1);
  const home = await getPrescriptions(db, TEMPLATES.A);
  assert.deepEqual(home['A.dominadas'], { sets: 5, reps: 2, tempo: 0 });
  // Guardar otra vez el mismo día no vuelve a subir la dificultad
  assert.equal((await saveHomeSession(db, '2026-12-01', 'A', 'facil', results, slots)).length, 0);
});
