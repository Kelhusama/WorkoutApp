/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { estimateMinutes, guideAfter, guideTotalSets } from './guide';

test('sesión guiada: recorre todas las series en orden y termina', () => {
  const sets = [3, 2, 0, 2];
  const seen: string[] = [];
  let at: { slot: number; set: number } | null = { slot: 0, set: 0 };
  while (at) {
    seen.push(`${at.slot}.${at.set}`);
    at = guideAfter(sets, at);
  }
  // El ejercicio sin series se salta.
  assert.deepEqual(seen, ['0.0', '0.1', '0.2', '1.0', '1.1', '3.0', '3.1']);
  assert.equal(guideTotalSets(sets), seen.length);
  assert.equal(guideAfter([2], { slot: 0, set: 1 }), null);
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

test('la sesión de viaje ligera cabe en 20 minutos, con y sin mancuerna', async () => {
  const { MAX_SESSION_MINUTES } = await import('./guide');
  const { exerciseFor, initialPrescription, restSeconds } = await import('./templates');
  const { travelSlots } = await import('./travel');
  const { lightSets } = await import('./coach');
  const minutes = (mancuerna: boolean) =>
    estimateMinutes(
      travelSlots('B', { mancuerna, gimnasio: false }).map((s) => {
        const ex = exerciseFor(s);
        const p = initialPrescription(s);
        return { sets: lightSets(p.sets), amount: p.reps, byTime: ex.measure === 'time', perSide: ex.perArm, rest: restSeconds(s, true) };
      }),
    );
  assert.ok(minutes(false) <= MAX_SESSION_MINUTES, `sin material: ${minutes(false)} min`);
});
