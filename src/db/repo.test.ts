/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, today, weekStart } from '../domain/dates';
import { clearWeekOverrides, loadDays, markMissed, saveGymSession, saveTemplate, setOverride } from './repo';
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
