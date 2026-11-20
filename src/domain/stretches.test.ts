/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ILLUSTRATIONS } from '../illustrations/library';
import {
  ROUTINES,
  ROUTINE_ORDER,
  STRETCHES,
  ZONE_ORDER,
  minutesByZone,
  routineAfter,
  routineMinutes,
  routineSeconds,
  routineSteps,
  weeklyStretching,
  zoneVerdict,
} from './stretches';

test('las rutinas solo usan estiramientos que existen, y los dibujos indicados existen', () => {
  assert.deepEqual([...ROUTINE_ORDER].sort(), Object.keys(ROUTINES).sort());
  for (const r of Object.values(ROUTINES)) {
    assert.ok(r.stretchIds.length >= 5, r.id);
    assert.equal(new Set(r.stretchIds).size, r.stretchIds.length, `${r.id}: repetidos`);
    for (const id of r.stretchIds) assert.ok(STRETCHES[id], `${r.id}: ${id}`);
  }
  for (const s of Object.values(STRETCHES)) {
    assert.ok(ZONE_ORDER.includes(s.zone), s.id);
    assert.ok(s.cues.length >= 2 && s.seconds >= 20 && s.seconds <= 120, s.id);
    if (s.figure) assert.ok(ILLUSTRATIONS[s.figure], `${s.id}: falta el dibujo ${s.figure}`);
  }
});

test('todos los estiramientos tienen dibujo', () => {
  for (const s of Object.values(STRETCHES)) assert.ok(s.figure, s.id);
});

test('las rutinas tras la sesión duran entre 4 y 8 minutos', () => {
  for (const id of ['postA', 'postB', 'postC'] as const) {
    const m = routineMinutes(ROUTINES[id]);
    assert.ok(m >= 4 && m <= 8, `${id}: ${m} min`);
  }
  assert.equal(routineAfter('A'), 'postA');
  assert.equal(routineAfter('C'), 'postC');
});

test('los estiramientos por lados se desdoblan en dos pasos', () => {
  const steps = routineSteps(ROUTINES.postA);
  assert.deepEqual(steps.slice(0, 3), [
    { stretchId: 'cuelgue_pasivo', side: null, seconds: 30 },
    { stretchId: 'dorsal_marco', side: 1, seconds: 30 },
    { stretchId: 'dorsal_marco', side: 2, seconds: 30 },
  ]);
});

test('valoración semanal por zona: mínimo de 5 min y techo de 10', () => {
  assert.equal(zoneVerdict(0).label, 'Sin estirar');
  assert.equal(zoneVerdict(3).label, 'Poco');
  assert.equal(zoneVerdict(5).label, 'En su punto');
  assert.equal(zoneVerdict(10).label, 'En su punto');
  assert.equal(zoneVerdict(12).label, 'Más no aporta');
});

test('minutos y días por semana', () => {
  const w = weeklyStretching([
    { date: '2026-11-10', stretchId: 'mariposa', seconds: 60 },
    { date: '2026-11-10', stretchId: 'rana', seconds: 60 },
    { date: '2026-11-12', stretchId: 'rana', seconds: 90 },
    { date: '2026-11-17', stretchId: 'mariposa', seconds: 30 },
  ]);
  assert.deepEqual(w.minutes, [
    { date: '2026-11-09', value: 3.5 },
    { date: '2026-11-16', value: 0.5 },
  ]);
  assert.deepEqual(w.days.map((p) => p.value), [2, 1]);
  // Un estiramiento desconocido (catálogo antiguo) no rompe el cálculo
  assert.equal(minutesByZone([{ date: '2026-11-10', stretchId: 'ya_no_existe', seconds: 600 }]).aductores, 0);
});
