/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evolve, formatDuration, formatPace, pace, plannedWalks, recentForm, weeklySeries, type MarchState } from './march';
import { LAST_STEP, stepAt } from './marchPlan';

const st = (step: number, since: string): MarchState => ({ step, since, completed: false });

test('al completar la tirada larga se avanza y se cuenta desde el día siguiente', () => {
  // Escalón 5: tirada de 15 km
  const r = evolve(st(5, '2026-11-09'), [{ date: '2026-11-15', km: 15.2 }], '2026-11-15');
  assert.deepEqual(r.state, { step: 6, since: '2026-11-16', completed: false });
  assert.deepEqual(r.events, [{ type: 'avance', from: 5, to: 6 }]);
});

test('sin la tirada larga, el escalón se repite aunque pase la semana', () => {
  const walks = [
    { date: '2026-11-10', km: 6 },
    { date: '2026-11-15', km: 9 },
  ];
  const r = evolve(st(5, '2026-11-09'), walks, '2026-11-20');
  assert.equal(r.state.step, 5);
  assert.deepEqual(r.events, []);
});

test('una caminata anterior al escalón no cuenta', () => {
  const r = evolve(st(5, '2026-11-09'), [{ date: '2026-11-08', km: 20 }], '2026-11-12');
  assert.equal(r.state.step, 5);
});

test('las semanas de descarga avanzan solas a los 7 días', () => {
  // Escalón 6 es descarga
  assert.equal(evolve(st(6, '2026-11-16'), [], '2026-11-22').state.step, 6);
  const r = evolve(st(6, '2026-11-16'), [{ date: '2026-11-18', km: 5 }], '2026-11-23');
  assert.deepEqual(r.state, { step: 7, since: '2026-11-23', completed: false });
});

test('varias semanas registradas de golpe avanzan varios escalones', () => {
  const walks = [
    { date: '2026-11-08', km: 10 }, // escalón 3
    { date: '2026-11-15', km: 12 }, // escalón 4
    { date: '2026-11-22', km: 15 }, // escalón 5
  ];
  const r = evolve(st(3, '2026-11-02'), walks, '2026-11-22');
  assert.equal(r.state.step, 6);
  assert.equal(r.events.length, 3);
});

test('tras dos semanas o más sin caminar se retrocede y el reloj vuelve a empezar', () => {
  const r = evolve(st(9, '2026-10-01'), [{ date: '2026-10-20', km: 6 }], '2026-11-12');
  // 23 días sin caminar = 3 semanas → retrocede 2 escalones
  assert.deepEqual(r.state, { step: 7, since: '2026-11-12', completed: false });
  assert.deepEqual(r.events, [{ type: 'retroceso', from: 9, to: 7 }]);
  // Al volver a calcular el mismo día no vuelve a retroceder
  assert.deepEqual(evolve(r.state, [{ date: '2026-10-20', km: 6 }], '2026-11-12').events, []);
});

test('caminar los 50 km completa el reto', () => {
  const r = evolve(st(LAST_STEP, '2026-11-09'), [{ date: '2026-11-14', km: 50 }], '2026-11-14');
  assert.equal(r.state.completed, true);
  assert.deepEqual(r.events, [{ type: 'reto' }]);
  assert.deepEqual(evolve(r.state, [], '2027-03-01').events, []);
});

test('caminatas del escalón: cada una se cumple con una caminata distinta', () => {
  const s = stepAt(11); // doble: suave 6, cuestas 8, víspera 10, larga 22
  const walks = [
    { date: '2026-11-10', km: 6, kind: 'suave' as const },
    { date: '2026-11-14', km: 10, kind: 'extra' as const },
    { date: '2026-11-15', km: 22, kind: 'larga' as const },
  ];
  const p = plannedWalks(s, walks);
  assert.deepEqual(p.map((x) => [x.kind, x.km, x.done?.date ?? null]), [
    ['suave', 6, '2026-11-10'],
    ['cuestas', 8, null],
    ['extra', 10, '2026-11-14'],
    ['larga', 22, '2026-11-15'],
  ]);
  // Una caminata libre suficiente también vale para una corta, pero la larga no se reutiliza
  const p2 = plannedWalks(stepAt(5), [{ date: '2026-11-10', km: 15, kind: 'libre' }]);
  assert.deepEqual(p2.map((x) => !!x.done), [false, false, true]);
});

test('ritmo, duración y series semanales', () => {
  assert.equal(pace({ km: 10, minutes: 115 }), 11.5);
  assert.equal(pace({ km: 0, minutes: 30 }), null);
  assert.equal(formatPace(11.5), '11:30 min/km');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(675), '11 h 15 min');
  const s = weeklySeries([
    { date: '2026-11-10', km: 6 },
    { date: '2026-11-15', km: 15 },
    { date: '2026-11-17', km: 5.5 },
  ]);
  assert.deepEqual(s.total, [
    { date: '2026-11-09', value: 21 },
    { date: '2026-11-16', value: 5.5 },
  ]);
  assert.deepEqual(s.longest.map((p) => p.value), [15, 5.5]);
});

test('forma reciente: tirada más larga de 4 semanas y fin de semana doble', () => {
  const walks = [
    { date: '2026-10-01', km: 40, minutes: 480 }, // hace más de 4 semanas
    { date: '2026-11-07', km: 12, minutes: 140 },
    { date: '2026-11-08', km: 22, minutes: 264 },
  ];
  const f = recentForm(walks, '2026-11-16');
  assert.equal(f.longestKm, 22);
  assert.equal(f.longestPace, 12);
  assert.equal(f.double, true);
  assert.equal(recentForm([{ date: '2026-11-08', km: 22, minutes: 264 }], '2026-11-16').double, false);
});
