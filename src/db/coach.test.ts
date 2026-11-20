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

test('meseta: tras tres semanas en el tope sin mejorar, el entrenador añade una serie arriba y deja la pierna', async () => {
  const { db, slots } = await setup();
  const { addDays } = await import('../domain/dates');
  const upper = slots[2]; // remo
  const leg = slots[slots.length - 1]; // gemelo
  let last: Awaited<ReturnType<typeof saveHomeSession>> = [];
  let grewAt = -1;
  const start = (await getPrescriptions(db, slots))[upper.key].sets;
  for (let i = 0; i < 20 && grewAt < 0; i++) {
    const t = await getPrescriptions(db, slots);
    // Siempre se completa lo pedido, con sensación normal y sin contestar la reserva.
    const results = [upper, leg].map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: Array(t[s.key].sets).fill(t[s.key].reps), reserve: null }));
    last = await saveHomeSession(db, addDays('2026-08-03', i * 4), 'A', 'normal', results, slots);
    if ((await getPrescriptions(db, slots))[upper.key].sets > start) grewAt = i;
  }
  // Sube repeticiones hasta el tope (5 sesiones), se queda tres semanas igual y entonces gana una serie.
  assert.ok(grewAt >= 10 && grewAt <= 13, `serie añadida en la sesión ${grewAt}`);
  const up = last.find((c) => c.slotKey === upper.key)!;
  assert.equal(up.change, 'sets');
  assert.match(up.reason, /más estímulo/);
  const after = await getPrescriptions(db, slots);
  assert.equal(after[upper.key].reps, upper.repsMax);
  // La pierna, estancada igual o antes, no gana series.
  assert.equal(after[leg.key].sets, leg.initialSets);
});

test('banca: se guarda lo que quedaba y sirve para proponer la carga', async () => {
  const { db } = await setup();
  const { saveGymSession, getLastBench } = await import('./repo');
  const { benchAdvice } = await import('../domain/coach');
  await saveGymSession(db, '2026-11-16', 'normal', { weight: 50, reps: 5, reserve: 1 });
  await saveGymSession(db, '2026-11-19', 'normal', { weight: 52.5, reps: 5, reserve: 0 });
  // Al abrir el día 19 se mira el anterior, no el propio día.
  const prev = (await getLastBench(db, '2026-11-19'))!;
  assert.deepEqual({ ...prev }, { date: '2026-11-16', bench_weight: 50, bench_reps: 5, bench_reserve: 1 });
  assert.equal(benchAdvice({ weight: prev.bench_weight, reps: prev.bench_reps, reserve: prev.bench_reserve }).weight, 52.5);
  const latest = (await getLastBench(db))!;
  assert.equal(benchAdvice({ weight: latest.bench_weight, reps: latest.bench_reps, reserve: latest.bench_reserve }).weight, 52.5);
});

test('bloques de prueba: el test abre, deja seguir o cierra el bloque, y la sesión pide la variante sin tocar el plan', async () => {
  const { db, slots } = await setup();
  const { advanceBlocks, getBlocks, getSlotVariants } = await import('./coach');
  const { applyVariant } = await import('../domain/bandit');

  assert.deepEqual(await advanceBlocks(db, 'dominadas', '2026-09-01', 5), { kind: 'primero', variant: 'base' });
  assert.deepEqual(await advanceBlocks(db, 'dominadas', '2026-09-10', 5), { kind: 'pronto', daysLeft: 12 });
  assert.equal((await getBlocks(db)).length, 1);
  // Cuatro semanas después: se cierra con lo que subió el test y se abre el siguiente.
  const step = await advanceBlocks(db, 'dominadas', '2026-09-29', 7, () => 0.5);
  assert.equal(step.kind, 'cambio');
  const blocks = await getBlocks(db, 'dominadas');
  assert.deepEqual(blocks.map((b) => [b.variant, b.startValue, b.endValue]), [['base', 5, 7], [step.kind === 'cambio' ? step.variant : '', 7, null]]);
  assert.equal((await getBlocks(db, 'flexiones')).length, 0);

  // Se fuerza la variante para comprobar cómo se guarda una sesión con ella.
  await db.runAsync("UPDATE coach_block SET variant = 'cortas' WHERE end_date IS NULL");
  const variants = await getSlotVariants(db);
  assert.deepEqual(variants, { 'A.dominadas': 'cortas', 'C.dominadas': 'cortas' });
  const slot = slots.find((s) => s.key === 'A.dominadas')!;
  const plan = (await getPrescriptions(db, slots))[slot.key];
  const asked = applyVariant(plan, slot, 'cortas');
  assert.ok(asked.sets > plan.sets && asked.reps < plan.reps);
  const changes = await saveHomeSession(
    db,
    '2026-10-01',
    'A',
    'normal',
    [{ slotKey: slot.key, exerciseId: slot.exerciseId, values: Array(asked.sets).fill(asked.reps), reserve: 1 }],
    slots,
    false,
    variants,
  );
  // Completó lo que se le pidió con margen: el plan de fondo sube una repetición desde su valor, no desde el de la variante.
  assert.equal(changes[0].change, 'reps');
  assert.equal((await getPrescriptions(db, slots))[slot.key].reps, plan.reps + 1);
  const logged = await db.getAllAsync<{ target: number }>("SELECT target FROM set_log WHERE slot_key = 'A.dominadas'");
  assert.equal(logged.length, asked.sets);
  assert.equal(logged[0].target, asked.reps);

  // Los bloques van en la copia de seguridad.
  const backup = await exportBackup(db);
  const fresh = createTestDb();
  await migrate(fresh);
  await importBackup(fresh, JSON.parse(JSON.stringify(backup)));
  assert.equal((await getBlocks(fresh)).length, 2);
});
