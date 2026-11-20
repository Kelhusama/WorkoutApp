/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Observation } from './coach';
import { addDays } from './dates';
import { EXAM_MIN, exam, train } from './neural';

function series(n: number, f: (i: number) => number): Observation[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays('2026-06-01', i * 3), value: f(i), noise: 1 }));
}

/** Ruido repetible entre −1 y 1. */
const wobble = (i: number) => Math.sin(i * 12.9898) * Math.cos(i * 4.1414);

test('con pocas sesiones no hay examen', () => {
  assert.equal(exam(series(EXAM_MIN - 1, (i) => 10 + i)), null);
  assert.equal(train(series(5, (i) => 10 + i)), null);
});

test('la red aprende un patrón que el filtro no ve, y entonces gana', () => {
  // Un día fuerte y dos flojos, siempre igual: el filtro lo trata como ruido.
  const obs = series(40, (i) => 12 + (i % 3 === 0 ? 3 : 0));
  const e = exam(obs)!;
  assert.equal(e.winner, 'neural');
  assert.ok(e.neural < e.kalman * 0.7, JSON.stringify(e));
});

test('con datos ruidosos de verdad y sin patrón, manda el filtro', () => {
  // Ruido de un generador de azar con varias semillas: la red no debe ganar casi nunca.
  let neuralWins = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    let a = seed * 7919;
    const rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const e = exam(series(30, () => 10 + (rnd() - 0.5) * 3))!;
    if (e.winner === 'neural') neuralWins++;
  }
  assert.ok(neuralWins <= 1, 'la red ganó ' + neuralWins + ' de 6 veces con puro ruido');
});
