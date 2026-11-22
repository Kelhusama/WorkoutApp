/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lightSets } from './coach';
import { weekNumber } from './dates';
import { withoutTrialWork } from './event';
import { ROUTINE_CAP, buildRoutines, rankKeys, type RoutineItem } from './routines';
import type { SessionKind } from './schedule';
import { PRIORITY, TEMPLATES, exerciseFor, initialPrescription, restSeconds, type Slot } from './templates';
import { travelSlots } from './travel';

function items(slots: Slot[], order: readonly string[]): RoutineItem[] {
  return slots.map((s, i) => {
    const ex = exerciseFor(s);
    const p = initialPrescription(s);
    const base = { amount: p.reps, byTime: ex.measure === 'time', perSide: ex.perArm };
    const rank = order.indexOf(s.key);
    return {
      key: s.key,
      rank: rank < 0 ? order.length + i : rank,
      full: { ...base, sets: p.sets, rest: restSeconds(s) },
      light: { ...base, sets: lightSets(p.sets), rest: restSeconds(s, true) },
    };
  });
}

test('cada sesión de casa tiene rutina corta (≤10 min), media (≤20 min) y larga', () => {
  for (const kind of ['A', 'B', 'C'] as SessionKind[]) {
    for (const slots of [TEMPLATES[kind], withoutTrialWork(TEMPLATES[kind], true, '2026-11-24')]) {
      for (const week of [0, 1, 2, 3, 4]) {
        const r = buildRoutines(items(slots, rankKeys(PRIORITY[kind], week)));
        const by = Object.fromEntries(r.map((x) => [x.size, x]));
        assert.ok(by.corta.minutes <= ROUTINE_CAP.corta + 2, `${kind} corta: ${by.corta.minutes} min`);
        assert.ok(by.media.minutes <= ROUTINE_CAP.media, `${kind} media: ${by.media.minutes} min`);
        assert.ok(by.corta.keys.length >= 2 && by.media.keys.length >= by.corta.keys.length, kind);
        if (by.larga) assert.equal(by.larga.keys.length, slots.length);
      }
    }
  }
});

test('la rutina media conserva lo esencial y rota los accesorios cada semana', () => {
  const media = (week: number) => buildRoutines(items(TEMPLATES.B, rankKeys(PRIORITY.B, week))).find((r) => r.size === 'media')!.keys;
  for (const week of [0, 1, 2, 3]) for (const k of ['B.flexiones', 'B.inclinadas']) assert.ok(media(week).includes(k), `${k} semana ${week}`);
  const seen = new Set([0, 1, 2, 3, 4].flatMap(media));
  // A lo largo de cinco semanas entran más ejercicios de los que caben en una sola.
  assert.ok(seen.size > media(0).length);
  // El orden de la sesión no cambia.
  const order = TEMPLATES.B.map((s) => s.key);
  assert.deepEqual(media(1), order.filter((k) => media(1).includes(k)));
});

test('de viaje: corta y media caben en su tiempo, sin material y con mancuerna', () => {
  for (const mancuerna of [false, true]) {
    const slots = travelSlots('B', { mancuerna, gimnasio: false });
    const r = buildRoutines(items(slots, slots.map((s) => s.key)));
    assert.ok(r[0].minutes <= ROUTINE_CAP.corta + 2 && r[1].minutes <= ROUTINE_CAP.media);
  }
});

test('rankKeys y número de semana', () => {
  assert.deepEqual(rankKeys(['a', 'b', 'c', 'd', 'e'], 1, 3), ['a', 'b', 'c', 'e', 'd']);
  assert.deepEqual(rankKeys(['a', 'b'], 5, 3), ['a', 'b']);
  assert.equal(weekNumber('2026-11-30') - weekNumber('2026-11-23'), 1);
  assert.equal(weekNumber('2026-11-23'), weekNumber('2026-11-29'));
});
