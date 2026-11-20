/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, formatLong, weekStart, weekdayIndex } from './dates';
import { EXERCISES } from './exercises';
import { isCompleted, progress, type Prescription, type SlotRules } from './progression';
import { DEFAULT_TEMPLATE, assignKinds, dayStatus, isValidTemplate, parseTemplate, type Role } from './schedule';
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

test('semana por defecto: lunes y jueves de gimnasio', () => {
  assert.deepEqual(assignKinds(DEFAULT_TEMPLATE), ['gym', 'B', 'A', 'gym', 'C', 'rest', 'rest']);
});

test('gimnasio lunes y miércoles reparte igual que antes', () => {
  const t: Role[] = ['gym', 'casa', 'gym', 'casa', 'casa', 'rest', 'rest'];
  assert.deepEqual(assignKinds(t), ['gym', 'B', 'gym', 'C', 'A', 'rest', 'rest']);
});

test('R1 en cualquier semana: nunca tirón (A) el día después del gimnasio', () => {
  const roles: Role[] = ['gym', 'casa', 'rest'];
  // Todas las combinaciones posibles de 7 días
  for (let n = 0; n < 3 ** 7; n++) {
    const t: Role[] = [];
    for (let i = 0, x = n; i < 7; i++, x = Math.floor(x / 3)) t.push(roles[x % 3]);
    for (const prev of roles) {
      const k = assignKinds(t, prev);
      k.forEach((type, i) => {
        const before = i === 0 ? prev : t[i - 1];
        if (before === 'gym') assert.notEqual(type, 'A', `${t.join(',')} prev=${prev}`);
      });
    }
  }
});

test('con 3 días de casa salen A, B y C una vez', () => {
  const k = assignKinds(['casa', 'rest', 'casa', 'rest', 'casa', 'rest', 'rest']);
  assert.deepEqual([...k.filter((x) => x !== 'rest')].sort(), ['A', 'B', 'C']);
});

test('domingo de gimnasio: el lunes no es tirón', () => {
  const k = assignKinds(['casa', 'casa', 'rest', 'casa', 'rest', 'rest', 'gym'], 'gym');
  assert.notEqual(k[0], 'A');
});

test('los días ya registrados mantienen su sesión', () => {
  // El martes se hizo A; aunque ahora el lunes sea gimnasio, el martes sigue siendo A y el resto se reparte sin repetir
  const k = assignKinds(['gym', 'casa', 'casa', 'gym', 'casa', 'rest', 'rest'], 'rest', [null, 'A', null, null, null, null, null]);
  assert.equal(k[1], 'A');
  assert.deepEqual([k[2], k[4]].sort(), ['B', 'C']);
});

test('semana tipo: validación y lectura', () => {
  assert.equal(isValidTemplate(DEFAULT_TEMPLATE), true);
  assert.equal(isValidTemplate(['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest']), false);
  assert.equal(isValidTemplate(['gym', 'gym', 'gym', 'gym', 'gym', 'rest', 'rest']), false);
  assert.deepEqual(parseTemplate('gym,casa,gym,casa,casa,rest,rest')[2], 'gym');
  assert.deepEqual(parseTemplate('basura'), DEFAULT_TEMPLATE);
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
  const r = progress(p(3, 8), rules, { completed: true, feeling: 'facil' });
  assert.deepEqual(r.next, p(3, 9));
  assert.equal(r.change, 'reps');
  assert.ok(r.reason.length > 10);
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
  assert.deepEqual([r.next, r.change], [p(3, 8, 1), 'tempo']);
  r = progress(p(3, 12, 1), rules, easy);
  assert.deepEqual([r.next, r.change], [p(3, 8, 2), 'tempo']);
  r = progress(p(3, 12, 2), rules, easy);
  assert.deepEqual([r.next, r.change], [p(4, 8, 2), 'sets']);
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

test('progresión con la reserva apuntada: manda sobre la sensación de la sesión', () => {
  const done = { completed: true, feeling: 'dura' as const };
  // Al límite se repite, aunque la sesión fuese fácil.
  assert.equal(progress(p(3, 8), rules, { completed: true, feeling: 'facil', reserve: 0 }).change, 'none');
  // Con una o dos de margen, una más; con tres o más, dos de golpe (sin pasarse del tope).
  assert.deepEqual(progress(p(3, 8), rules, { ...done, reserve: 1 }).next, p(3, 9));
  assert.deepEqual(progress(p(3, 8), rules, { ...done, reserve: 2 }).next, p(3, 10));
  assert.deepEqual(progress(p(3, 11), rules, { ...done, reserve: 2 }).next, p(3, 12));
  // En el tope basta con que quede margen para subir de peldaño.
  assert.equal(progress(p(3, 12), rules, { completed: true, feeling: 'normal', reserve: 1 }).change, 'tempo');
});

test('progresión: dos sesiones seguidas sin completarlo bajan un peldaño', () => {
  const miss = { completed: false, feeling: 'normal' as const };
  assert.equal(progress(p(3, 10), rules, { ...miss, misses: 1 }).change, 'none');
  const down = progress(p(3, 10), rules, { ...miss, misses: 2 });
  assert.deepEqual([down.next, down.change], [p(3, 9), 'baja']);
  // En el suelo del rango con tempo, se quita el tempo; sin nada que quitar, se repite.
  assert.deepEqual(progress(p(3, 8, 1), rules, { ...miss, misses: 2 }).next, p(3, 12, 0));
  assert.equal(progress(p(3, 8), rules, { ...miss, misses: 3 }).change, 'none');
});

test('progresión: una sesión ligera no mueve el plan', () => {
  const r = progress(p(3, 8), rules, { completed: true, feeling: 'facil', reserve: 2, light: true });
  assert.equal(r.change, 'none');
  assert.match(r.reason, /ligera/);
});
