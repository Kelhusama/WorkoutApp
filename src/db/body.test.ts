/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { INDICATORS, leanMass, rangeFor, type Profile } from '../domain/body';
import { getBodyLog, saveBodyEntry } from './body';
import { migrate } from './schema';
import { createTestDb } from './testDb';

const profile: Profile = { heightCm: 178, birthDate: '1990-01-01', sex: 'H', activity: 1.55 };
const ind = (id: string) => INDICATORS.find((i) => i.id === id)!;

test('guarda y lee una medición con todos los datos de la báscula', async () => {
  const db = createTestDb();
  await migrate(db);
  const full = {
    date: '2026-11-12',
    weight: 82.4,
    waist: 90,
    neck: 39,
    hip: null,
    arm: 35.5,
    chest: 102,
    bodyFat: 21.3,
    fatFreeMass: 64.8,
    skeletalMuscle: 36.1,
    water: 55.2,
    protein: 17.4,
    boneMass: 3.2,
    visceralFat: 9,
    scaleBmr: 1740,
    bodyAge: 33,
    bodyScore: 81,
  };
  await saveBodyEntry(db, full);
  assert.deepEqual({ ...(await getBodyLog(db))[0] }, full);

  // Editar el mismo día reemplaza los valores, también los que se dejan vacíos.
  await saveBodyEntry(db, { date: '2026-11-12', weight: 82.1 });
  const [edited] = await getBodyLog(db);
  assert.equal(edited.weight, 82.1);
  assert.equal(edited.skeletalMuscle, null);
});

test('la masa libre de grasa de la báscula tiene prioridad', () => {
  assert.equal(leanMass({ date: '2026-11-12', weight: 80, bodyFat: 20, fatFreeMass: 63 }, profile), 63);
  assert.equal(leanMass({ date: '2026-11-12', weight: 80, bodyFat: 20 }, profile), 64);
});

test('indicadores de la báscula: valor y rangos', () => {
  const e = { date: '2026-11-12', weight: 80, visceralFat: 12, water: 55, skeletalMuscle: 36 };
  assert.equal(ind('musculo').compute(e, profile, []), 36);
  assert.equal(rangeFor(ind('visceral'), profile, 9)!.label, 'Saludable');
  assert.equal(rangeFor(ind('visceral'), profile, 12)!.label, 'Alta');
  assert.equal(rangeFor(ind('agua'), profile, 55)!.label, 'Normal');
  assert.equal(ind('edad').compute(e, profile, []), null);
});
