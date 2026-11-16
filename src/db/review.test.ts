/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TEMPLATES } from '../domain/templates';
import { saveBodyEntry } from './body';
import { saveWalk, startMarch } from './march';
import { markMissed, saveGymSession, saveHomeSession } from './repo';
import { countWeekRecords, loadWeekReview } from './review';
import { migrate } from './schema';
import { saveStretching } from './stretch';
import { createTestDb } from './testDb';

const B = TEMPLATES.B;
const session = (flex: number[]) =>
  B.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: s.key === 'B.flexiones' ? flex : Array(s.initialSets).fill(s.repsMin) }));

// Semana del lunes 2 al domingo 8 de noviembre de 2026; se revisa el lunes 9.
const MONDAY = '2026-11-02';
const TODAY = '2026-11-09';

test('récords de la semana: solo cuenta superar marcas anteriores', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveHomeSession(db, '2026-10-27', 'B', 'normal', session([4, 4, 4, 4]), B);
  assert.equal(await countWeekRecords(db, MONDAY, '2026-11-08'), 0);
  await saveHomeSession(db, '2026-11-03', 'B', 'normal', session([6, 5, 4, 4]), B);
  // Solo mejora las flexiones estrictas; el resto repite marca
  assert.equal(await countWeekRecords(db, MONDAY, '2026-11-08'), 1);
  // La primera vez de un ejercicio no es récord
  const fresh = createTestDb();
  await migrate(fresh);
  await saveHomeSession(fresh, '2026-11-03', 'B', 'normal', session([6, 5, 4, 4]), B);
  assert.equal(await countWeekRecords(fresh, MONDAY, '2026-11-08'), 0);
});

test('revisión de una semana completa', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveGymSession(db, '2026-11-02', 'normal', { weight: 50, reps: 5 }); // lunes
  await saveHomeSession(db, '2026-11-03', 'B', 'dura', session([4, 4, 4, 4]), B); // martes
  await markMissed(db, '2026-11-04', 'A'); // miércoles
  await saveGymSession(db, '2026-11-05', 'normal', null); // jueves
  // El viernes (C) queda sin registrar: al revisar el lunes siguiente cuenta como fallado
  await saveStretching(db, '2026-11-03', 'postB', [{ stretchId: 'mariposa', seconds: 120 }]);
  await saveBodyEntry(db, { date: '2026-11-07', weight: 83 });
  await saveWalk(db, { date: '2026-11-08', kind: 'larga', km: 12.5, minutes: 150, elevation: null, packKg: null, effort: 5, notes: null });
  await startMarch(db, 4, '2026-11-02');

  const r = await loadWeekReview(db, MONDAY, TODAY);
  assert.equal(r.done, 3);
  assert.equal(r.missed, 2);
  assert.equal(r.planned, 5);
  assert.equal(r.hardSessions, 1);
  assert.equal(r.volume.pecho, 7); // 4 de flexiones + 3 de inclinadas
  assert.equal(r.stretchDays, 1);
  assert.equal(r.stretchMinutes, 2);
  assert.equal(r.walkedKm, 12.5);
  assert.equal(r.walks, 1);
  assert.equal(r.marchActive, true);
  assert.equal(r.longWalkDone, true);
  assert.equal(r.weighedIn, true);
  assert.equal(r.trend, 83);
  // Dos sesiones sin hacer pesan más que cualquier otro aviso
  assert.equal(r.focus.title, 'No fallar dos seguidas');
});

test('una semana vacía en una app recién instalada no da errores', async () => {
  const db = createTestDb();
  await migrate(db);
  const r = await loadWeekReview(db, MONDAY, TODAY);
  assert.equal(r.done, 0);
  assert.equal(r.trend, null);
  assert.equal(r.focus.title, 'Volver a empezar');
});
