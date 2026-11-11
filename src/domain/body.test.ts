/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  INDICATORS,
  ageOn,
  bmi,
  bmrMifflin,
  formatValue,
  navyBodyFat,
  rangeFor,
  targets,
  weeklyChangePct,
  type Profile,
} from './body';

const profile: Profile = { heightCm: 180, birthDate: '1996-05-20', sex: 'H', activity: 1.55 };
const ind = (id: string) => INDICATORS.find((i) => i.id === id)!;
const close = (a: number, b: number, tol = 0.1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('IMC y su rango', () => {
  close(bmi(81, 180), 25.0);
  assert.equal(rangeFor(ind('imc'), profile, 24.9)!.label, 'Normal');
  assert.equal(rangeFor(ind('imc'), profile, 25)!.label, 'Sobrepeso');
});

test('edad cumplida', () => {
  assert.equal(ageOn('1996-05-20', '2026-05-19'), 29);
  assert.equal(ageOn('1996-05-20', '2026-05-20'), 30);
});

test('% grasa Marina (hombre y mujer)', () => {
  close(navyBodyFat('H', 180, 90, 38)!, 19.8);
  assert.equal(navyBodyFat('H', 180, 38, 40), null);
  assert.equal(navyBodyFat('M', 165, 75, 33), null); // falta cadera
  close(navyBodyFat('M', 165, 75, 33, 100)!, 30.0, 1);
});

test('metabolismo basal Mifflin-St Jeor', () => {
  assert.equal(bmrMifflin(80, 180, 30, 'H'), 1780);
  assert.equal(bmrMifflin(80, 180, 30, 'M'), 1614);
});

test('indicadores con datos incompletos devuelven null', () => {
  const e = { date: '2026-11-11', weight: 80 };
  assert.equal(ind('grasa').compute(e, profile, []), null);
  assert.equal(ind('ffmi').compute(e, profile, []), null);
  assert.equal(ind('ica').compute(e, profile, []), null);
  assert.ok(ind('imc').compute(e, profile, []) !== null);
});

test('la báscula tiene prioridad sobre la fórmula', () => {
  const e = { date: '2026-11-11', weight: 80, waist: 90, neck: 38, bodyFat: 15 };
  assert.equal(ind('grasa').compute(e, profile, []), 15);
  close(ind('magra').compute(e, profile, [])!, 68);
});

test('FFMI normalizado', () => {
  const e = { date: '2026-11-11', weight: 80, bodyFat: 15 };
  close(ind('ffmi').compute(e, profile, [])!, 68 / 3.24, 0.01);
});

test('ritmo semanal usa la medición de ~7 días antes', () => {
  const hist = [
    { date: '2026-11-01', weight: 81 },
    { date: '2026-11-04', weight: 80.5 },
    { date: '2026-11-09', weight: 80.2 },
  ];
  const e = { date: '2026-11-11', weight: 80 };
  close(weeklyChangePct(e, hist)!, -0.62, 0.01);
  assert.equal(rangeFor(ind('ritmo'), profile, -0.62)!.label, 'Ideal para perder grasa');
  assert.equal(weeklyChangePct(e, [{ date: '2026-11-09', weight: 80.2 }]), null);
  assert.equal(formatValue(ind('ritmo'), 0.3), '+0,30%');
});

test('objetivos de calorías y proteína', () => {
  const t = targets({ date: '2026-11-11', weight: 80 }, profile);
  assert.equal(t.proteinMin, 128);
  assert.equal(t.proteinMax, 176);
  assert.ok(t.kcalMin < t.kcalMax);
});
