/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { projectGoal, tallyWeeks, trendRatePerWeek, trendWeight, weekFulfilled, weekStreak, weeklyFocus, type WeekReview } from './insights';
import type { DayStatus } from './schedule';

const TODAY = '2026-11-16';

test('proyección: ritmo constante de 1 repetición cada 2 semanas', () => {
  const points = [
    { date: '2026-10-05', value: 4 },
    { date: '2026-10-19', value: 5 },
    { date: '2026-11-02', value: 6 },
    { date: '2026-11-16', value: 7 },
  ];
  const p = projectGoal(points, 10, TODAY);
  assert.equal(p.status, 'en_camino');
  assert.equal(p.perWeek, 0.5);
  assert.equal(p.weeks, 6); // faltan 3 repeticiones a 0,5 por semana
  assert.equal(p.date, '2026-12-28');
});

test('proyección: pocos datos, estancado y conseguido', () => {
  assert.equal(projectGoal([], 10, TODAY).status, 'pocos_datos');
  assert.equal(projectGoal([{ date: '2026-11-10', value: 4 }, { date: '2026-11-16', value: 5 }], 10, TODAY).status, 'pocos_datos');
  // Tres registros pero en menos de dos semanas: aún no se opina
  const close = [
    { date: '2026-11-08', value: 4 },
    { date: '2026-11-12', value: 5 },
    { date: '2026-11-16', value: 6 },
  ];
  assert.equal(projectGoal(close, 10, TODAY).status, 'pocos_datos');
  const flat = [
    { date: '2026-10-05', value: 6 },
    { date: '2026-10-26', value: 6 },
    { date: '2026-11-16', value: 6 },
  ];
  assert.equal(projectGoal(flat, 10, TODAY).status, 'estancado');
  assert.equal(projectGoal([{ date: '2026-11-01', value: 10 }], 10, TODAY).status, 'conseguido');
  // Los registros de hace más de 3 meses no cuentan para el ritmo
  const old = [
    { date: '2026-01-05', value: 1 },
    { date: '2026-02-05', value: 3 },
    { date: '2026-11-16', value: 6 },
  ];
  assert.equal(projectGoal(old, 10, TODAY).status, 'pocos_datos');
});

test('peso tendencial: suaviza un pico y sigue un cambio real', () => {
  const t = trendWeight([
    { date: '2026-11-01', weight: 83 },
    { date: '2026-11-02', weight: 84.5 }, // pico de un día
    { date: '2026-11-03', weight: 83 },
  ]);
  assert.equal(t[0].value, 83);
  assert.ok(t[1].value > 83 && t[1].value < 83.2, String(t[1].value));
  assert.ok(Math.abs(t[2].value - 83.13) < 0.05, String(t[2].value));
  // Con pesadas semanales, cada una pesa la mitad
  const weekly = trendWeight([
    { date: '2026-11-01', weight: 84 },
    { date: '2026-11-08', weight: 83 },
  ]);
  assert.ok(Math.abs(weekly[1].value - 83.5) < 0.01, String(weekly[1].value));
  assert.deepEqual(trendWeight([]), []);
});

test('ritmo semanal de la tendencia', () => {
  const trend = [
    { date: '2026-10-19', value: 84 },
    { date: '2026-11-02', value: 83.4 },
    { date: '2026-11-16', value: 83 },
  ];
  // Compara con el punto de hace 4 semanas: −1 kg en 28 días
  assert.equal(trendRatePerWeek(trend), -0.25);
  assert.equal(trendRatePerWeek([{ date: '2026-11-16', value: 83 }]), null);
});

const days = (monday: string, s: string) => {
  const map: Record<string, DayStatus> = { d: 'done', m: 'missed', r: 'rest', e: 'excused', p: 'pending', f: 'future' };
  const [y, mo, da] = monday.split('-').map(Number);
  return [...s].map((c, i) => {
    const dt = new Date(y, mo - 1, da + i, 12);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return { date: iso, status: map[c] };
  });
};

