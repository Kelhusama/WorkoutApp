/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROUTINES, minutesByZone, routineSteps } from '../domain/stretches';
import { exportBackup, importBackup } from './backup';
import { migrate } from './schema';
import { getStretching, saveStretching, stretchedOn } from './stretch';
import { createTestDb } from './testDb';

test('guardar una rutina suma los dos lados de cada estiramiento', async () => {
  const db = createTestDb();
  await migrate(db);
  const steps = routineSteps(ROUTINES.inferior);
  await saveStretching(db, '2026-11-16', 'inferior', steps);
  const entries = await getStretching(db);
  assert.equal(entries.length, ROUTINES.inferior.stretchIds.length);
  assert.equal(entries.find((e) => e.stretchId === 'cosaco')!.seconds, 60);
  assert.equal(minutesByZone(entries).aductores, 3);
  assert.equal(await stretchedOn(db, '2026-11-16', 'inferior'), true);
  assert.equal(await stretchedOn(db, '2026-11-16', 'postA'), false);
});

test('una rutina a medias guarda solo lo hecho; los pasos saltados no cuentan', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveStretching(db, '2026-11-16', 'postB', [
    { stretchId: 'pectoral_marco', seconds: 30 },
    { stretchId: 'pectoral_marco', seconds: 12 },
    { stretchId: 'triceps_nuca', seconds: 0 },
  ]);
  assert.deepEqual(await getStretching(db), [{ date: '2026-11-16', stretchId: 'pectoral_marco', seconds: 42 }]);
});

test('consulta por fechas y copia de seguridad', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveStretching(db, '2026-11-10', 'postA', [{ stretchId: 'dorsal_marco', seconds: 60 }]);
  await saveStretching(db, '2026-11-17', 'postA', [{ stretchId: 'dorsal_marco', seconds: 60 }]);
  assert.equal((await getStretching(db, '2026-11-16', '2026-11-22')).length, 1);
  const target = createTestDb();
  await migrate(target);
  await importBackup(target, await exportBackup(db));
  assert.equal((await getStretching(target)).length, 2);
});
