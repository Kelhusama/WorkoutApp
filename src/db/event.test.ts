/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPlan, currentLevel, doneThisWeek, prescription } from '../domain/event';
import { exportBackup, importBackup } from './backup';
import { addTrialLog, deleteTrialLog, getLastBodyWeight, getTrialLogs } from './event';
import { migrate } from './schema';
import { createTestDb } from './testDb';

test('sesiones de la prueba: se guardan, ajustan lo que toca, se borran y van en la copia', async () => {
  const db = createTestDb();
  await migrate(db);
  assert.deepEqual(await getTrialLogs(db), []);
  assert.equal(await getLastBodyWeight(db), null);

  const a = await addTrialLog(db, { date: '2026-11-21', lift: 'dominada', weight: 0, reps: 1, sets: 6, reserve: 1 });
  await addTrialLog(db, { date: '2026-11-24', lift: 'peso_muerto', weight: 80, reps: 5, sets: 4, reserve: null });
  const logs = await getTrialLogs(db);
  assert.equal(logs.length, 2);
  const w8 = buildPlan()[0];
  assert.equal(doneThisWeek('dominada', w8, logs), 1);
  assert.equal(prescription('peso_muerto', w8, logs).weight, 80);
  assert.equal(currentLevel('peso_muerto', logs, '2026-11-25'), 92); // una sesión suave no baja de la marca de partida

  // No admite un ejercicio que no sea de la prueba.
  await assert.rejects(() => db.runAsync("INSERT INTO trial_log (date, lift, weight, reps, sets) VALUES ('2026-11-21', 'banca', 50, 5, 3)"));

  const backup = await exportBackup(db);
  const fresh = createTestDb();
  await migrate(fresh);
  await importBackup(fresh, JSON.parse(JSON.stringify(backup)));
  assert.equal((await getTrialLogs(fresh)).length, 2);

  await deleteTrialLog(db, a);
  assert.deepEqual((await getTrialLogs(db)).map((l) => l.lift), ['peso_muerto']);
});
