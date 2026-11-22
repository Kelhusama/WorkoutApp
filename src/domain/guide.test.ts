/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAIR_REST, estimateMinutes, guidePlan } from './guide';

const order = (steps: { slot: number; set: number }[]) => steps.map((s) => `${s.slot}.${s.set}`);

test('sesión guiada: un ejercicio entero y luego el siguiente; los que no tienen series se saltan', () => {
  const steps = guidePlan([3, 2, 0, 2].map((sets) => ({ sets, rest: 90 })));
  assert.deepEqual(order(steps), ['0.0', '0.1', '0.2', '1.0', '1.1', '3.0', '3.1']);
  assert.ok(steps.every((s) => s.rest === 90 && s.partner === undefined));
  assert.deepEqual(guidePlan([]), []);
});

test('superserie: se alternan los dos ejercicios, con descanso corto entre ellos', () => {
  const items = [
    { sets: 3, rest: 90 },
    { sets: 2, rest: 120 },
    { sets: 2, rest: 45 },
  ];
  const steps = guidePlan(items, [[0, 2]]);
  // 0 y 2 se alternan; al 2 se le acaban las series y el 0 termina solo; luego va el 1.
  assert.deepEqual(order(steps), ['0.0', '2.0', '0.1', '2.1', '0.2', '1.0', '1.1']);
  assert.deepEqual(steps.slice(0, 5).map((s) => s.rest), [PAIR_REST.inner, PAIR_REST.outer, PAIR_REST.inner, PAIR_REST.outer, 90]);
  assert.deepEqual(steps.slice(5).map((s) => s.rest), [120, 120]);
  assert.equal(steps[0].partner, 2);
  // Cada serie sale una sola vez.
  assert.equal(new Set(order(steps)).size, 7);
});

test('duración estimada: series, descansos y colocarse', () => {
  // 3 series de 10 repeticiones (30 s) con 90 s de descanso: 20 + 3 × 120 − 90 = 290 s ≈ 5 min.
  assert.equal(estimateMinutes([{ sets: 3, amount: 10, byTime: false, perSide: false, rest: 90 }]), 5);
  // Por cada lado cuenta doble; un aguante dura sus segundos.
  const two = [
    { sets: 2, amount: 8, byTime: false, perSide: true, rest: 60 }, // 20 + 2 × (48 + 60) = 236
    { sets: 2, amount: 15, byTime: true, perSide: false, rest: 45 }, // 20 + 2 × (15 + 45) − 45 = 95
  ];
  assert.equal(estimateMinutes(two), 6);
  assert.equal(estimateMinutes([]), 0);
  assert.equal(estimateMinutes([{ sets: 0, amount: 10, byTime: false, perSide: false, rest: 90 }]), 0);
});

test('en superserie la misma sesión dura bastante menos', () => {
  const items = [
    { sets: 4, amount: 6, byTime: false, perSide: false, rest: 90 },
    { sets: 4, amount: 10, byTime: false, perSide: false, rest: 90 },
  ];
  const apart = estimateMinutes(items);
  const together = estimateMinutes(items, [[0, 1]]);
  assert.ok(together <= apart - 4, `${together} frente a ${apart}`);
});
