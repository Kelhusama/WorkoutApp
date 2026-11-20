/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { capacity, fitStrength, projectWindow, trendText, type Observation } from './coach';
import { addDays } from './dates';

/** Ruido repetible, sin depender del azar. */
function noiseSeq(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296 - 0.5) * 2;
  };
}

function synthetic(n: number, start: number, perWeek: number, jitter: number, everyDays = 3): Observation[] {
  const rnd = noiseSeq(7);
  return Array.from({ length: n }, (_, i) => ({
    date: addDays('2026-09-01', i * everyDays),
    value: start + (perWeek / 7) * i * everyDays + rnd() * jitter,
    noise: 1,
  }));
}

test('capacidad: la reserva suma a la última serie y sin ella la medida es menos fiable', () => {
  assert.deepEqual(capacity('2026-11-20', [8, 8, 7], 1), { date: '2026-11-20', value: 8.5, noise: 1 });
  assert.equal(capacity('2026-11-20', [8, 8, 8], 2)!.value, 11.5);
  // Última serie muy floja: manda la mejor serie.
  assert.equal(capacity('2026-11-20', [10, 8, 5], 0)!.value, 10);
  const blind = capacity('2026-11-20', [8, 8, 7], null)!;
  assert.equal(blind.value, 8);
  assert.equal(blind.noise, 2);
  // Por tiempo: cada «repetición» de reserva vale 5 s, y el ruido crece con la magnitud.
  const plank = capacity('2026-11-20', [40, 40], 1, 5)!;
  assert.equal(plank.value, 47.5);
  assert.ok(Math.abs(plank.noise - 2.8) < 1e-9);
  assert.equal(capacity('2026-11-20', [], 1), null);
  assert.equal(capacity('2026-11-20', [0, 0], 1), null);
});

test('recupera el ritmo de una mejora constante con ruido', () => {
  const s = fitStrength(synthetic(24, 6, 0.5, 1))!;
  assert.equal(s.trend, 'mejorando');
  assert.ok(Math.abs(s.ratePerWeek - 0.5) < 0.25, `ritmo ${s.ratePerWeek}`);
  const truth = 6 + (0.5 / 7) * 23 * 3;
  assert.ok(Math.abs(s.level - truth) < 1, `nivel ${s.level} frente a ${truth}`);
  assert.equal(s.series.length, 24);
});

test('con ruido y sin mejora dice «estable», no ve progreso donde no lo hay', () => {
  const s = fitStrength(synthetic(24, 8, 0, 1))!;
  assert.equal(s.trend, 'estable');
  assert.ok(Math.abs(s.level - 8) < 0.8);
});

test('detecta una bajada', () => {
  assert.equal(fitStrength(synthetic(24, 12, -0.5, 1))!.trend, 'bajando');
});

test('con pocas sesiones no opina', () => {
  const s = fitStrength(synthetic(3, 6, 2, 0))!;
  assert.equal(s.trend, 'pocos_datos');
  assert.match(trendText(s, 'repeticiones'), /4 sesiones/);
  assert.equal(fitStrength([]), null);
});

test('un día malo aislado apenas mueve el nivel', () => {
  const obs = synthetic(16, 10, 0, 0.2);
  const before = fitStrength(obs)!.level;
  const after = fitStrength([...obs, { date: addDays(obs[15].date, 3), value: 6, noise: 1 }])!.level;
  assert.ok(before - after < 1.5, `bajó ${before - after}`);
});

test('proyección con margen: la fecha optimista va antes que la prudente', () => {
  const s = fitStrength(synthetic(24, 6, 0.5, 1))!;
  const w = projectWindow(s, 15, '2026-11-20')!;
  assert.ok(w.from > '2026-11-20');
  assert.ok(w.to === null || w.to > w.from);
  // Ya conseguido o sin mejora: no hay previsión.
  assert.equal(projectWindow(s, 5, '2026-11-20'), null);
  assert.equal(projectWindow(fitStrength(synthetic(24, 8, 0, 1))!, 15, '2026-11-20'), null);
});
