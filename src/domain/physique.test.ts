/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BodyEntry, Profile } from './body';
import { howAmIDoing, monthlyCheck } from './physique';

const profile: Profile = { heightCm: 178, birthDate: '1988-05-01', sex: 'H', activity: 1.5 };
const by = (list: ReturnType<typeof howAmIDoing>) => Object.fromEntries(list.map((c) => [c.id, c]));

test('sin datos, cada objetivo dice qué falta', () => {
  const c = by(howAmIDoing(null, []));
  assert.deepEqual(Object.values(c).map((x) => x.verdict), ['sin_datos', 'sin_datos', 'sin_datos', 'sin_datos']);
  assert.match(c.cintura.advice, /perfil/);
  assert.match(by(howAmIDoing(profile, [])).cintura.advice, /cinta/);
});

test('cintura respecto a la altura: zonas y centímetros que sobran', () => {
  const at = (waist: number) => by(howAmIDoing(profile, [{ date: '2026-11-01', weight: 80, waist }])).cintura;
  assert.equal(at(86).verdict, 'bien'); // 0,48
  const mid = at(94); // 0,53
  assert.equal(mid.verdict, 'atencion');
  assert.equal(mid.value, '0,53');
  assert.match(mid.advice, /88,9 cm/); // justo por debajo de 0,5 × 178
  assert.match(mid.advice, /5,1 cm/);
  assert.equal(at(110).verdict, 'mal'); // 0,62
});

test('ritmo de peso: ideal, demasiado rápido, estable y subiendo', () => {
  const weekly = (step: number): BodyEntry[] => [0, 1, 2, 3, 4, 5].map((i) => ({ date: `2026-10-${String(1 + i * 7).padStart(2, '0')}`, weight: 85 + step * i }));
  const peso = (step: number) => by(howAmIDoing(profile, weekly(step))).peso;
  assert.equal(peso(0).verdict, 'neutro');
  assert.equal(peso(-0.9).verdict, 'bien');
  assert.match(peso(-0.9).value!, /^−0,\d\d kg por semana$/);
  assert.equal(peso(-2.5).verdict, 'mal');
  assert.equal(peso(0.8).verdict, 'atencion');
  // Con una sola semana aún no hay ritmo.
  assert.equal(by(howAmIDoing(profile, weekly(-1).slice(0, 2))).peso.verdict, 'sin_datos');
});

test('brazo y pecho: se compara con la medida de hace al menos cuatro semanas', () => {
  const e = (date: string, arm?: number, chest?: number): BodyEntry => ({ date, weight: 80, arm, chest });
  // Solo una medida, o dos demasiado juntas: aún no se sabe.
  assert.equal(by(howAmIDoing(profile, [e('2026-11-01', 36)])).brazo.verdict, 'sin_datos');
  assert.equal(by(howAmIDoing(profile, [e('2026-11-01', 36), e('2026-11-10', 37)])).brazo.verdict, 'sin_datos');
  const c = by(howAmIDoing(profile, [e('2026-09-01', 35.5, 100), e('2026-10-01', 36, 100.2), e('2026-11-05', 36.7, 100.3)]));
  assert.equal(c.brazo.verdict, 'bien');
  assert.equal(c.brazo.value, '+0,7 cm en 5 semanas');
  assert.equal(c.pecho.verdict, 'neutro'); // +0,1: dentro del error de la cinta
  const down = by(howAmIDoing(profile, [e('2026-10-01', 37), e('2026-11-05', 36.2)])).brazo;
  assert.equal(down.verdict, 'atencion');
  assert.match(down.value!, /^−0,8 cm/);
});

test('revisión mensual de cinta y fotos', () => {
  const today = '2026-11-20';
  assert.deepEqual(monthlyCheck([], [], today), { due: true, detail: 'Aún no tienes cinta y fotos: hazlo hoy para tener el punto de partida.' });
  const tape: BodyEntry[] = [{ date: '2026-11-10', weight: 80, waist: 90 }];
  assert.equal(monthlyCheck(tape, ['2026-11-12'], today).due, false);
  // Una pesada sin cinta no cuenta como revisión.
  assert.match(monthlyCheck([{ date: '2026-11-18', weight: 80 }, { date: '2026-10-01', weight: 81, arm: 36 }], ['2026-11-12'], today).detail, /con cinta\./);
  assert.match(monthlyCheck(tape, ['2026-10-01'], today).detail, /con fotos\./);
  assert.match(monthlyCheck(tape, [], today).detail, /Aún no tienes fotos/);
});
