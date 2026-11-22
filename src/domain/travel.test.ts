/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ILLUSTRATIONS } from '../illustrations/library';
import { EXERCISES } from './exercises';
import type { SessionKind } from './schedule';
import { TEMPLATES } from './templates';
import { NO_GEAR, gearSummary, sessionSlots, travelSlots, tripOn, type TravelGear } from './travel';

const KINDS: SessionKind[] = ['A', 'B', 'C'];
const ALL_GEAR: TravelGear[] = [NO_GEAR, { mancuerna: true, gimnasio: false }];

test('la sesión de viaje es válida con y sin mancuerna, y nunca pide barra', () => {
  for (const gear of ALL_GEAR) {
    for (const kind of KINDS) {
      const slots = travelSlots(kind, gear);
      assert.equal(new Set(slots.map((s) => s.key)).size, slots.length, 'claves repetidas');
      for (const s of slots) {
        const ex = EXERCISES[s.exerciseId];
        assert.ok(ex, s.exerciseId);
        assert.ok(ILLUSTRATIONS[s.exerciseId], `sin dibujo: ${s.exerciseId}`);
        assert.ok(ex.equipment === 'ninguno' || (gear.mancuerna && ex.equipment === 'mancuerna'), `${s.exerciseId} necesita ${ex.equipment}`);
      }
    }
  }
});

test('sin material: flexiones, fondos en silla, zancada y abdomen; la misma todos los días', () => {
  const ids = (k: SessionKind) => travelSlots(k, NO_GEAR).map((s) => s.exerciseId);
  assert.deepEqual(ids('A'), ['flexion_estricta', 'flexion_inclinada', 'fondos_silla', 'zancada_estatica', 'hollow', 'dead_bug']);
  for (const k of KINDS) assert.deepEqual(ids(k), ids('A'));
});

test('con una mancuerna se añaden remo y curl, con la progresión de casa', () => {
  const keys = travelSlots('B', { mancuerna: true, gimnasio: false }).map((s) => s.key);
  for (const k of ['B.flexiones', 'B.inclinadas', 'A.remo', 'A.curl']) assert.ok(keys.includes(k), k);
  assert.equal(sessionSlots('B', null), TEMPLATES.B);
});

test('viaje activo en una fecha y resumen del material', () => {
  const trips = [{ from: '2026-11-20', to: '2026-11-23' }];
  assert.equal(tripOn(trips, '2026-11-20'), trips[0]);
  assert.equal(tripOn(trips, '2026-11-23'), trips[0]);
  assert.equal(tripOn(trips, '2026-11-24'), undefined);
  assert.equal(gearSummary(NO_GEAR), 'Sin material');
  assert.equal(gearSummary({ mancuerna: true, gimnasio: true }), 'Con una mancuerna y gimnasio de hotel');
});
