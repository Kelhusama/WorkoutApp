/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ILLUSTRATIONS } from '../illustrations/library';
import { addDays } from './dates';
import {
  BLOCK_PASS,
  BLOCK_PLANNED,
  FLEX_BY_ID,
  FLEX_EXERCISES,
  FLEX_LEVELS,
  FLEX_TESTS,
  FLEX_TEST_BY_ID,
  METHOD_LABEL,
  anyTestDue,
  changeText,
  doseText,
  exceedsError,
  exerciseAt,
  exerciseSteps,
  flexProgress,
  formatFlexValue,
  isFlexTestId,
  milestones,
  sessionExercises,
  sessionMinutes,
  sessionSteps,
  testDue,
  testSeries,
  testSummary,
  validateFlexValue,
  weekAdherence,
  type FlexResult,
} from './flexibility';

const r = (date: string, testId: string, value: number): FlexResult => ({ date, testId, value });
/** `n` días seguidos desde `from`. */
const days = (from: string, n: number, step = 1) => Array.from({ length: n }, (_, i) => addDays(from, i * step));

test('el programa tiene 10 ejercicios con 3 niveles, indicaciones y dibujos que existen', () => {
  assert.equal(FLEX_EXERCISES.length, 10);
  assert.deepEqual(FLEX_EXERCISES.map((e) => e.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(FLEX_EXERCISES.map((e) => e.id)).size, 10);
  for (const e of FLEX_EXERCISES) {
    assert.ok(e.cues.length >= 2 && e.cues.length <= 3, e.id);
    assert.ok(e.mistake.length > 0, e.id);
    for (const level of FLEX_LEVELS) {
      const { name, figure, dose } = exerciseAt(e, level);
      assert.ok(name.length > 0);
      assert.ok(METHOD_LABEL[dose.method], `${e.id} nivel ${level}`);
      assert.ok(dose.sets >= 2 && dose.sets <= 3, `${e.id} nivel ${level}`);
      assert.ok((dose.reps ?? 0) > 0 || (dose.hold ?? 0) > 0, `${e.id} nivel ${level}: sin dosis`);
      if (dose.method === 'contraer-relajar') assert.equal(dose.contract, 6);
      if (figure) assert.ok(ILLUSTRATIONS[figure], `${e.id}: falta el dibujo ${figure}`);
    }
  }
});

test('las dosis siguen la tabla de la investigación', () => {
  const text = (id: string, level: 1 | 2 | 3) => doseText(FLEX_BY_ID[id].levels[level]);
  assert.equal(text('rana_mariposa', 1), '2 × 30 s');
  assert.match(text('rana_mariposa', 2), /^2 ciclos de 6 s de contracción \+ 45 s/);
  assert.match(text('rana_mariposa', 3), /^3 × 60 s/);
  assert.equal(text('cosaca', 1), '2 × 6 por lado, con apoyo de las manos');
  assert.equal(text('isquios_tumbado', 1), '2 × 30 s por lado');
  assert.match(text('isquios_tumbado', 3), /^3 ciclos de 6 s de contracción \+ 30 s por lado/);
  assert.equal(text('buenos_dias', 2), '2 × 10, bajada de 5 s');
  assert.equal(text('zancada_baja', 3).startsWith('2 × 60 s por lado'), true);
  assert.equal(text('sentadilla_profunda', 1), '3 × 20 s, agarrado a algo firme');
  assert.equal(text('rodilla_pared', 2), '2 × 10 + 20 s por lado, mantén la última');
  assert.equal(text('deslizamientos_pared', 1), '2 × 8');
  assert.equal(text('durmiente', 2), '2 × 45 s por lado');
  assert.equal(FLEX_BY_ID.buenos_dias.levels[1].method, 'excentrico');
  assert.equal(FLEX_BY_ID.cosaca.levels[1].method, 'cargado');
});

test('cada sesión lleva los ejercicios 1–5 y rota el resto de forma fija', () => {
  for (const level of FLEX_LEVELS) {
    for (let n = 0; n < 12; n++) {
      const ex = sessionExercises(level, n);
      assert.deepEqual(ex.slice(0, 5).map((e) => e.n), [1, 2, 3, 4, 5]);
      const extra = ex.slice(5);
      assert.ok(extra.length >= 1 && extra.length <= 2);
      assert.ok(extra.every((e) => e.n >= 6));
      assert.equal(new Set(ex.map((e) => e.id)).size, ex.length);
      assert.deepEqual(sessionExercises(level, n), ex);
    }
  }
  assert.deepEqual(sessionExercises(1, 0).slice(5).map((e) => e.n), [6, 7]);
  assert.deepEqual(sessionExercises(1, 1).slice(5).map((e) => e.n), [8, 9]);
  assert.deepEqual(sessionExercises(1, 2).slice(5).map((e) => e.n), [10, 6]);
  // En cinco sesiones seguidas pasan todos los rotatorios, en cualquier nivel.
  for (const level of FLEX_LEVELS) {
    const seen = new Set([0, 1, 2, 3, 4].flatMap((n) => sessionExercises(level, n).slice(5).map((e) => e.n)));
    assert.deepEqual([...seen].sort((a, b) => a - b), [6, 7, 8, 9, 10]);
  }
});

test('los pasos desdoblan series y lados, y la sesión dura lo previsto', () => {
  const cosaca = exerciseSteps(FLEX_BY_ID.cosaca, 1);
  assert.equal(cosaca.length, 4);
  assert.deepEqual(cosaca.map((s) => [s.set, s.side]), [[1, 1], [1, 2], [2, 1], [2, 2]]);
  assert.equal(cosaca[0].reps, 6);
  assert.equal(cosaca[0].seconds, 24);
  const pnf = exerciseSteps(FLEX_BY_ID.isquios_tumbado, 2)[0];
  assert.deepEqual([pnf.contract, pnf.hold, pnf.seconds], [6, 30, 36]);
  const mixed = exerciseSteps(FLEX_BY_ID.rodilla_pared, 2)[0];
  assert.deepEqual([mixed.reps, mixed.hold, mixed.seconds], [10, 20, 50]);

  // Minutos estimados con la tabla tal cual: el nivel 1 cabe en 10–15; el 2 y el 3 suman series y salen más largos.
  const limits = { 1: [10, 15], 2: [12, 17], 3: [20, 26] } as const;
  for (const level of FLEX_LEVELS) {
    for (let n = 0; n < 5; n++) {
      const m = sessionMinutes(sessionSteps(sessionExercises(level, n), level));
      assert.ok(m >= limits[level][0] && m <= limits[level][1], `nivel ${level}, sesión ${n}: ${m} min`);
    }
  }
});

test('adherencia semanal: días de lunes a domingo, «X de 3 esta semana»', () => {
  // 2026-11-16 es lunes.
  const dates = ['2026-11-15', '2026-11-16', '2026-11-16', '2026-11-18', '2026-11-23'];
  const a = weekAdherence(dates, '2026-11-19');
  assert.equal(a.done, 2);
  assert.equal(a.label, '2 de 3 esta semana');
  assert.equal(a.met, false);
  assert.equal(weekAdherence([...dates, '2026-11-22'], '2026-11-22').met, true);
  assert.equal(weekAdherence([], '2026-11-19').label, '0 de 3 esta semana');
});

test('bloques: sin sesiones se empieza hoy en el nivel 1', () => {
  assert.equal(BLOCK_PLANNED, 12);
  assert.equal(BLOCK_PASS, 10);
  assert.deepEqual(flexProgress([], null, '2026-11-16'), {
    level: 1,
    blockStart: '2026-11-16',
    sessionsInBlock: 0,
    weekInBlock: 1,
    changed: false,
    lastBlock: null,
  });
});

test('bloques: el primero empieza con la primera sesión y cuenta semanas', () => {
  const p = flexProgress(['2026-11-02', '2026-11-04', '2026-11-04', '2026-11-12'], null, '2026-11-16');
  assert.equal(p.blockStart, '2026-11-02');
  assert.equal(p.sessionsInBlock, 3);
  assert.equal(p.weekInBlock, 3);
  assert.equal(p.level, 1);
  assert.equal(flexProgress(['2026-11-02'], null, '2026-11-29').weekInBlock, 4);
});

test('bloques: con 10 de 12 sesiones se sube de nivel; con 9 se repite', () => {
  const start = { level: 1 as const, blockStart: '2026-10-05' };
  const ten = days('2026-10-05', 10, 2); // hasta el 23 de octubre
  const up = flexProgress(ten, start, '2026-11-02');
  assert.equal(up.level, 2);
  assert.equal(up.changed, true);
  assert.equal(up.blockStart, '2026-11-02');
  assert.equal(up.sessionsInBlock, 0);
  assert.equal(up.weekInBlock, 1);
  assert.deepEqual(up.lastBlock, { sessions: 10, passed: true });

  const same = flexProgress(ten.slice(0, 9), start, '2026-11-02');
  assert.equal(same.level, 1);
  assert.equal(same.changed, false);
  assert.equal(same.blockStart, '2026-11-02');
  assert.deepEqual(same.lastBlock, { sessions: 9, passed: false });

  // El último día del bloque aún no se cierra.
  assert.equal(flexProgress(ten, start, '2026-11-01').level, 1);
  assert.equal(flexProgress(ten, start, '2026-11-01').weekInBlock, 4);
});

test('bloques: varios seguidos, tope en el nivel 3 y parones sin castigo', () => {
  const b1 = days('2026-01-05', 10, 2);
  const b2 = days('2026-02-02', 12, 2);
  const b3 = days('2026-03-02', 12, 2);
  const p = flexProgress([...b1, ...b2, ...b3], null, '2026-03-30');
  assert.equal(p.level, 3);
  assert.equal(p.blockStart, '2026-03-30');
  assert.equal(p.changed, true);

  // Con el nivel ya guardado, no vuelve a marcar el cambio ni pasa de 3.
  const kept = flexProgress([...b1, ...b2, ...b3], { level: 3, blockStart: '2026-03-02' }, '2026-03-30');
  assert.equal(kept.level, 3);
  assert.equal(kept.changed, false);

  // Tres meses parado: mantiene el nivel y el bloque empieza el día en que vuelve.
  const back = flexProgress([...b1, '2026-06-10', '2026-06-12'], null, '2026-06-12');
  assert.equal(back.level, 2);
  assert.equal(back.blockStart, '2026-06-10');
  assert.equal(back.sessionsInBlock, 2);
  assert.equal(back.weekInBlock, 1);
  // Y si aún no ha vuelto, empieza hoy.
  assert.equal(flexProgress(b1, null, '2026-06-12').blockStart, '2026-06-12');
});

test('hay seis tests con protocolo, unidad, sentido y umbral de cambio real', () => {
  assert.deepEqual(FLEX_TESTS.map((t) => t.id), ['dedos_suelo', 'rodilla_pared', 'apertura', 'rascado', 'pierna_recta', 'sentadilla']);
  for (const t of FLEX_TESTS) {
    assert.ok(t.steps.length >= 3, t.id);
    assert.ok(t.name && t.measures && t.reference, t.id);
    assert.ok(['cm', '°', 's'].includes(t.unit), t.id);
    assert.ok(t.min < t.max, t.id);
    assert.equal(!!t.sign, t.min < 0, t.id);
  }
  assert.equal(FLEX_TEST_BY_ID.dedos_suelo.higherIsBetter, false);
  assert.equal(FLEX_TESTS.filter((t) => t.higherIsBetter).length, 5);
  assert.equal(FLEX_TEST_BY_ID.dedos_suelo.realChange, 4.5);
  assert.equal(FLEX_TEST_BY_ID.rodilla_pared.realChange, 2);
  assert.equal(FLEX_TEST_BY_ID.apertura.realChange, undefined);
  assert.equal(FLEX_TEST_BY_ID.pierna_recta.unit, '°');
  assert.equal(FLEX_TEST_BY_ID.sentadilla.unit, 's');
  assert.equal(isFlexTestId('rascado'), true);
  assert.equal(isFlexTestId('otro'), false);
  assert.equal(isFlexTestId(undefined), false);
});

test('formato y validación de valores', () => {
  const toe = FLEX_TEST_BY_ID.dedos_suelo;
  assert.equal(formatFlexValue(toe, 12.5), '12,5 cm');
  assert.equal(formatFlexValue(toe, -3), '−3 cm');
  assert.equal(formatFlexValue(FLEX_TEST_BY_ID.pierna_recta, 75), '75°');
  assert.equal(formatFlexValue(FLEX_TEST_BY_ID.sentadilla, 90, true), '+90 s');
  assert.equal(validateFlexValue(toe, 12), null);
  assert.equal(validateFlexValue(toe, 0), null);
  assert.match(validateFlexValue(toe, null)!, /Escribe/);
  assert.match(validateFlexValue(toe, 300)!, /entre −30 cm y 70 cm/);
  assert.match(validateFlexValue(FLEX_TEST_BY_ID.sentadilla, -1)!, /entre 0 s y 600 s/);
});

test('series, último, mejor y cambio desde el primero', () => {
  const toe = FLEX_TEST_BY_ID.dedos_suelo;
  const results = [
    r('2026-10-01', 'dedos_suelo', 12),
    r('2026-09-01', 'dedos_suelo', 15),
    r('2026-09-01', 'dedos_suelo', 14), // mismo día: cuenta el mejor (menor)
    r('2026-11-01', 'dedos_suelo', 9),
    r('2026-11-01', 'rodilla_pared', 8),
  ];
  assert.deepEqual(testSeries(results, toe), [
    { date: '2026-09-01', value: 14 },
    { date: '2026-10-01', value: 12 },
    { date: '2026-11-01', value: 9 },
  ]);
  const s = testSummary(results, toe, '2026-11-16');
  assert.equal(s.latest!.value, 9);
  assert.equal(s.first!.value, 14);
  assert.equal(s.best, 9);
  assert.equal(s.change, -5);
  assert.equal(s.improvement, 5);
  assert.equal(s.real, true);
  assert.equal(s.due, false);
  assert.equal(changeText(s), 'Mejoras 5 cm desde el primer test. Es un cambio real.');

  const one = testSummary(results, FLEX_TEST_BY_ID.rodilla_pared, '2026-11-16');
  assert.equal(one.change, null);
  assert.equal(one.real, null);
  assert.equal(changeText(one), null);

  const none = testSummary(results, FLEX_TEST_BY_ID.apertura, '2026-11-16');
  assert.deepEqual([none.latest, none.best, none.change, none.due], [null, null, null, true]);
});

test('el cambio se compara con el error de medida cuando hay umbral', () => {
  const toe = FLEX_TEST_BY_ID.dedos_suelo;
  const ankle = FLEX_TEST_BY_ID.rodilla_pared;
  assert.equal(exceedsError(toe, -4.5), true);
  assert.equal(exceedsError(toe, 4.4), false);
  assert.equal(exceedsError(ankle, 2), true);
  assert.equal(exceedsError(ankle, 1.9), false);
  assert.equal(exceedsError(FLEX_TEST_BY_ID.apertura, 30), null);

  const small = testSummary([r('2026-10-01', 'rodilla_pared', 8), r('2026-11-01', 'rodilla_pared', 9)], ankle, '2026-11-02');
  assert.equal(changeText(small), 'Mejoras 1 cm desde el primer test. Aún dentro del error de medida.');
  const worse = testSummary([r('2026-10-01', 'apertura', 120), r('2026-11-01', 'apertura', 116)], FLEX_TEST_BY_ID.apertura, '2026-11-02');
  assert.equal(worse.improvement, -4);
  assert.equal(changeText(worse), '4 cm peor que en el primer test.');
  const equal = testSummary([r('2026-10-01', 'apertura', 120), r('2026-11-01', 'apertura', 120)], FLEX_TEST_BY_ID.apertura, '2026-11-02');
  assert.equal(changeText(equal), 'Igual que en el primer test.');
});

test('el test toca si nunca se hizo o han pasado más de 28 días', () => {
  const t = FLEX_TEST_BY_ID.sentadilla;
  assert.equal(testDue([], '2026-11-16'), true);
  const series = testSeries([r('2026-10-19', 'sentadilla', 60)], t);
  assert.equal(testDue(series, '2026-11-16'), false); // 28 días justos
  assert.equal(testDue(series, '2026-11-17'), true);
  assert.equal(anyTestDue([], '2026-11-16'), true);
  const all = FLEX_TESTS.map((x) => r('2026-11-10', x.id, x.id === 'apertura' ? 100 : 10));
  assert.equal(anyTestDue(all, '2026-11-16'), false);
  assert.equal(anyTestDue(all, '2026-12-09'), true);
});

test('hitos: palmas, sentadilla 2 min, dedos tras la espalda y apertura +20 cm', () => {
  const empty = milestones([]);
  assert.deepEqual(empty.map((m) => m.id), ['palmas', 'sentadilla', 'dedos_espalda', 'apertura']);
  assert.ok(empty.every((m) => !m.reached && m.detail === 'Haz el test para saberlo.'));

  const partial = milestones([
    r('2026-09-01', 'dedos_suelo', 6),
    r('2026-09-01', 'sentadilla', 119),
    r('2026-09-01', 'rascado', -4),
    r('2026-09-01', 'apertura', 110),
    r('2026-10-01', 'apertura', 129),
  ]);
  assert.ok(partial.every((m) => !m.reached));
  assert.equal(partial[0].detail, 'Te faltan 6 cm.');
  assert.equal(partial[1].detail, 'Tu mejor marca: 119 s de 120 s.');
  assert.equal(partial[2].detail, 'Te faltan 4 cm.');
  assert.equal(partial[3].detail, 'Llevas +19 cm desde el primer test.');

  const done = milestones([
    r('2026-09-01', 'dedos_suelo', 6),
    r('2026-10-01', 'dedos_suelo', 0),
    r('2026-11-01', 'dedos_suelo', 2), // un hito conseguido no se pierde
    r('2026-09-01', 'sentadilla', 120),
    r('2026-09-01', 'rascado', 0),
    r('2026-09-01', 'apertura', 110),
    r('2026-10-01', 'apertura', 130),
  ]);
  assert.ok(done.every((m) => m.reached && m.detail === 'Conseguido.'));
});
