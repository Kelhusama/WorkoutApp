/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATES } from '../domain/templates';
import { NO_GEAR } from '../domain/travel';
import { backupSummary, exportBackup, importBackup, parseBackup } from './backup';
import { getBodyLog, saveBodyEntry, saveProfile } from './body';
import { getPrescriptions, getTrips, loadDays, saveGymSession, saveHomeSession, saveTemplate, saveTrip } from './repo';
import { migrate } from './schema';
import { getExerciseHistory } from './stats';
import { createTestDb } from './testDb';

async function seeded() {
  const db = createTestDb();
  await migrate(db);
  const B = TEMPLATES.B;
  const results = B.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: Array(s.initialSets).fill(s.repsMin) }));
  await saveHomeSession(db, '2026-11-03', 'B', 'facil', results, B);
  await saveGymSession(db, '2026-11-02', 'normal', { weight: 50, reps: 5 });
  await saveProfile(db, { heightCm: 180, birthDate: '1990-01-01', sex: 'H', activity: 1.55 });
  await saveBodyEntry(db, { date: '2026-11-01', weight: 83.2, bodyFat: 25.9 });
  await saveTrip(db, { from: '2026-12-01', to: '2026-12-05', gear: { ...NO_GEAR, mancuerna: true } });
  await saveTemplate(db, ['gym', 'casa', 'gym', 'casa', 'casa', 'rest', 'rest']);
  return db;
}

test('exportar e importar en una base de datos nueva conserva todo', async () => {
  const source = await seeded();
  const json = JSON.stringify(await exportBackup(source));
  const backup = parseBackup(json);
  assert.deepEqual(backupSummary(backup), { sessions: 2, measurements: 1, date: backup.exportedAt.slice(0, 10) });

  const target = createTestDb();
  await migrate(target);
  await saveBodyEntry(target, { date: '2026-10-01', weight: 90 }); // se sustituye
  await importBackup(target, backup);

  assert.deepEqual(
    (await getBodyLog(target)).map((e) => [e.date, e.weight, e.bodyFat]),
    [['2026-11-01', 83.2, 25.9]],
  );
  assert.deepEqual(
    (await getExerciseHistory(target, 'flexion_estricta')).map((h) => ({ ...h })),
    [{ date: '2026-11-03', values: [4, 4, 4, 4] }],
  );
  // La progresión aplicada (fácil → una repetición más) también viaja en la copia
  assert.equal((await getPrescriptions(target, TEMPLATES.B))['B.flexiones'].reps, 5);
  assert.equal((await getTrips(target))[0].gear.mancuerna, true);
  const { template } = await loadDays(target, '2026-11-02', '2026-11-08');
  assert.equal(template[2], 'gym');
});

test('una copia inválida o de una versión más nueva se rechaza sin tocar los datos', async () => {
  const db = await seeded();
  assert.throws(() => parseBackup('esto no es json'), /no es una copia/);
  assert.throws(() => parseBackup('{"app":"otra","schema":1,"tables":{}}'), /de esta app/);
  const newer = { ...(await exportBackup(db)), schema: 999 };
  await assert.rejects(importBackup(db, newer), /más nueva/);
  assert.equal((await getBodyLog(db)).length, 1);
});

test('si la restauración falla a medias no se pierde nada', async () => {
  const db = await seeded();
  const bad = await exportBackup(db);
  bad.tables.body_log = [{ date: '2026-01-01', weight: null }]; // peso obligatorio: falla
  await assert.rejects(importBackup(db, bad));
  assert.equal((await getBodyLog(db))[0].weight, 83.2);
  assert.equal((await getExerciseHistory(db, 'flexion_estricta')).length, 1);
});

test('las columnas desconocidas de la copia se ignoran', async () => {
  const db = await seeded();
  const b = await exportBackup(db);
  b.tables.body_log = [{ date: '2026-02-02', weight: 80, columna_rara: 1 }];
  await importBackup(db, b);
  assert.equal((await getBodyLog(db))[0].weight, 80);
});
