/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup } from './backup';
import { migrate } from './schema';
import { createTestDb } from './testDb';

const versionOf = async (db: SQLiteDatabase) => (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;
const tables = async (db: SQLiteDatabase) => (await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
const count = async (db: SQLiteDatabase, table: string) => (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

/** Base al día con algo de todo lo importante dentro. */
async function withData() {
  const db = createTestDb();
  await migrate(db);
  await db.execAsync(`
    INSERT INTO session_log (date, kind, status, feeling, created_at) VALUES ('2026-11-16', 'A', 'done', 'normal', '2026-11-16T10:00:00Z');
    INSERT INTO set_log (session_id, slot_key, exercise_id, set_index, target, value) VALUES (1, 'A.curl', 'curl_concentrado', 0, 8, 8);
    INSERT INTO body_log (date, weight, waist) VALUES ('2026-11-16', 80.5, 90);
    INSERT INTO day_override (date, role) VALUES ('2026-11-18', 'movilidad');
    INSERT INTO trial_log (date, lift, weight, reps, sets, reserve, grip) VALUES ('2026-11-20', 'dominada', 0, 4, 1, 0, 'prono');
    INSERT INTO settings (key, value) VALUES ('trial_active', '1');
  `);
  return { db, latest: await versionOf(db) };
}

async function assertDataIntact(db: SQLiteDatabase) {
  assert.equal(await count(db, 'session_log'), 1);
  assert.equal(await count(db, 'set_log'), 1);
  assert.equal(await count(db, 'trial_log'), 1);
  assert.deepEqual({ ...(await db.getFirstAsync<{ weight: number; waist: number }>('SELECT weight, waist FROM body_log'))! }, { weight: 80.5, waist: 90 });
  assert.deepEqual({ ...(await db.getFirstAsync<{ role: string }>('SELECT role FROM day_override'))! }, { role: 'movilidad' });
}

test('si un paso falla a mitad, se deshace entero y al volver a abrir la app continúa desde ahí', async () => {
  const db = createTestDb();
  // Base antigua (versión 14) con datos.
  await migrate(db);
  await db.execAsync(`
    INSERT INTO body_log (date, weight) VALUES ('2026-11-16', 80);
    DROP TABLE coach_block; DROP TABLE slot_stage; DROP TABLE trial_log; DROP TABLE hang_log;
    PRAGMA user_version = 14;
  `);

  // El paso 14 → 15 falla justo después de crear su tabla.
  let failed = false;
  const flaky = new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'execAsync') {
        return async (sql: string) => {
          await target.execAsync(sql);
          if (!failed && sql.includes('coach_block')) {
            failed = true;
            throw new Error('disco lleno');
          }
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  await assert.rejects(() => migrate(flaky), /paso 14 → 15.*Tus datos no han cambiado.*disco lleno/);
  // Nada a medias: sigue en la 14, sin la tabla nueva y con los datos.
  assert.equal(await versionOf(db), 14);
  assert.equal((await tables(db)).includes('coach_block'), false);
  assert.equal(await count(db, 'body_log'), 1);

  // Al reintentar, termina.
  await migrate(db);
  assert.ok((await versionOf(db)) >= 21);
  assert.ok((await tables(db)).includes('coach_block') && (await tables(db)).includes('hang_log'));
  assert.equal(await count(db, 'body_log'), 1);
});

test('volver a pasar todos los pasos sobre una base al día no rompe nada ni pierde datos', async () => {
  // El peor caso: se pierde el número de versión y la app cree que la base es nueva.
  const { db, latest } = await withData();
  await db.execAsync('PRAGMA user_version = 0');
  await migrate(db);
  assert.equal(await versionOf(db), latest);
  await assertDataIntact(db);
});

test('desde cualquier versión anterior se llega a la última con los datos intactos', async () => {
  const { latest } = await withData();
  for (let v = 1; v < latest; v++) {
    const { db } = await withData();
    await db.execAsync(`PRAGMA user_version = ${v}`);
    await migrate(db);
    assert.equal(await versionOf(db), latest, `desde la versión ${v}`);
    await assertDataIntact(db);
  }
});

test('una base más nueva que la app no se toca', async () => {
  const { db } = await withData();
  await db.execAsync('PRAGMA user_version = 999');
  let called = false;
  await migrate(db, {
    beforeUpgrade: async () => {
      called = true;
    },
  });
  assert.equal(await versionOf(db), 999);
  assert.equal(called, false);
  await assertDataIntact(db);
});

test('antes de actualizar una base con datos se avisa para hacer copia; si la copia falla, se actualiza igual', async () => {
  // Instalación nueva: no hay nada que copiar.
  const fresh = createTestDb();
  let calls: number[] = [];
  await migrate(fresh, { beforeUpgrade: async (from) => void calls.push(from) });
  assert.deepEqual(calls, []);

  // Base antigua: se avisa una vez, con la versión de la que se parte.
  const { db, latest } = await withData();
  await db.execAsync('PRAGMA user_version = 12');
  calls = [];
  await migrate(db, { beforeUpgrade: async (from) => void calls.push(from) });
  assert.deepEqual(calls, [12]);

  // Ya al día: no se vuelve a avisar.
  await migrate(db, { beforeUpgrade: async (from) => void calls.push(from) });
  assert.deepEqual(calls, [12]);

  // Si guardar la copia falla, la actualización sigue adelante.
  await db.execAsync('PRAGMA user_version = 12');
  const warn = console.warn;
  console.warn = () => {};
  try {
    await migrate(db, {
      beforeUpgrade: async () => {
        throw new Error('sin espacio');
      },
    });
  } finally {
    console.warn = warn;
  }
  assert.equal(await versionOf(db), latest);
  await assertDataIntact(db);
});

test('la copia de seguridad funciona también sobre una base antigua a la que le faltan tablas', async () => {
  const { db } = await withData();
  await db.execAsync('DROP TABLE hang_log; DROP TABLE coach_block;');
  const backup = await exportBackup(db);
  assert.deepEqual(backup.tables.hang_log, []);
  assert.deepEqual(backup.tables.coach_block, []);
  assert.equal(backup.tables.session_log.length, 1);
  assert.equal(backup.tables.trial_log.length, 1);
});
