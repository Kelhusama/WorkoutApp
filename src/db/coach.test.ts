/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { capacity, fitStrength } from '../domain/coach';
import { TEMPLATES } from '../domain/templates';
import { exportBackup, importBackup } from './backup';
import { deleteLog, getPrescriptions, getSessionLog, getSessionReserves, saveHomeSession } from './repo';
import { migrate } from './schema';
import { getExerciseHistory, getExerciseReserves } from './stats';
import { createTestDb } from './testDb';

async function setup() {
  const db = createTestDb();
  await migrate(db);
  const slots = TEMPLATES.A;
  const target = await getPrescriptions(db, slots);
  const results = (reserve: 0 | 1 | 2 | null) =>
    slots.map((s, i) => ({
      slotKey: s.key,
      exerciseId: s.exerciseId,
      values: Array(target[s.key].sets).fill(target[s.key].reps),
      // Solo el primer ejercicio lleva la reserva apuntada.
      reserve: i === 0 ? reserve : null,
    }));
  return { db, slots, results };
}

test('la reserva se guarda por ejercicio, se recupera al editar y es opcional', async () => {
  const { db, slots, results } = await setup();
  await saveHomeSession(db, '2026-11-16', 'A', 'normal', results(1), slots);
  const log = await getSessionLog(db, '2026-11-16', 'A');
  assert.deepEqual({ ...(await getSessionReserves(db, log!.id)) }, { [slots[0].key]: 1 });

  // Al corregir la sesión se sustituye, no se duplica.
  await saveHomeSession(db, '2026-11-16', 'A', 'normal', results(0), slots);
  const again = await getSessionLog(db, '2026-11-16', 'A');
  assert.deepEqual({ ...(await getSessionReserves(db, again!.id)) }, { [slots[0].key]: 0 });

  const byDate = await getExerciseReserves(db, slots[0].exerciseId);
  assert.deepEqual([...byDate], [['2026-11-16', 0]]);
  assert.equal((await getExerciseReserves(db, slots[1].exerciseId)).size, 0);

  // Borrar la sesión se lleva su reserva.
  await deleteLog(db, '2026-11-16', 'A');
  assert.equal((await getExerciseReserves(db, slots[0].exerciseId)).size, 0);
});

test('del registro al nivel estimado', async () => {
  const { db, slots, results } = await setup();
  for (const [i, date] of ['2026-11-02', '2026-11-05', '2026-11-09', '2026-11-12'].entries()) {
    await saveHomeSession(db, date, 'A', 'normal', results(i % 2 === 0 ? 2 : null), slots);
  }
  const id = slots[0].exerciseId;
  const history = await getExerciseHistory(db, id);
  const reserves = await getExerciseReserves(db, id);
  const state = fitStrength(history.map((h) => capacity(h.date, h.values, reserves.get(h.date) ?? null)!))!;
  assert.equal(state.n, 4);
  assert.ok(state.level >= Math.max(...history[3].values));
  assert.ok(state.levelSd > 0);
});

test('la copia de seguridad lleva la reserva', async () => {
  const { db, slots, results } = await setup();
  await saveHomeSession(db, '2026-11-16', 'A', 'normal', results(2), slots);
  const backup = await exportBackup(db);
  assert.equal(backup.tables.effort_log.length, 1);

  const fresh = createTestDb();
  await migrate(fresh);
  await importBackup(fresh, JSON.parse(JSON.stringify(backup)));
  assert.deepEqual([...(await getExerciseReserves(fresh, slots[0].exerciseId))], [['2026-11-16', 2]]);
});

test('el plan cambia según la reserva, baja tras dos fallos y no se mueve en sesión ligera', async () => {
  const { db, slots } = await setup();
  const key = slots[2].key; // remo: 3 series de 10 a 15
  const before = (await getPrescriptions(db, slots))[key];
  const run = (date: string, reps: number, reserve: 0 | 1 | 2 | null, light = false) =>
    saveHomeSession(db, date, 'A', 'normal', [{ slotKey: key, exerciseId: slots[2].exerciseId, values: Array(before.sets).fill(reps), reserve }], slots, light);
  const now = async () => (await getPrescriptions(db, slots))[key].reps;

  // Sobraban tres o más: sube dos, y explica por qué.
  const up = await run('2026-11-02', before.reps, 2);
  assert.equal(await now(), before.reps + 2);
  assert.match(up[0].reason, /dos de golpe/);
  // Sesión ligera: nada cambia aunque sobre.
  await run('2026-11-04', before.reps + 2, 2, true);
  assert.equal(await now(), before.reps + 2);
  // Un fallo se repite; el segundo seguido baja un peldaño. La ligera de en medio no cuenta.
  await run('2026-11-06', before.reps, null);
  assert.equal(await now(), before.reps + 2);
  await run('2026-11-07', before.reps, null, true);
  const down = await run('2026-11-09', before.reps, null);
  assert.equal(down[0].change, 'baja');
  assert.equal(await now(), before.reps + 1);
  assert.equal((await getSessionLog(db, '2026-11-07', 'A'))!.light, 1);
});
