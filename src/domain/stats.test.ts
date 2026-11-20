/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { DayStatus } from './schedule';
import { adherence, detectRecords, exerciseStats, seriesOf, streak } from './stats';

const history = [
  { date: '2026-11-02', values: [5, 5, 4] },
  { date: '2026-11-05', values: [6, 5, 5] },
  { date: '2026-11-09', values: [6, 6, 6, 4] },
];

test('resumen de un ejercicio: mejores marcas y cuándo', () => {
  assert.equal(exerciseStats([]), null);
  assert.deepEqual(exerciseStats(history), {
    bestSet: 6,
    bestSetDate: '2026-11-05', // el empate se queda con la primera vez
    bestTotal: 22,
    bestTotalDate: '2026-11-09',
    sessions: 3,
    lastDate: '2026-11-09',
  });
});

test('récords: solo cuando se supera una marca anterior', () => {
  const prev = new Map([
    ['flexion_estricta', { bestSet: 6, bestTotal: 22 }],
    ['curl_martillo', { bestSet: 12, bestTotal: 36 }],
  ]);
  const r = detectRecords(prev, [
    { exerciseId: 'flexion_estricta', values: [7, 6, 6, 5] }, // serie y total
    { exerciseId: 'curl_martillo', values: [12, 12, 12] }, // iguala: no es récord
    { exerciseId: 'remo_toalla', values: [10, 10] }, // primera vez: no cuenta
  ]);
  assert.deepEqual(r, [
    { exerciseId: 'flexion_estricta', kind: 'serie', value: 7, previous: 6 },
    { exerciseId: 'flexion_estricta', kind: 'total', value: 24, previous: 22 },
  ]);
});

test('récords: un ejercicio repetido en la sesión suma sus series', () => {
  const prev = new Map([['remo_toalla', { bestSet: 12, bestTotal: 40 }]]);
  const r = detectRecords(prev, [
    { exerciseId: 'remo_toalla', values: [12, 12] },
    { exerciseId: 'remo_toalla', values: [10, 10] },
  ]);
  assert.deepEqual(r, [{ exerciseId: 'remo_toalla', kind: 'total', value: 44, previous: 40 }]);
});

const days = (s: string) =>
  [...s].map((c) => ({ status: ({ d: 'done', m: 'missed', r: 'rest', e: 'excused', p: 'pending' } as Record<string, DayStatus>)[c] }));

test('racha: descanso, viaje y pendiente no la rompen; un fallo sí', () => {
  assert.deepEqual(streak(days('ddrrd')), { current: 3, best: 3 });
  assert.deepEqual(streak(days('dddmdr')), { current: 1, best: 3 });
  assert.deepEqual(streak(days('ddeedp')), { current: 3, best: 3 });
  assert.deepEqual(streak(days('dm')), { current: 0, best: 1 });
  assert.deepEqual(streak([]), { current: 0, best: 0 });
});

test('cumplimiento: no cuenta descansos ni viajes', () => {
  assert.deepEqual(adherence(days('ddmrre')), { done: 2, planned: 3 });
});
