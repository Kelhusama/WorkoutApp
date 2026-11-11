/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_REMINDERS, parseTime, planReminders, shiftTime } from './reminders';

// Miércoles 11/11/2026 con gimnasio el jueves: X = A (tirón), J = gym, V = C.
const days = [
  { date: '2026-11-11', type: 'A' as const, status: 'pending' as const },
  { date: '2026-11-12', type: 'gym' as const, status: 'future' as const },
  { date: '2026-11-13', type: 'C' as const, status: 'future' as const },
  { date: '2026-11-14', type: 'rest' as const, status: 'rest' as const },
];

test('avisos a las 9, 10 y 12 solo en días de casa', () => {
  const r = planReminders(days, DEFAULT_REMINDERS, new Date(2026, 10, 11, 8, 0));
  assert.deepEqual(
    r.map((x) => `${x.id} ${x.at.getHours()}:${x.at.getMinutes()}`),
    [
      'rem-2026-11-11-0 9:0',
      'rem-2026-11-11-1 10:0',
      'rem-2026-11-11-2 12:0',
      'rem-2026-11-13-0 9:0',
      'rem-2026-11-13-1 10:0',
      'rem-2026-11-13-2 12:0',
    ],
  );
  assert.match(r[0].title, /Tirón/);
});

test('no programa horas ya pasadas', () => {
  const r = planReminders(days, DEFAULT_REMINDERS, new Date(2026, 10, 11, 10, 30));
  assert.deepEqual(
    r.filter((x) => x.id.startsWith('rem-2026-11-11')).map((x) => x.id),
    ['rem-2026-11-11-2'],
  );
});

test('sesión hecha o marcada como «Hoy no» no recibe avisos', () => {
  const done = [{ ...days[0], status: 'done' as const }, { ...days[2], status: 'missed' as const }];
  assert.equal(planReminders(done, DEFAULT_REMINDERS, new Date(2026, 10, 11, 8, 0)).length, 0);
});

test('desactivados no programa nada; máximo 3 por día y ordenados', () => {
  assert.equal(planReminders(days, { ...DEFAULT_REMINDERS, enabled: false }, new Date(2026, 10, 11, 8)).length, 0);
  const r = planReminders(days.slice(0, 1), { enabled: true, times: ['18:00', '08:30', 'xx', '07:00', '20:00'] }, new Date(2026, 10, 11, 6));
  assert.deepEqual(r.map((x) => `${x.at.getHours()}:${x.at.getMinutes()}`), ['7:0', '8:30', '18:0']);
});

test('horas: lectura y desplazamiento', () => {
  assert.deepEqual(parseTime('9:05'), { h: 9, m: 5 });
  assert.equal(parseTime('25:00'), null);
  assert.equal(shiftTime('09:00', 30), '09:30');
  assert.equal(shiftTime('00:00', -30), '23:30');
});
