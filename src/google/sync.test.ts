/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportBackup } from '../db/backup';
import { saveBodyEntry } from '../db/body';
import { migrate } from '../db/schema';
import { createTestDb } from '../db/testDb';
import { decideSync, fingerprint } from './driveBackup';

test('la huella cambia con los datos del usuario y no con la hora ni con los ajustes de la propia copia', async () => {
  const db = createTestDb();
  await migrate(db);
  await saveBodyEntry(db, { date: '2026-11-20', weight: 80 });
  const a = fingerprint(await exportBackup(db));
  // Otra copia igual, más tarde: misma huella.
  assert.equal(fingerprint({ ...(await exportBackup(db)), exportedAt: '2030-01-01T00:00:00Z' }), a);
  // Los ajustes que toca la sincronización no cuentan.
  await db.runAsync("INSERT INTO settings (key, value) VALUES ('drive_last_backup', '2026-11-22T10:00:00Z'), ('last_export', '2026-11-22')");
  assert.equal(fingerprint(await exportBackup(db)), a);
  // Un ajuste del usuario sí.
  await db.runAsync("INSERT INTO settings (key, value) VALUES ('trial_active', '1')");
  const b = fingerprint(await exportBackup(db));
  assert.notEqual(b, a);
  // Y un dato nuevo también.
  await saveBodyEntry(db, { date: '2026-11-21', weight: 79.8 });
  assert.notEqual(fingerprint(await exportBackup(db)), b);
});

test('qué hacer al sincronizar: el móvil manda, pero nunca pisa una copia ajena sin preguntar', () => {
  const base = { signedIn: true, hasData: true, local: 'A', uploaded: 'A', lastSyncAt: '2026-11-22T10:00:00.000Z', remoteAt: '2026-11-22T10:00:00.400Z' };
  // Todo igual: nada que hacer.
  assert.equal(decideSync(base), 'nada');
  // Cambios locales: se suben.
  assert.equal(decideSync({ ...base, local: 'B' }), 'subir');
  // Sin sesión, o con la app vacía, nunca se sube.
  assert.equal(decideSync({ ...base, local: 'B', signedIn: false }), 'nada');
  assert.equal(decideSync({ ...base, local: 'B', hasData: false }), 'nada');
  // En Drive hay algo más nuevo que lo último que subió este dispositivo: otro dispositivo ha escrito.
  assert.equal(decideSync({ ...base, local: 'B', remoteAt: '2026-11-22T18:00:00.000Z' }), 'conflicto');
  // Móvil nuevo con datos y una copia ya en Drive: se pregunta.
  assert.equal(decideSync({ ...base, uploaded: null, lastSyncAt: null }), 'conflicto');
  // Primera copia, sin nada en Drive: se sube sin preguntar.
  assert.equal(decideSync({ ...base, uploaded: null, lastSyncAt: null, remoteAt: null }), 'subir');
  // La copia de Drive se borró a mano: se vuelve a subir.
  assert.equal(decideSync({ ...base, local: 'B', remoteAt: null }), 'subir');
});

test('hace cuánto se guardó, en palabras', async () => {
  const { ago } = await import('./relative');
  const now = Date.parse('2026-11-22T12:00:00Z');
  assert.equal(ago('2026-11-22T11:59:30Z', now), 'hace un momento');
  assert.equal(ago('2026-11-22T11:40:00Z', now), 'hace 20 min');
  assert.equal(ago('2026-11-22T09:00:00Z', now), 'hace 3 h');
  assert.equal(ago('2026-11-21T10:00:00Z', now), 'hace 1 día');
  assert.equal(ago('2026-11-19T12:00:00Z', now), 'hace 3 días');
  assert.equal(ago(null, now), '');
});
