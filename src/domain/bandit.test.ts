/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyVariant, armStats, blockReward, chooseVariant, goalOfSlot, onTest, type Block, type Variant } from './bandit';

/** Azar repetible (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1;
const block = (variant: Variant, gained: number | null, goal: Block['goal'] = 'dominadas'): Block => ({
  id: nextId++,
  goal,
  variant,
  startDate: '2026-01-01',
  startValue: 5,
  endDate: gained === null ? null : '2026-01-29',
  endValue: gained === null ? null : 5 + gained,
});

test('variantes: series cortas da más series y menos repeticiones; largas, lo contrario', () => {
  const rules = { repsMin: 2, repsMax: 4, maxSets: 7, step: 1, allowsTempo: false };
  const p = (sets: number, reps: number) => ({ sets, reps, tempo: 0 as const });
  assert.deepEqual(applyVariant(p(5, 2), rules, 'base'), p(5, 2));
  assert.deepEqual(applyVariant(p(5, 2), rules, 'cortas'), p(8, 1));
  assert.deepEqual(applyVariant(p(5, 4), rules, 'cortas'), p(8, 2));
  assert.deepEqual(applyVariant(p(5, 2), rules, 'largas'), p(4, 3));
  assert.deepEqual(applyVariant(p(4, 8), rules, 'cortas'), p(7, 5));
  assert.deepEqual(applyVariant(p(4, 8), rules, 'largas'), p(3, 10));
  // Nunca menos de una repetición ni de dos series.
  assert.deepEqual(applyVariant(p(2, 1), rules, 'cortas'), p(4, 1));
  assert.deepEqual(applyVariant(p(2, 1), rules, 'largas'), p(2, 2));
});

test('qué ejercicios cambia cada objetivo', () => {
  assert.equal(goalOfSlot('A.dominadas'), 'dominadas');
  assert.equal(goalOfSlot('B.flexiones'), 'flexiones');
  assert.equal(goalOfSlot('A.remo'), null);
});

test('lo que rinde un bloque: repeticiones ganadas en el test por semana', () => {
  assert.equal(blockReward(block('base', 2)), 0.5); // 2 en 4 semanas
  assert.equal(blockReward(block('base', -1)), -0.25);
  assert.equal(blockReward(block('base', null)), null);
  const stats = armStats([block('base', 2), block('base', 0), block('cortas', 4), block('largas', null), block('cortas', 9, 'flexiones')], 'dominadas');
  assert.deepEqual(stats, [
    { variant: 'base', n: 2, mean: 0.25 },
    { variant: 'cortas', n: 1, mean: 1 },
    { variant: 'largas', n: 0, mean: null },
  ]);
});

test('Thompson: sin datos reparte; con datos claros se queda casi siempre con la mejor, sin dejar de probar', () => {
  const count = (blocks: Block[]) => {
    const rnd = seeded(42);
    const c: Record<Variant, number> = { base: 0, cortas: 0, largas: 0 };
    for (let i = 0; i < 3000; i++) c[chooseVariant(blocks, 'dominadas', rnd)]++;
    return c;
  };
  const even = count([]);
  for (const v of Object.values(even)) assert.ok(v > 800 && v < 1200, JSON.stringify(even));

  const clear = count([
    ...[1, 2, 3, 4].map(() => block('cortas', 4)), // +1 por semana
    ...[1, 2, 3, 4].map(() => block('base', 0)),
    ...[1, 2, 3, 4].map(() => block('largas', -2)),
  ]);
  assert.ok(clear.cortas > 2700, JSON.stringify(clear));
  assert.ok(clear.cortas < 3000, 'debe seguir probando alguna vez las otras');

  // Una variante sin probar tiene más opciones que una probada y mala.
  const fresh = count([...[1, 2, 3].map(() => block('base', -2)), ...[1, 2, 3].map(() => block('cortas', -2))]);
  assert.ok(fresh.largas > 1700, JSON.stringify(fresh));
});

test('al apuntar un test: primero, demasiado pronto o cambio de bloque', () => {
  assert.deepEqual(onTest([], 'dominadas', '2026-11-20', 6), { kind: 'primero', variant: 'base' });
  const open: Block = { id: 99, goal: 'dominadas', variant: 'cortas', startDate: '2026-11-01', startValue: 6, endDate: null, endValue: null };
  assert.deepEqual(onTest([open], 'dominadas', '2026-11-10', 6), { kind: 'pronto', daysLeft: 12 });
  // El bloque de otro objetivo no cuenta.
  assert.equal(onTest([open], 'flexiones', '2026-12-01', 20).kind, 'primero');
  const out = onTest([open], 'dominadas', '2026-11-29', 8, seeded(1));
  assert.equal(out.kind, 'cambio');
  if (out.kind === 'cambio') {
    assert.equal(out.previous, 'cortas');
    assert.equal(out.reward, 0.5); // 2 repeticiones en 4 semanas
    assert.ok(['base', 'cortas', 'largas'].includes(out.variant));
  }
});

test('cuándo toca test: el primero, o a las cuatro semanas de bloque', async () => {
  const { testsDue } = await import('./bandit');
  assert.deepEqual(testsDue([], '2026-11-20'), [
    { goal: 'dominadas', first: true, days: 0 },
    { goal: 'flexiones', first: true, days: 0 },
  ]);
  const open = (goal: Block['goal'], startDate: string): Block => ({ id: nextId++, goal, variant: 'base', startDate, startValue: 5, endDate: null, endValue: null });
  assert.deepEqual(testsDue([open('dominadas', '2026-11-01'), open('flexiones', '2026-10-20')], '2026-11-20'), [{ goal: 'flexiones', first: false, days: 31 }]);
});
