/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays } from '../domain/dates';
import { FLEX_TEST_BY_ID, testSummary, weekAdherence } from '../domain/flexibility';
import { exportBackup, importBackup } from './backup';
import {
  addFlexTest,
  deleteFlexSession,
  deleteFlexTest,
  getFlexSessions,
  getFlexState,
  getFlexTests,
  loadFlex,
  recordFlexSession,
  saveFlexSession,
  saveFlexState,
} from './flexibility';
import { migrate } from './schema';
import { createTestDb } from './testDb';

async function freshDb() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

test('la migración deja el esquema en la última versión con las dos tablas', async () => {
  const db = await freshDb();
  const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  assert.equal(v!.user_version, 19);
  const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'flex_%' ORDER BY name");
  assert.deepEqual(tables.map((t) => t.name), ['flex_session', 'flex_test']);
});

test('una base en la versión 10 se actualiza sin perder datos', async () => {
  const db = await freshDb();
  await db.execAsync(`
    DROP TABLE flex_session;
    DROP TABLE flex_test;
    INSERT INTO stretch_log (date, routine, stretch_id, seconds) VALUES ('2026-11-10', 'postA', 'dorsal_marco', 60);
    PRAGMA user_version = 10;
  `);
  await migrate(db);
  assert.equal((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM stretch_log'))!.n, 1);
  assert.equal(await saveFlexSession(db, { date: '2026-11-16', level: 1, seconds: 600, exercises: ['cosaca'] }), 1);
});

test('guardar, listar y borrar sesiones', async () => {
  const db = await freshDb();
  const a = await saveFlexSession(db, { date: '2026-11-17', level: 1, seconds: 612.4, exercises: ['rana_mariposa', 'cosaca', 'cosaca'] });
  const b = await saveFlexSession(db, { date: '2026-11-10', level: 1, seconds: 300, exercises: ['zancada_baja'] });
  assert.ok(a !== null && b !== null);
  const all = await getFlexSessions(db);
  assert.deepEqual(all.map((s) => s.date), ['2026-11-10', '2026-11-17']);
  assert.deepEqual(all[1], { id: a, date: '2026-11-17', level: 1, seconds: 612, exercises: ['rana_mariposa', 'cosaca'] });
  assert.equal((await getFlexSessions(db, '2026-11-16', '2026-11-22')).length, 1);
  assert.equal(weekAdherence(all.map((s) => s.date), '2026-11-18').label, '1 de 3 esta semana');
  await deleteFlexSession(db, a!);
  assert.deepEqual((await getFlexSessions(db)).map((s) => s.id), [b]);
});

test('una sesión sin nada hecho no se guarda', async () => {
  const db = await freshDb();
  assert.equal(await saveFlexSession(db, { date: '2026-11-17', level: 1, seconds: 0, exercises: [] }), null);
  assert.equal(await saveFlexSession(db, { date: '2026-11-17', level: 1, seconds: 40, exercises: [] }), null);
  assert.equal(await recordFlexSession(db, { date: '2026-11-17', level: 1, seconds: 0, exercises: ['cosaca'] }), null);
  assert.equal((await getFlexSessions(db)).length, 0);
  assert.equal(await getFlexState(db), null);
});

test('guardar, listar y borrar resultados de tests', async () => {
  const db = await freshDb();
  await addFlexTest(db, '2026-10-01', 'dedos_suelo', 12.5);
  const wrong = await addFlexTest(db, '2026-11-01', 'dedos_suelo', 75);
  await addFlexTest(db, '2026-11-01', 'dedos_suelo', 7.5);
  await addFlexTest(db, '2026-11-01', 'rascado', -4);
  assert.equal((await getFlexTests(db)).length, 4);
  assert.equal((await getFlexTests(db, 'rascado'))[0].value, -4);
  await deleteFlexTest(db, wrong);
  const toe = await getFlexTests(db, 'dedos_suelo');
  assert.deepEqual(toe.map((r) => r.value), [12.5, 7.5]);
  const s = testSummary(toe, FLEX_TEST_BY_ID.dedos_suelo, '2026-11-16');
  assert.equal(s.improvement, 5);
  assert.equal(s.real, true);
});

test('el nivel se calcula al cargar y se anota al guardar una sesión', async () => {
  const db = await freshDb();
  const first = await loadFlex(db, '2026-10-05');
  assert.deepEqual([first.progress.level, first.progress.blockStart, first.progress.sessionsInBlock], [1, '2026-10-05', 0]);

  // Diez sesiones en el primer bloque (del 5 de octubre al 1 de noviembre).
  for (let i = 0; i < 10; i++) {
    const p = await recordFlexSession(db, { date: addDays('2026-10-05', i * 2), level: 1, seconds: 700, exercises: ['cosaca'] });
    assert.equal(p!.level, 1);
    assert.equal(p!.sessionsInBlock, i + 1);
  }
  assert.deepEqual(await getFlexState(db), { level: 1, blockStart: '2026-10-05' });

  // Al cerrarse el bloque, la pantalla ya ve el nivel 2 aunque aún no esté anotado.
  const after = await loadFlex(db, '2026-11-03');
  assert.equal(after.progress.level, 2);
  assert.equal(after.progress.changed, true);
  assert.deepEqual(await getFlexState(db), { level: 1, blockStart: '2026-10-05' });

  const p = await recordFlexSession(db, { date: '2026-11-03', level: 2, seconds: 800, exercises: ['cosaca'] });
  assert.deepEqual([p!.level, p!.blockStart, p!.sessionsInBlock], [2, '2026-11-02', 1]);
  assert.deepEqual(await getFlexState(db), { level: 2, blockStart: '2026-11-02' });
  assert.equal((await loadFlex(db, '2026-11-04')).progress.changed, false);
});

test('un estado guardado que no vale se ignora', async () => {
  const db = await freshDb();
  await saveFlexState(db, { level: 2, blockStart: '2026-11-02' });
  assert.deepEqual(await getFlexState(db), { level: 2, blockStart: '2026-11-02' });
  await db.runAsync("UPDATE settings SET value = '7' WHERE key = 'flex_level'");
  assert.equal(await getFlexState(db), null);
});

test('la copia de seguridad lleva sesiones, tests y nivel', async () => {
  const db = await freshDb();
  await recordFlexSession(db, { date: '2026-11-16', level: 1, seconds: 640, exercises: ['rana_mariposa', 'cosaca'] });
  await addFlexTest(db, '2026-11-16', 'rodilla_pared', 9.5);
  await saveFlexState(db, { level: 3, blockStart: '2026-11-16' });

  const backup = await exportBackup(db);
  assert.equal(backup.schema, 19);
  assert.equal(backup.tables.flex_session.length, 1);
  assert.equal(backup.tables.flex_test.length, 1);

  const target = await freshDb();
  await saveFlexSession(target, { date: '2026-01-01', level: 2, seconds: 100, exercises: ['durmiente'] });
  await importBackup(target, JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(await getFlexSessions(target), await getFlexSessions(db));
  assert.deepEqual(await getFlexTests(target), await getFlexTests(db));
  assert.deepEqual(await getFlexState(target), { level: 3, blockStart: '2026-11-16' });
});

test('una copia antigua sin las tablas de flexibilidad se restaura dejándolas vacías', async () => {
  const db = await freshDb();
  const backup = await exportBackup(db);
  delete backup.tables.flex_session;
  delete backup.tables.flex_test;
  backup.schema = 10;
  const target = await freshDb();
  await addFlexTest(target, '2026-11-16', 'apertura', 120);
  await importBackup(target, backup);
  assert.equal((await getFlexTests(target)).length, 0);
});
