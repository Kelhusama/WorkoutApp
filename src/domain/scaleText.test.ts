/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseScaleText } from './scaleText';

// Valores de una captura real de Huawei Salud (Huawei Scale 3), del miércoles 30 de septiembre de 2026.
const EXPECTED = {
  weight: 83.2,
  bodyFat: 25.9,
  skeletalMuscle: 33.5,
  visceralFat: 12,
  scaleBmr: 1736,
  water: 47.8,
  boneMass: 3.25,
  protein: 22.4,
  fatFreeMass: 61.7,
};
const TODAY = '2026-11-16';

const FOOTER = `Composición corporal
Agua 39,80
Proteínas 18,60
Grasa 21,55
Contenido de m... 3,25
Composición (kg) = agua + proteína + grasa + masa ósea
Desarrollado en colaboración con Hefei Institutes of Physical
Science de la Academia China de las Ciencias`;

const HEADER = `19:38
78
Datos de medición del cuerpo
Datos de la báscula de grasa corporal - mié, 30 sept, 7:24`;

test('texto leído ficha a ficha (etiqueta y debajo su valor)', () => {
  const text = `${HEADER}
83,2 kg
IMC
25,6
Sobrepeso
Grasa corporal
25,9 %
Masa musculoes...
33,5 kg
Grasa visceral
12,0
Tasa metabólica ...
1736 kcal/d
Agua en el cuerpo
47,8 %
Contenido de ma...
3,25 kg
Proteínas
22,4 %
Masa libre de gra...
61,7 kg
${FOOTER}`;
  const r = parseScaleText(text, TODAY);
  assert.deepEqual(r.values, EXPECTED);
  assert.equal(r.date, '2026-09-30');
  assert.equal(r.found.length, 9);
});

test('texto leído fila a fila (tres etiquetas y luego sus tres valores)', () => {
  const text = `${HEADER}
83,2 kg
IMC Grasa corporal Masa musculoes...
25,6 25,9 % 33,5 kg
Sobrepeso
Grasa visceral Tasa metabólica ... Agua en el cuerpo
12,0 1736 kcal/d 47,8 %
Contenido de ma... Proteínas Masa libre de gra...
3,25 kg 22,4 % 61,7 kg
${FOOTER}`;
  assert.deepEqual(parseScaleText(text, TODAY).values, EXPECTED);
});

test('unidades separadas del número o perdidas, y título partido en dos líneas', () => {
  const text = `Datos de la báscula de
grasa corporal - mié, 30 sept, 7:24
83,2
kg
IMC
25,6
Grasa corporal
25,9
%
Masa musculoesquelética
33,5
kg
Grasa visceral
12,0
Tasa metabólica basal
1736
kcal/d
Agua en el cuerpo
47,8
Contenido de ma...
3,25
Proteínas
22,4
Masa libre de grasa
61,7`;
  const r = parseScaleText(text, TODAY);
  assert.deepEqual(r.values, EXPECTED);
  assert.equal(r.date, '2026-09-30');
});

test('etiquetas en mayúsculas o con punto decimal también valen', () => {
  const r = parseScaleText('83.2 kg\nGRASA CORPORAL 25.9 %\nGRASA VISCERAL 12', TODAY);
  assert.deepEqual(r.values, { weight: 83.2, bodyFat: 25.9, visceralFat: 12 });
});

test('un valor imposible no se asigna ni descoloca los demás', () => {
  // Falta el valor de la grasa corporal: 33,5 kg no puede ser un porcentaje de grasa.
  const text = `83,2 kg
Grasa corporal
Masa musculoes...
33,5 kg
Grasa visceral
12,0`;
  assert.deepEqual(parseScaleText(text, TODAY).values, { weight: 83.2, skeletalMuscle: 33.5, visceralFat: 12 });
});

test('fecha: sin año se toma el más reciente que no sea futuro', () => {
  assert.equal(parseScaleText('lun, 16 nov, 8:00\n83,2 kg', TODAY).date, '2026-11-16');
  assert.equal(parseScaleText('mié, 30 dic, 8:00\n83,2 kg', TODAY).date, '2025-12-30');
  assert.equal(parseScaleText('3 de enero de 2026\n83,2 kg', TODAY).date, '2026-01-03');
  assert.equal(parseScaleText('83,2 kg', TODAY).date, null);
});

test('texto que no es de la báscula no devuelve nada', () => {
  const r = parseScaleText('Hola, quedamos a las 19:30 en el gimnasio. Somos 12.', TODAY);
  assert.deepEqual(r.values, {});
  assert.equal(r.found.length, 0);
});
