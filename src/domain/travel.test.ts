/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ILLUSTRATIONS } from '../illustrations/library';
import { EXERCISES } from './exercises';
import type { SessionKind } from './schedule';
import { TEMPLATES } from './templates';
import { NO_GEAR, gearSummary, sessionSlots, travelSlots, tripOn, type TravelGear } from './travel';

const KINDS: SessionKind[] = ['A', 'B', 'C'];
const ALL_GEAR: TravelGear[] = [];
for (const mochila of [false, true]) for (const mesa of [false, true]) ALL_GEAR.push({ mochila, mesa, gimnasio: false });

test('cualquier combinación de material da sesiones válidas, con ejercicio y dibujo', () => {
  for (const gear of ALL_GEAR) {
    for (const kind of KINDS) {
      const slots = travelSlots(kind, gear);
      assert.ok(slots.length >= 3, `${kind} ${JSON.stringify(gear)}`);
      assert.equal(new Set(slots.map((s) => s.key)).size, slots.length, 'claves repetidas');
      for (const s of slots) {
        const ex = EXERCISES[s.exerciseId];
        assert.ok(ex, s.exerciseId);
        assert.ok(ILLUSTRATIONS[s.exerciseId], `sin dibujo: ${s.exerciseId}`);
        assert.ok(s.repsMin <= s.repsMax && s.initialSets <= s.maxSets, s.key);
        // Nada que necesite lo que no hay en el viaje
        assert.ok(ex.equipment !== 'barra' && ex.equipment !== 'mancuerna', `${s.exerciseId} necesita ${ex.equipment}`);
        if (ex.equipment === 'mesa') assert.ok(gear.mesa);
        if (ex.equipment === 'mochila') assert.ok(gear.mochila);
        if (ex.measure === 'time') assert.equal(s.step, 5);
      }
    }
  }
});

test('sin material: remo con toalla, curl isométrico y flexiones', () => {
  assert.deepEqual(
    travelSlots('A', NO_GEAR).map((s) => s.exerciseId),
    ['remo_toalla', 'agarre_toalla', 'curl_isometrico_toalla', 'elevacion_tibial', 'elevacion_talones'],
  );
  assert.equal(travelSlots('C', NO_GEAR)[1].exerciseId, 'flexion_pica');
});

test('las flexiones conservan su clave para seguir la progresión', () => {
  const keys = travelSlots('B', NO_GEAR).map((s) => s.key);
  for (const k of ['B.flexiones', 'B.inclinadas', 'B.pica']) assert.ok(keys.includes(k));
  assert.equal(sessionSlots('B', null), TEMPLATES.B);
});

test('viaje activo en una fecha y resumen del material', () => {
  const trips = [{ from: '2026-11-20', to: '2026-11-23' }];
  assert.equal(tripOn(trips, '2026-11-20'), trips[0]);
  assert.equal(tripOn(trips, '2026-11-23'), trips[0]);
  assert.equal(tripOn(trips, '2026-11-24'), undefined);
  assert.equal(gearSummary(NO_GEAR), 'Sin material');
  assert.equal(gearSummary({ mochila: true, mesa: false, gimnasio: true }), 'Con mochila, gimnasio de hotel');
});
