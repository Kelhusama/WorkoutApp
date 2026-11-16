/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXERCISES } from '../domain/exercises';
import { VIEW, capsulePath, drawFigure, toSvg } from './draw';
import { ILLUSTRATIONS } from './library';
import { buildSkeleton, cyclePhase, solveTwoBone } from './skeleton';

test('todos los ejercicios tienen dibujo', () => {
  for (const id of Object.keys(EXERCISES)) assert.ok(ILLUSTRATIONS[id], id);
});

test('cinemática inversa respeta la longitud de los huesos', () => {
  const { joint, end } = solveTwoBone([0, 0], [30, 20], 28, 26, 1);
  assert.ok(Math.abs(Math.hypot(joint[0], joint[1]) - 28) < 1e-6);
  assert.ok(Math.abs(Math.hypot(end[0] - joint[0], end[1] - joint[1]) - 26) < 1e-6);
  assert.ok(Math.hypot(end[0] - 30, end[1] - 20) < 1e-6);
});

test('en cada postura la mano y el pie llegan a su sitio y nada atraviesa el suelo', () => {
  for (const [id, ill] of Object.entries(ILLUSTRATIONS)) {
    if (ill.front) continue;
    for (const pose of [ill.start, ill.end]) {
      const sk = buildSkeleton(pose, ill);
      const handErr = Math.hypot(sk.hand[0] - pose.hand[0], sk.hand[1] - pose.hand[1]);
      assert.ok(handErr < 4, `${id}: mano a ${handErr.toFixed(1)} px`);
      const footErr = Math.hypot(sk.foot[0] - pose.foot[0], sk.foot[1] - pose.foot[1]);
      assert.ok(footErr < 8, `${id}: pie a ${footErr.toFixed(1)} px`);
      for (const p of [sk.elbow, sk.knee, sk.head, sk.toe, sk.farToe, sk.farKnee]) {
        assert.ok(p[1] <= 200, `${id}: bajo el suelo (${p[1].toFixed(0)})`);
      }
    }
  }
});

test('el dibujo cabe en el lienzo y no tiene valores inválidos en todo el recorrido', () => {
  for (const [id, ill] of Object.entries(ILLUSTRATIONS)) {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const shapes = drawFigure(ill, t);
      assert.ok(shapes.length > 10, id);
      const svg = toSvg(shapes);
      assert.ok(!/NaN|Infinity|undefined/.test(svg), `${id} t=${t}`);
      for (const s of shapes) {
        if (s.k !== 'capsule') continue;
        for (const p of [s.a, s.b]) {
          assert.ok(p[0] > -2 && p[0] < VIEW.w + 2 && p[1] > -2 && p[1] < VIEW.h + 2, `${id} t=${t}: fuera del lienzo`);
        }
      }
    }
  }
});

test('contorno de cápsula: normal y degenerada', () => {
  assert.match(capsulePath([0, 0], [10, 0], 2, 1), /^M 0\.00 2\.00 L 10\.00 1\.00 A/);
  assert.match(capsulePath([5, 5], [5, 5], 2, 2), /^M 3\.00 5\.00 A/);
});

test('el ciclo de animación empieza y acaba en reposo', () => {
  assert.equal(cyclePhase(0), 0);
  assert.equal(cyclePhase(0.999) < 0.01, true);
  assert.equal(cyclePhase(0.5), 1);
});
