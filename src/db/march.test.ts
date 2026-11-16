/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportBackup, importBackup } from './backup';
import { deleteWalk, getWalk, getWalks, loadMarch, saveWalk, startMarch, stopMarch } from './march';
import { migrate } from './schema';
import { createTestDb } from './testDb';

const walk = (date: string, km: number, kind: 'suave' | 'larga' = 'suave') => ({
  date,
  kind,
  km,
  minutes: km * 12,
  elevation: null,
  packKg: null,
  effort: 5,
  notes: null,
});

test('caminatas: guardar, editar, leer y borrar', async () => {
  const db = createTestDb();
  await migrate(db);
  const id = await saveWalk(db, { ...walk('2026-11-15', 15, 'larga'), elevation: 220, packKg: 4, notes: '  ampolla en el talón  ' });
  await saveWalk(db, walk('2026-11-10', 6));
  assert.deepEqual((await getWalks(db)).map((w) => w.date), ['2026-11-10', '2026-11-15']);
  assert.deepEqual(await getWalk(db, id), {
    id,
    date: '2026-11-15',
    kind: 'larga',
    km: 15,
    minutes: 180,
    elevation: 220,
    packKg: 4,
    effort: 5,
    notes: 'ampolla en el talón',
  });
  await saveWalk(db, { ...walk('2026-11-15', 16.5, 'larga'), id });
  assert.equal((await getWalk(db, id))!.km, 16.5);
  await deleteWalk(db, id);
  assert.equal((await getWalks(db)).length, 1);
});

test('sin plan en marcha no hay estado; al empezar, arranca en el escalón elegido', async () => {
  const db = createTestDb();
  await migrate(db);
  assert.equal((await loadMarch(db, '2026-11-16')).state, null);
  await startMarch(db, 5, '2026-11-09');
  assert.deepEqual((await loadMarch(db, '2026-11-10')).state, { step: 5, since: '2026-11-09', completed: false });
});

test('registrar la tirada larga avanza el plan y el avance queda guardado', async () => {
  const db = createTestDb();
  await migrate(db);
  await startMarch(db, 5, '2026-11-09');
  await saveWalk(db, walk('2026-11-15', 15, 'larga'));
  const first = await loadMarch(db, '2026-11-15');
  assert.equal(first.state!.step, 6);
  assert.deepEqual(first.events, [{ type: 'avance', from: 5, to: 6 }]);
  // La segunda lectura ya no anuncia nada: el avance se guardó
  const second = await loadMarch(db, '2026-11-15');
  assert.equal(second.state!.step, 6);
  assert.deepEqual(second.events, []);
});

test('dejar el plan conserva las caminatas', async () => {
  const db = createTestDb();
  await migrate(db);
  await startMarch(db, 3, '2026-11-09');
  await saveWalk(db, walk('2026-11-10', 5));
  await stopMarch(db);
  const snap = await loadMarch(db, '2026-11-16');
  assert.equal(snap.state, null);
  assert.equal(snap.walks.length, 1);
});

test('la copia de seguridad incluye las caminatas y el plan', async () => {
  const source = createTestDb();
  await migrate(source);
  await startMarch(source, 7, '2026-11-09');
  await saveWalk(source, walk('2026-11-10', 6));
  const target = createTestDb();
  await migrate(target);
  await importBackup(target, await exportBackup(source));
  const snap = await loadMarch(target, '2026-11-12');
  assert.equal(snap.state!.step, 7);
  assert.equal(snap.walks[0].km, 6);
});
