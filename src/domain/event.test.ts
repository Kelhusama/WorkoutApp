/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays } from './dates';
import {
  EVENT_DATE,
  LIFT_INFO,
  buildPlan,
  currentLevel,
  doneThisWeek,
  doseText,
  estimate3RM,
  prescription,
  todayPlan,
  weeksLeftOn,
  type TrialLog,
} from './event';

const log = (date: string, lift: TrialLog['lift'], weight: number, reps: number, reserve: TrialLog['reserve'] = 1, sets = 3): TrialLog => ({ date, lift, weight, reps, sets, reserve });

test('el plan cubre las ocho semanas anteriores a la prueba, sin huecos', () => {
  const plan = buildPlan();
  assert.equal(plan.length, 8);
  assert.deepEqual([plan[0].from, plan[0].to], ['2026-11-21', '2026-11-27']);
  assert.deepEqual([plan[7].from, plan[7].to], ['2027-01-09', '2027-01-15']);
  for (let i = 1; i < plan.length; i++) assert.equal(plan[i].from, addDays(plan[i - 1].to, 1));
  assert.deepEqual(plan.map((w) => w.phase), ['base', 'base', 'base', 'fuerza', 'fuerza', 'fuerza', 'pico', 'descarga']);
  // El peso muerto sube poco a poco hasta rozar el objetivo; las dominadas pasan de sueltas a triples con lastre.
  assert.deepEqual(plan.slice(0, 7).map((w) => w.doses.peso_muerto.weight), [80, 85, 87.5, 90, 92.5, 95, 97.5]);
  assert.deepEqual(plan.map((w) => w.doses.dominada.reps), [1, 2, 2, 2, 3, 3, 3, 2]);
  assert.deepEqual(plan.map((w) => w.doses.dominada.weight), [0, 0, 0, 2, 2, 4, 6, 4]);
  // La descarga pide menos que la semana anterior.
  assert.ok(plan[7].doses.dominada.days * plan[7].doses.dominada.sets < plan[6].doses.dominada.days * plan[6].doses.dominada.sets);
});

test('qué semana toca según la fecha', () => {
  assert.equal(weeksLeftOn('2026-11-21'), 8);
  assert.equal(weeksLeftOn('2027-01-15'), 1);
  // El 20 de noviembre faltan 57 días: se empieza ya con la primera semana.
  const now = todayPlan('2026-11-20');
  assert.deepEqual([now.daysLeft, now.week!.weeksLeft, now.phase], [57, 8, 'base']);
  assert.equal(todayPlan('2026-12-15').week!.weeksLeft, 5);
  assert.equal(todayPlan('2027-01-10').phase, 'descarga');
  assert.deepEqual([todayPlan(EVENT_DATE).phase, todayPlan(EVENT_DATE).week], ['dia', null]);
  assert.equal(todayPlan('2027-01-20').phase, 'pasado');
});

test('lo que toca hoy: el plan, corregido por lo último apuntado', () => {
  const plan = buildPlan();
  const [w8, , , w5, , w3, , w1] = plan;
  // Sin nada apuntado, el plan tal cual.
  assert.deepEqual(prescription('dominada', w8, []), w8.doses.dominada);
  // En las semanas sin lastre no se añade aunque sobre.
  assert.equal(prescription('dominada', w8, [log('2026-11-22', 'dominada', 0, 1, 2)]).weight, 0);
  // Semana de 4 kg, pero lo último fueron 2 kg limpios: hoy 4. Si fue justo, se repiten los 2.
  assert.equal(prescription('dominada', w3, [log('2026-12-20', 'dominada', 2, 3, 1)]).weight, 4);
  const stuck = prescription('dominada', w3, [log('2026-12-20', 'dominada', 2, 3, 0)]);
  assert.equal(stuck.weight, 2);
  assert.match(stuck.note, /repite 2 kg/);
  // Nunca se salta: de sin lastre a 2 kg como mucho, aunque el plan diga 4.
  assert.equal(prescription('dominada', w3, [log('2026-12-20', 'dominada', 0, 3, 2)]).weight, 2);
  assert.equal(prescription('dominada', w5, [log('2026-12-10', 'dominada', 0, 2, 0)]).weight, 0);
  // Si va por delante, sigue desde lo que ya ha hecho.
  assert.equal(prescription('dominada', w3, [log('2026-12-20', 'dominada', 6, 3, 1)]).weight, 8);
  // Peso muerto: si la última vez fue al límite con menos peso, se repite.
  assert.equal(prescription('peso_muerto', w5, [log('2026-12-08', 'peso_muerto', 87.5, 3, 0)]).weight, 87.5);
  assert.equal(prescription('peso_muerto', w5, [log('2026-12-08', 'peso_muerto', 87.5, 3, 1)]).weight, 90);
  // En la descarga manda el plan, pase lo que pase.
  assert.deepEqual(prescription('dominada', w1, [log('2027-01-05', 'dominada', 10, 3, 2)]), w1.doses.dominada);
});

test('dónde está hoy cada ejercicio, expresado como en la prueba', () => {
  // Punto de partida: 80 kg × 8 equivalen a unos 92 kg × 3; tres dominadas sin lastre son 0 kg.
  assert.equal(estimate3RM(80, 8), 92);
  assert.equal(currentLevel('peso_muerto', [], '2026-11-20'), 92);
  assert.equal(currentLevel('dominada', [], '2026-11-20'), 0);
  // Cinco dominadas sin lastre con 80 kg de peso equivalen a unos 5 kg de lastre a tres.
  assert.equal(currentLevel('dominada', [log('2026-12-10', 'dominada', 0, 5)], '2026-12-12', 80), 5);
  // Pesar menos ayuda: la misma serie con 76 kg da menos lastre equivalente, pero cada kilo perdido es uno menos que subir.
  assert.equal(currentLevel('dominada', [log('2026-12-10', 'dominada', 4, 3)], '2026-12-12', 76), 4);
  // Solo cuentan las últimas tres semanas; si no hay nada reciente, se vuelve al punto de partida.
  assert.equal(currentLevel('peso_muerto', [log('2026-11-25', 'peso_muerto', 95, 3)], '2026-12-30'), 92);
  assert.equal(currentLevel('peso_muerto', [log('2026-12-20', 'peso_muerto', 95, 3), log('2026-12-27', 'peso_muerto', 90, 3)], '2026-12-30'), 95);
});

test('sesiones de la semana y texto de la dosis', () => {
  const w8 = buildPlan()[0];
  const logs = [log('2026-11-21', 'dominada', 0, 1), log('2026-11-21', 'dominada', 0, 1), log('2026-11-23', 'dominada', 0, 1), log('2026-11-28', 'dominada', 0, 2), log('2026-11-24', 'peso_muerto', 80, 5)];
  assert.equal(doneThisWeek('dominada', w8, logs), 2);
  assert.equal(doneThisWeek('peso_muerto', w8, logs), 1);
  assert.equal(doseText('dominada', w8.doses.dominada), '6 series de 1 repetición, sin lastre');
  assert.equal(doseText('dominada', buildPlan()[5].doses.dominada), '4 series de 3 repeticiones, con 4 kg de lastre');
  assert.equal(doseText('peso_muerto', buildPlan()[4].doses.peso_muerto), '3 series de 3 repeticiones con 92,5 kg');
  assert.match(LIFT_INFO.dominada.rules, /hasta abajo/);
});
