/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { weekNumber } from './dates';
import { withoutTrialWork } from './event';
import { ROUTINE_CAP, buildRoutines, pairUp, rankKeys, versionCount } from './routines';
import type { SessionKind } from './schedule';
import { PRIORITY, TEMPLATES, initialPrescription, routineItems, type Slot } from './templates';
import { travelSlots } from './travel';

const KINDS: SessionKind[] = ['A', 'B', 'C'];

function routines(slots: Slot[], order: readonly string[]) {
  const targets = Object.fromEntries(slots.map((s) => [s.key, initialPrescription(s)]));
  const r = buildRoutines(routineItems(slots, targets, order));
  return Object.fromEntries(r.map((x) => [x.size, x]));
}
const home = (kind: SessionKind, slots: Slot[], turn: number) =>
  routines(slots, rankKeys(PRIORITY[kind].filter((k) => slots.some((s) => s.key === k)), turn));

test('cada sesión de casa tiene rutina corta (unos 10 min), media (≤20 min) y larga', () => {
  for (const kind of KINDS) {
    for (const slots of [TEMPLATES[kind], withoutTrialWork(TEMPLATES[kind], true, '2026-11-24')]) {
      for (const turn of [0, 1, 2, 3, 4]) {
        const by = home(kind, slots, turn);
        assert.ok(by.corta.minutes <= ROUTINE_CAP.corta + 2, `${kind} corta: ${by.corta.minutes} min`);
        assert.ok(by.media.minutes <= ROUTINE_CAP.media, `${kind} media: ${by.media.minutes} min`);
        assert.ok(by.corta.keys.length >= 2, kind);
        if (by.larga) assert.equal(by.larga.keys.length, slots.length);
      }
    }
  }
});

test('la media lleva bastantes más ejercicios que haciéndolos por separado, gracias a las superseries', () => {
  for (const kind of KINDS) {
    const slots = withoutTrialWork(TEMPLATES[kind], true, '2026-11-24');
    const by = home(kind, slots, 0);
    assert.ok(by.media.keys.length >= 4, `${kind}: ${by.media.keys.length} ejercicios en ${by.media.minutes} min`);
    assert.ok(by.media.pairs.length >= 1, kind);
    assert.deepEqual(by.corta.pairs, []);
  }
});

test('las dominadas nunca van en superserie y lo que ayuda a las dominadas está siempre en la media', () => {
  const items = routineItems(TEMPLATES.A, Object.fromEntries(TEMPLATES.A.map((s) => [s.key, initialPrescription(s)])), PRIORITY.A);
  const paired = pairUp(items).flat();
  assert.ok(!paired.includes('A.dominadas') && !paired.includes('A.negativas'));
  // Con el plan de dominadas activo, el remo, el curl y la barca (postura de dominada) no rotan: están todas las semanas.
  const withPlan = withoutTrialWork(TEMPLATES.A, true, '2026-11-24');
  for (const turn of [0, 1, 2, 3]) {
    const media = home('A', withPlan, turn).media.keys;
    for (const k of ['A.remo', 'A.curl', 'A.hollow']) assert.ok(media.includes(k), `${k} en la versión ${turn}`);
  }
});

test('en una superserie no coinciden dos ejercicios del mismo músculo', () => {
  const g = (key: string, groups: string[], solo = false) => ({ key, groups, solo });
  const pairs = pairUp([g('flex', ['pecho', 'triceps']), g('incl', ['pecho']), g('curl', ['biceps']), g('remo', ['espalda', 'biceps']), g('dom', ['espalda'], true)]);
  assert.deepEqual(pairs, [['flex', 'curl'], ['incl', 'remo']]);
});

test('las versiones de la media cambian los accesorios, no lo principal ni el orden', () => {
  const media = (turn: number) => home('B', TEMPLATES.B, turn).media.keys;
  for (const turn of [0, 1, 2, 3]) for (const k of ['B.flexiones', 'B.inclinadas']) assert.ok(media(turn).includes(k), `${k} versión ${turn}`);
  assert.notDeepEqual(media(0), media(2));
  const order = TEMPLATES.B.map((s) => s.key);
  assert.deepEqual(media(1), order.filter((k) => media(1).includes(k)));
  assert.equal(versionCount(PRIORITY.B), PRIORITY.B.length - 3);
});

test('de viaje: corta y media caben en su tiempo, sin material y con mancuerna', () => {
  for (const mancuerna of [false, true]) {
    const slots = travelSlots('B', { mancuerna, gimnasio: false });
    const by = routines(slots, slots.map((s) => s.key));
    assert.ok(by.corta.minutes <= ROUTINE_CAP.corta + 2 && by.media.minutes <= ROUTINE_CAP.media, `${by.corta.minutes} / ${by.media.minutes}`);
    // Sin material, los seis ejercicios caben en la media.
    if (!mancuerna) assert.equal(by.media.keys.length, slots.length);
  }
});

test('rankKeys y número de semana', () => {
  assert.deepEqual(rankKeys(['a', 'b', 'c', 'd', 'e'], 1, 3), ['a', 'b', 'c', 'e', 'd']);
  assert.deepEqual(rankKeys(['a', 'b'], 5, 3), ['a', 'b']);
  assert.equal(weekNumber('2026-11-30') - weekNumber('2026-11-23'), 1);
  assert.equal(weekNumber('2026-11-23'), weekNumber('2026-11-29'));
});
