/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXERCISES } from './exercises';
import { needsDeload, platesPerSide, warmupSets } from './gymTools';
import { EXERCISE_MUSCLES, volumeVerdict, weeklyVolume } from './volume';

test('calentamiento: barra y pasos al 50, 70 y 85 %', () => {
  assert.deepEqual(warmupSets(50), [
    { weight: 20, reps: 10 },
    { weight: 25, reps: 5 },
    { weight: 35, reps: 3 },
    { weight: 42.5, reps: 2 },
  ]);
  assert.deepEqual(warmupSets(80).map((s) => s.weight), [20, 40, 55, 67.5]);
  // Con poco peso no se repiten pasos ni se pasa del peso de trabajo
  assert.deepEqual(warmupSets(25), [{ weight: 20, reps: 10 }]);
  assert.deepEqual(warmupSets(20), [{ weight: 20, reps: 10 }]);
  assert.deepEqual(warmupSets(0), []);
});

test('discos por lado', () => {
  assert.deepEqual(platesPerSide(50), { plates: [15], rest: 0 });
  assert.deepEqual(platesPerSide(80), { plates: [25, 5], rest: 0 });
  assert.deepEqual(platesPerSide(52.5), { plates: [15, 1.25], rest: 0 });
  assert.deepEqual(platesPerSide(20), { plates: [], rest: 0 });
  assert.deepEqual(platesPerSide(51), { plates: [15], rest: 1 }); // 1 kg no se puede montar
});

test('descarga: 3 de las últimas 4 sesiones duras', () => {
  assert.equal(needsDeload(['facil', 'dura', 'dura', 'normal', 'dura']), true);
  assert.equal(needsDeload(['dura', 'dura', 'normal', 'normal']), false);
  assert.equal(needsDeload(['dura', 'dura', 'dura']), false); // aún hay pocas sesiones
  assert.equal(needsDeload(['dura', 'dura', 'dura', 'dura', 'facil', 'normal', 'facil', 'normal']), false);
});

test('todos los ejercicios tienen músculos asignados', () => {
  for (const id of Object.keys(EXERCISES)) assert.ok(EXERCISE_MUSCLES[id], id);
});

test('volumen semanal: principal cuenta 1 y secundario 0,5', () => {
  const v = weeklyVolume([
    { exerciseId: 'flexion_estricta', sets: 4 },
    { exerciseId: 'flexion_inclinada', sets: 3 },
    { exerciseId: 'curl_concentrado', sets: 3 },
    { exerciseId: 'dominada_supina', sets: 5 },
    { exerciseId: 'desconocido', sets: 9 },
  ]);
  assert.equal(v.pecho, 7);
  assert.equal(v.biceps, 8);
  assert.equal(v.triceps, 3.5);
  assert.equal(v.espalda, 5);
  assert.equal(volumeVerdict(8).label, 'Por debajo');
  assert.equal(volumeVerdict(12).label, 'En zona');
  assert.equal(volumeVerdict(24).label, 'Mucho volumen');
});