test('racha flexible: un fallo por semana no la rompe; dos sí', () => {
  const weeks = tallyWeeks([
    ...days('2026-10-26', 'dddddrr'), // completa
    ...days('2026-11-02', 'dmdddrr'), // un fallo: usa el comodín
    ...days('2026-11-09', 'dddddrr'),
  ]);
  assert.deepEqual(weeks.map(weekFulfilled), [true, true, true]);
  assert.deepEqual(weekStreak(weeks, '2026-11-16'), { current: 3, best: 3, passUsed: false });

  const broken = tallyWeeks([...days('2026-11-02', 'dddddrr'), ...days('2026-11-09', 'dmmddrr')]);
  assert.deepEqual(weekStreak(broken, '2026-11-16'), { current: 0, best: 1, passUsed: false });
});

test('racha flexible: la semana en curso, las de viaje y las vacías', () => {
  const past = days('2026-11-02', 'dddddrr');
  // Semana en curso con un fallo y sin sesiones hechas todavía: aún puede cumplirse
  const midweek = tallyWeeks([...past, ...days('2026-11-09', 'mpfffrr')]);
  assert.deepEqual(weekStreak(midweek, '2026-11-09'), { current: 1, best: 1, passUsed: true });
  // En cuanto hace una sesión, la semana ya suma
  const started = tallyWeeks([...past, ...days('2026-11-09', 'mdfffrr')]);
  assert.equal(weekStreak(started, '2026-11-09').current, 2);
  // Dos fallos en la semana en curso ya la rompen
  const lost = tallyWeeks([...past, ...days('2026-11-09', 'mmfffrr')]);
  assert.equal(weekStreak(lost, '2026-11-09').current, 0);
  // Una semana entera de viaje ni suma ni rompe
  const travel = tallyWeeks([...past, ...days('2026-11-09', 'eeeeerr'), ...days('2026-11-16', 'dfffffr')]);
  assert.equal(weekStreak(travel, '2026-11-16').current, 2);
});

const base: WeekReview = {
  done: 5,
  missed: 0,
  volume: { pecho: 12, biceps: 13, espalda: 12, hombro: 8, triceps: 6, antebrazo: 9, muslo: 4, cadera: 4, pantorrilla: 4 },
  records: 1,
  stretchDays: 3,
  walkedKm: 0,
  marchActive: false,
  longWalkDone: false,
  weighedIn: true,
  weightRate: -0.4,
  hardSessions: 1,
};

test('foco semanal: una sola cosa, por orden de importancia', () => {
  assert.equal(weeklyFocus(base).title, 'Seguir igual');
  assert.equal(weeklyFocus({ ...base, done: 0, missed: 5 }).title, 'Volver a empezar');
  assert.equal(weeklyFocus({ ...base, done: 3, missed: 2 }).title, 'No fallar dos seguidas');
  assert.equal(weeklyFocus({ ...base, hardSessions: 4 }).title, 'Bajar una marcha');
  assert.equal(weeklyFocus({ ...base, marchActive: true }).title, 'Hacer la tirada larga');
  assert.equal(weeklyFocus({ ...base, marchActive: true, longWalkDone: true }).title, 'Seguir igual');
  assert.equal(weeklyFocus({ ...base, volume: { ...base.volume, biceps: 6, pecho: 8 } }).title, 'Más series de bíceps');
  assert.equal(weeklyFocus({ ...base, weighedIn: false }).title, 'Pesarte');
  assert.equal(weeklyFocus({ ...base, weightRate: 0.3 }).title, 'Revisar lo que comes');
  assert.equal(weeklyFocus({ ...base, weightRate: -1.2 }).title, 'Perder más despacio');
  assert.equal(weeklyFocus({ ...base, stretchDays: 1 }).title, 'Estirar tres días');
  // Fallar sesiones pesa más que cualquier otro aviso
  assert.equal(weeklyFocus({ ...base, done: 2, missed: 3, weighedIn: false, stretchDays: 0 }).title, 'No fallar dos seguidas');
});

test('copia fuera del móvil: avisa si hay datos y nunca se hizo o tiene más de una semana', async () => {
  const { backupDue } = await import('./insights');
  assert.equal(backupDue(null, '2026-11-22', false).due, false);
  assert.match(backupDue(null, '2026-11-22', true).detail, /Aún no tienes ninguna/);
  assert.equal(backupDue('2026-11-18', '2026-11-22', true).due, false);
  assert.match(backupDue('2026-11-10', '2026-11-22', true).detail, /hace 12 días/);
});
