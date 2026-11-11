/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, formatLong, weekStart, weekdayIndex } from './dates';
import { EXERCISES } from './exercises';
import { isCompleted, progress, type Prescription, type SlotRules } from './progression';
import { WEEK_PATTERNS, dayStatus, dayTypeFor, weekPlan } from './schedule';
import { estimate1RM, goalProgress, GOALS, nextMilestone } from './strength';
import { TEMPLATES } from './templates';

test('fechas: lunes de la semana y día de la semana', () => {
  // 11/11/2026 es miércoles
  assert.equal(weekdayIndex('2026-11-11'), 2);
  assert.equal(weekStart('2026-11-11'), '2026-11-09');
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // domingo
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30'); // cambio de hora
  assert.equal(formatLong('2026-11-11'), 'Miércoles 11 de noviembre');
});

test('R1: nunca tirón (A) el día después del gimnasio', () => {
  for (const pattern of Object.values(WEEK_PATTERNS)) {
    pattern.forEach((t, i) => {
      if (t === 'gym') assert.notEqual(pattern[(i + 1) % 7], 'A');
    });
  }
});

test('cada semana tiene 2 gimnasios, A/B/C una vez y 2 descansos', () => {
  for (const pattern of Object.values(WEEK_PATTERNS)) {
    const count = (t: string) => pattern.filter((x) => x === t).length;
    assert.equal(count('gym'), 2);
    assert.equal(count('rest'), 2);
    for (const k of ['A', 'B', 'C']) assert.equal(count(k), 1);
    assert.equal(pattern[0], 'gym');
  }
});

test('plan semanal según segundo día de gimnasio', () => {
  assert.equal(dayTypeFor('2026-11-11', 'X'), 'gym');
  assert.equal(dayTypeFor('2026-11-11', 'J'), 'A');
  const plan = weekPlan('2026-11-09', 'J');
  assert.equal(plan.length, 7);
  assert.deepEqual(plan[3], { date: '2026-11-12', type: 'gym' });
});

test('R2: día pasado sin registro = fallado; descanso nunca falla', () => {
  assert.equal(dayStatus('A', '2026-11-10', '2026-11-11'), 'missed');
  assert.equal(dayStatus('rest', '2026-11-08', '2026-11-11'), 'rest');
  assert.equal(dayStatus('B', '2026-11-11', '2026-11-11'), 'pending');
  assert.equal(dayStatus('B', '2026-11-12', '2026-11-11'), 'future');
  assert.equal(dayStatus('B', '2026-11-10', '2026-11-11', 'done'), 'done');
});

const rules: SlotRules = { repsMin: 8, repsMax: 12, maxSets: 4, step: 1, allowsTempo: true };
const p = (sets: number, reps: number, tempo: 0 | 1 | 2 = 0): Prescription => ({ sets, reps, tempo });

test('progresión: fácil sube repeticiones', () => {
  assert.deepEqual(progress(p(3, 8), rules, { completed: true, feeling: 'facil' }), {
    next: p(3, 9),
    change: 'reps',
  });
});

test('progresión: dura o incompleta mantiene', () => {
  assert.equal(progress(p(3, 8), rules, { completed: true, feeling: 'dura' }).change, 'none');
  assert.equal(progress(p(3, 8), rules, { completed: false, feeling: 'facil' }).change, 'none');
});

test('progresión: normal en el tope no cambia de peldaño', () => {
  assert.equal(progress(p(3, 12), rules, { completed: true, feeling: 'normal' }).change, 'none');
  assert.equal(progress(p(3, 10), rules, { completed: true, feeling: 'normal' }).change, 'reps');
});

test('progresión: escalera completa tempo → pausa → serie → variante', () => {
  const easy = { completed: true, feeling: 'facil' as const };
  let r = progress(p(3, 12), rules, easy);
  assert.deepEqual(r, { next: p(3, 8, 1), change: 'tempo' });
  r = progress(p(3, 12, 1), rules, easy);
  assert.deepEqual(r, { next: p(3, 8, 2), change: 'tempo' });
  r = progress(p(3, 12, 2), rules, easy);
  assert.deepEqual(r, { next: p(4, 8, 2), change: 'sets' });
  r = progress(p(4, 12, 2), rules, easy);
  assert.equal(r.change, 'variante');
});

test('progresión: sin tempo pasa directamente a más series; por tiempo sube de 5 en 5', () => {
  const noTempo = { ...rules, allowsTempo: false };
  assert.equal(progress(p(3, 12), noTempo, { completed: true, feeling: 'facil' }).change, 'sets');
  const time: SlotRules = { repsMin: 30, repsMax: 60, maxSets: 3, step: 5, allowsTempo: false };
  assert.equal(progress(p(2, 58), time, { completed: true, feeling: 'facil' }).next.reps, 60);
});

test('sesión completada solo si todas las series llegan al objetivo', () => {
  assert.equal(isCompleted(p(3, 8), [8, 9, 8]), true);
  assert.equal(isCompleted(p(3, 8), [8, 7, 8]), false);
  assert.equal(isCompleted(p(3, 8), [8, 8]), false);
});

test('plantillas: todos los ejercicios existen y los rangos son válidos', () => {
  for (const slots of Object.values(TEMPLATES)) {
    for (const s of slots) {
      assert.ok(EXERCISES[s.exerciseId], s.exerciseId);
      assert.ok(s.repsMin <= s.repsMax, s.key);
      assert.ok(s.initialSets <= s.maxSets, s.key);
    }
  }
});

test('fuerza: 1RM estimado y objetivos', () => {
  assert.equal(estimate1RM(50, 1), 50);
  assert.equal(estimate1RM(50, 5), 58.5);
  const banca = GOALS.find((g) => g.id === 'banca')!;
  assert.equal(goalProgress(banca, 65), 0.5);
  assert.equal(nextMilestone(banca, 62), 70);
  assert.equal(nextMilestone(banca, 80), null);
});
