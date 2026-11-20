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

test('sesión ligera: un tercio menos de series, nunca menos de dos', async () => {
  const { lightSets } = await import('./coach');
  assert.deepEqual([5, 4, 3, 2, 1].map(lightSets), [4, 3, 2, 2, 1]);
});

test('cuándo aflojar: muchas sesiones, tres días seguidos o dos duras', async () => {
  const { readiness } = await import('./coach');
  const s = (date: string, feeling: 'facil' | 'normal' | 'dura' = 'normal', kind = 'A') => ({ date, kind, feeling });
  const today = '2026-11-21';
  assert.equal(readiness([s('2026-11-17'), s('2026-11-19')], today).light, false);
  // Cuatro en los últimos 7 días
  const four = readiness([s('2026-11-15'), s('2026-11-16'), s('2026-11-18'), s('2026-11-19')], today);
  assert.equal(four.light, true);
  assert.match(four.reason, /4 sesiones/);
  // Tres días seguidos
  assert.match(readiness([s('2026-11-18'), s('2026-11-19'), s('2026-11-20')], today).reason, /tres días seguidos/);
  // Dos duras recientes; si son viejas, ya no cuentan
  assert.equal(readiness([s('2026-11-17', 'dura'), s('2026-11-19', 'dura')], today).light, true);
  assert.equal(readiness([s('2026-10-01', 'dura'), s('2026-10-03', 'dura')], today).light, false);
  // La sesión de hoy no cuenta contra sí misma
  assert.equal(readiness([s(today, 'dura'), s('2026-11-19', 'dura')], today).light, false);
});

test('sesión extra: la que hace más tiempo que no haces', async () => {
  const { extraKind } = await import('./coach');
  const s = (date: string, kind: string) => ({ date, kind, feeling: null });
  assert.equal(extraKind([]), 'A');
  assert.equal(extraKind([s('2026-11-16', 'A'), s('2026-11-18', 'B')]), 'C');
  assert.equal(extraKind([s('2026-11-16', 'B'), s('2026-11-18', 'C'), s('2026-11-19', 'A'), s('2026-11-17', 'gym')]), 'B');
});

test('meseta: tres semanas igual, con sesiones suficientes y sin mejora real', async () => {
  const { isPlateau } = await import('./coach');
  assert.equal(isPlateau({ daysUnchanged: 24, sessions: 7, trend: 'estable' }), true);
  assert.equal(isPlateau({ daysUnchanged: 24, sessions: 7, trend: 'bajando' }), true);
  assert.equal(isPlateau({ daysUnchanged: 24, sessions: 7, trend: 'mejorando' }), false);
  assert.equal(isPlateau({ daysUnchanged: 14, sessions: 7, trend: 'estable' }), false);
  assert.equal(isPlateau({ daysUnchanged: 40, sessions: 3, trend: 'estable' }), false);
});

test('qué se hace con una meseta: más estímulo arriba, la pierna se deja', async () => {
  const { plateauAction } = await import('./coach');
  const rules = { repsMin: 8, repsMax: 12, maxSets: 4, step: 1, allowsTempo: true };
  const p = (sets: number, reps: number) => ({ sets, reps, tempo: 0 as const });
  const more = plateauAction(p(3, 12), rules, { upper: true, atLimit: false });
  assert.deepEqual([more.next, more.change], [p(4, 12), 'sets']);
  assert.equal(plateauAction(p(4, 12), rules, { upper: true, atLimit: false }).change, 'none');
  const back = plateauAction(p(3, 10), rules, { upper: true, atLimit: true });
  assert.deepEqual([back.next, back.change], [p(3, 9), 'baja']);
  assert.equal(plateauAction(p(3, 8), rules, { upper: true, atLimit: true }).change, 'none');
  const leg = plateauAction(p(2, 12), rules, { upper: false, atLimit: false });
  assert.equal(leg.change, 'none');
  assert.match(leg.reason, /tren superior/);
});

test('banca: la carga de hoy según la última serie y lo que quedaba', async () => {
  const { benchAdvice } = await import('./coach');
  const w = (reps: number, reserve: 0 | 1 | 2 | null) => benchAdvice({ weight: 50, reps, reserve }).weight;
  assert.equal(w(3, null), 47.5); // no llegó ni de lejos
  assert.equal(w(4, 2), 50); // casi: repite
  assert.equal(w(5, 0), 50); // al límite
  assert.equal(w(5, 1), 52.5);
  assert.equal(w(5, 2), 55);
  assert.equal(w(5, null), 50); // sin dato: prudencia
  assert.equal(w(6, null), 52.5);
  assert.equal(w(8, null), 55);
  assert.equal(benchAdvice({ weight: 20, reps: 2, reserve: null }).weight, 20); // nunca por debajo de la barra
  assert.equal(benchAdvice({ weight: 50, reps: 5, reserve: 1 }).reps, 5);
});
