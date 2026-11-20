/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GOAL_KM,
  LAST_STEP,
  MARCH_PLAN,
  entryStep,
  increaseTooFast,
  nextStep,
  predictedMinutes,
  readiness,
  stepAfterBreak,
  stepAt,
  walkDays,
  weeklyKm,
  weeksLeft,
} from './marchPlan';
import { DEFAULT_TEMPLATE } from './schedule';

test('el plan es coherente: termina en 50 km y la tirada más larga previa es de 35–40', () => {
  assert.equal(MARCH_PLAN[LAST_STEP - 1].long, GOAL_KM);
  assert.deepEqual(MARCH_PLAN.map((s) => s.n), MARCH_PLAN.map((_, i) => i + 1));
  const longest = Math.max(...MARCH_PLAN.slice(0, -1).map((s) => s.long));
  assert.ok(longest >= 35 && longest <= 40);
  // El ensayo general queda tres semanas antes del reto
  assert.equal(MARCH_PLAN.find((s) => s.kind === 'ensayo')!.n, LAST_STEP - 3);
});

test('la carga sube poco a poco y hay descarga al menos cada 4 escalones', () => {
  let sinceRest = 0;
  for (let i = 1; i < MARCH_PLAN.length - 1; i++) {
    const [prev, cur] = [MARCH_PLAN[i - 1], MARCH_PLAN[i]];
    if (cur.kind === 'descarga' || cur.kind === 'reduccion') {
      sinceRest = 0;
      assert.ok(weeklyKm(cur) < weeklyKm(prev), `escalón ${cur.n} debería bajar`);
      continue;
    }
    sinceRest++;
    assert.ok(sinceRest <= 4, `demasiados escalones de carga seguidos en el ${cur.n}`);
    // Ninguna tirada larga crece más de 8 km respecto a la mayor hecha hasta entonces
    const maxBefore = Math.max(...MARCH_PLAN.slice(0, i).map((s) => s.long));
    assert.ok(cur.long - maxBefore <= 8, `salto grande en el escalón ${cur.n}`);
  }
});

test('las tiradas dobles solo aparecen en los fines de semana dobles y en la reducción', () => {
  for (const s of MARCH_PLAN) {
    if (s.extra > 0) assert.ok(s.kind === 'doble' || s.kind === 'reduccion', `escalón ${s.n}`);
  }
  assert.equal(MARCH_PLAN.filter((s) => s.kind === 'doble').length, 2);
});

test('escalón de entrada según lo que ya caminas', () => {
  assert.equal(entryStep(0), 1);
  assert.equal(entryStep(6), 2);
  assert.equal(entryStep(10), 4); // ya haces 10 km: empiezas en la tirada de 12
  assert.equal(entryStep(15), 7); // se salta la descarga y entra en la de 18
  assert.equal(entryStep(40), 7); // aunque camines mucho, no se entra más allá
});

test('semanas que quedan, preparación y tiempo previsto', () => {
  assert.equal(weeksLeft(1), 18);
  assert.equal(weeksLeft(LAST_STEP), 1);
  assert.equal(readiness(36, true), 'verde');
  assert.equal(readiness(36, false), 'ambar');
  assert.equal(readiness(30, true), 'ambar');
  assert.equal(readiness(20, true), 'rojo');
  // 50 km a 11:30 min/km con 60 min de paradas: unas 11 h 15 min
  assert.equal(predictedMinutes(50, 11.5), 675);
  assert.equal(predictedMinutes(50, 11.5, 60, 500), 725);
});

test('aviso si los kilómetros semanales suben demasiado deprisa', () => {
  assert.equal(increaseTooFast(30, 35), false);
  assert.equal(increaseTooFast(30, 45), true);
  assert.equal(increaseTooFast(0, 12), false); // al empezar no hay referencia
});

test('reparto de caminatas en la semana tipo', () => {
  // Por defecto: gimnasio L y J, casa M, X y V, descanso S y D
  const d = walkDays(DEFAULT_TEMPLATE);
  assert.equal(d.long, 6); // domingo
  assert.equal(d.extra, 5); // sábado, solo en fines de semana dobles
  assert.equal(d.easy, 1); // martes
  assert.equal(d.hills, 4); // viernes: día de casa, separado del otro paseo
  // Sin días de descanso, la larga cae en domingo igualmente
  assert.equal(walkDays(['gym', 'casa', 'casa', 'gym', 'casa', 'casa', 'casa']).long, 6);
});
