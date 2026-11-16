/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectRecords } from '../domain/stats';
import { TEMPLATES } from '../domain/templates';
import { addTest, markMissed, saveGymSession, saveHomeSession } from './repo';
import { migrate } from './schema';
import {
  addPhoto,
  deletePhoto,
  getBenchSeries,
  getBests,
  getExerciseHistory,
  getExerciseSummaries,
  getPhotos,
  getTestSeries,
} from './stats';
import { createTestDb } from './testDb';

const B = TEMPLATES.B;
const session = (flex: number[]) =>
  B.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: s.key === 'B.flexiones' ? flex : [10, 10, 10] }));

test('historial, mejores marcas y récords de un ejercicio', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveHomeSession(db, '2026-11-03', 'B', 'normal', session([4, 4, 4, 4]), B);
  await saveHomeSession(db, '2026-11-06', 'B', 'normal', session([5, 5, 4, 4]), B);
  await markMissed(db, '2026-11-10', 'B');

  assert.deepEqual(
    (await getExerciseHistory(db, 'flexion_estricta')).map((h) => ({ ...h })),
    [
      { date: '2026-11-03', values: [4, 4, 4, 4] },
      { date: '2026-11-06', values: [5, 5, 4, 4] },
    ],
  );
  assert.deepEqual({ ...(await getBests(db)).get('flexion_estricta') }, { bestSet: 5, bestTotal: 18 });

  // Al guardar una sesión nueva, las marcas anteriores excluyen ese mismo día (aunque se edite).
  const today = session([6, 5, 5, 3]);
  await saveHomeSession(db, '2026-11-13', 'B', 'normal', today, B);
  const before = await getBests(db, '2026-11-13');
  assert.deepEqual({ ...before.get('flexion_estricta') }, { bestSet: 5, bestTotal: 18 });
  const records = detectRecords(before, today).filter((r) => r.exerciseId === 'flexion_estricta');
  assert.deepEqual(records, [
    { exerciseId: 'flexion_estricta', kind: 'serie', value: 6, previous: 5 },
    { exerciseId: 'flexion_estricta', kind: 'total', value: 19, previous: 18 },
  ]);

  const summaries = await getExerciseSummaries(db);
  assert.deepEqual(
    { ...summaries.find((s) => s.exerciseId === 'flexion_estricta') },
    { exerciseId: 'flexion_estricta', sessions: 3, lastDate: '2026-11-13' },
  );
});

test('series de banca (1RM estimado) y de tests de máximo', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveGymSession(db, '2026-11-02', 'normal', { weight: 50, reps: 5 });
  await saveGymSession(db, '2026-11-05', 'normal', null);
  await saveGymSession(db, '2026-11-09', 'facil', { weight: 52.5, reps: 5 });
  assert.deepEqual(
    (await getBenchSeries(db)).map((p) => [p.date, p.value]),
    [
      ['2026-11-02', 58.5],
      ['2026-11-09', 61.5],
    ],
  );
  await addTest(db, '2026-11-01', 'dominadas', 4);
  await addTest(db, '2026-11-01', 'dominadas', 5);
  await addTest(db, '2026-11-15', 'dominadas', 6);
  assert.deepEqual(
    (await getTestSeries(db, 'dominadas')).map((p) => p.value),
    [5, 6],
  );
  assert.equal((await getTestSeries(db, 'flexiones')).length, 0);
});

test('fotos de progreso: guardar, listar y borrar', async () => {
  const db = createTestDb();
  await migrate(db);
  const id = await addPhoto(db, { date: '2026-11-16', pose: 'frente', uri: 'file:///a.jpg' });
  await addPhoto(db, { date: '2026-11-01', pose: 'lado', uri: 'file:///b.jpg' });
  assert.deepEqual(
    (await getPhotos(db)).map((p) => p.date),
    ['2026-11-01', '2026-11-16'],
  );
  await deletePhoto(db, id);
  assert.equal((await getPhotos(db)).length, 1);
});
