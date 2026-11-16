/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importBackup } from '../db/backup';
import { getBodyLog, saveBodyEntry } from '../db/body';
import { saveGymSession } from '../db/repo';
import { migrate } from '../db/schema';
import { createTestDb } from '../db/testDb';
import { DRIVE_SCOPE, readWebClientId } from './config';
import { BACKUP_FILE_NAME, downloadBackupFile, findBackupFile, uploadBackupFile, type FetchInit, type FetchLike } from './drive';
import {
  backupToDrive,
  driveBackupDate,
  isWeeklyBackupDue,
  loadDriveBackup,
  localHasData,
  shouldAutoBackup,
  withToken,
  type TokenSource,
} from './driveBackup';
import { DriveError, errorText, needsSignIn } from './errors';

interface StoredFile {
  id: string;
  name: string;
  parents: string[];
  content: string;
  modifiedTime: string;
}

/** Imita lo justo de la API de Drive: buscar en appDataFolder, crear (multipart), sustituir y descargar. */
function fakeDrive(validToken = 'bueno') {
  const files: StoredFile[] = [];
  const requests: string[] = [];
  let clock = Date.parse('2026-11-01T10:00:00.000Z');
  const reply = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const meta = (f: StoredFile) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: String(f.content.length) });
  const stamp = () => new Date((clock += 60_000)).toISOString();

  const fetchFn: FetchLike = async (url: string, init: FetchInit = {}) => {
    const method = init.method ?? 'GET';
    const u = new URL(url);
    requests.push(`${method} ${u.pathname}`);
    if (init.headers?.Authorization !== `Bearer ${validToken}`) {
      return reply(401, { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
    }
    if (method === 'GET' && u.pathname === '/drive/v3/files') {
      assert.equal(u.searchParams.get('spaces'), 'appDataFolder');
      const name = /^name = '(.+)'$/.exec(u.searchParams.get('q') ?? '')?.[1];
      const found = files.filter((f) => f.name === name).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
      return reply(200, { files: found.map(meta) });
    }
    if (method === 'POST' && u.pathname === '/upload/drive/v3/files') {
      assert.equal(u.searchParams.get('uploadType'), 'multipart');
      const boundary = /^multipart\/related; boundary=(.+)$/.exec(init.headers?.['Content-Type'] ?? '')?.[1];
      assert.ok(boundary, 'falta el límite del multipart');
      const parts = (init.body ?? '').split(`--${boundary}`);
      assert.equal(parts.length, 4);
      assert.equal(parts[3], '--\r\n');
      const partBody = (p: string) => p.slice(p.indexOf('\r\n\r\n') + 4, -2);
      const m = JSON.parse(partBody(parts[1])) as { name: string; parents: string[] };
      const file = { id: `id${files.length + 1}`, name: m.name, parents: m.parents, content: partBody(parts[2]), modifiedTime: stamp() };
      files.push(file);
      return reply(200, meta(file));
    }
    const upload = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (method === 'PATCH' && upload) {
      const file = files.find((f) => f.id === upload[1]);
      if (!file) return reply(404, { error: { code: 404, message: 'File not found', errors: [{ reason: 'notFound' }] } });
      assert.equal(u.searchParams.get('uploadType'), 'media');
      file.content = init.body ?? '';
      file.modifiedTime = stamp();
      return reply(200, meta(file));
    }
    const get = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (method === 'GET' && get && u.searchParams.get('alt') === 'media') {
      const file = files.find((f) => f.id === get[1]);
      return file ? reply(200, file.content) : reply(404, { error: { code: 404, message: 'File not found' } });
    }
    return reply(400, { error: { code: 400, message: `petición no prevista: ${method} ${url}` } });
  };
  return { fetchFn, files, requests };
}

const fixedToken = (token: string): TokenSource => ({ get: async () => token, refresh: async () => token });

async function seeded() {
  const db = createTestDb();
  await migrate(db);
  await saveGymSession(db, '2026-11-02', 'normal', { weight: 50, reps: 5 });
  await saveBodyEntry(db, { date: '2026-11-01', weight: 83.2, bodyFat: 25.9 });
  return db;
}

test('sin copia en Drive: buscar, descargar y cargar devuelven null', async () => {
  const { fetchFn, requests } = fakeDrive();
  assert.equal(await findBackupFile(fetchFn, 'bueno'), null);
  assert.equal(await downloadBackupFile(fetchFn, 'bueno'), null);
  assert.equal(await loadDriveBackup(fetchFn, fixedToken('bueno')), null);
  assert.equal(await driveBackupDate(fetchFn, fixedToken('bueno')), null);
  assert.ok(requests.every((r) => r === 'GET /drive/v3/files'));
});

test('la primera subida crea el archivo en appDataFolder y las siguientes sustituyen el mismo', async () => {
  const { fetchFn, files, requests } = fakeDrive();
  const first = await uploadBackupFile(fetchFn, 'bueno', '{"n":1}');
  assert.equal(files.length, 1);
  assert.deepEqual(files[0].parents, ['appDataFolder']);
  assert.equal(files[0].name, BACKUP_FILE_NAME);
  assert.equal(files[0].content, '{"n":1}');

  const second = await uploadBackupFile(fetchFn, 'bueno', '{"n":2,"texto":"línea\\r\\ncon salto y ñ"}');
  assert.equal(files.length, 1, 'no debe crear un segundo archivo');
  assert.equal(second.id, first.id);
  assert.ok(second.modifiedTime > first.modifiedTime);
  assert.equal(files[0].content, '{"n":2,"texto":"línea\\r\\ncon salto y ñ"}');
  assert.deepEqual(requests, [
    'GET /drive/v3/files',
    'POST /upload/drive/v3/files',
    'GET /drive/v3/files',
    'PATCH /upload/drive/v3/files/id1',
  ]);

  const got = await downloadBackupFile(fetchFn, 'bueno');
  assert.equal(got?.content, files[0].content);
  assert.equal(got?.file.modifiedTime, second.modifiedTime);
});

test('el contenido no se rompe aunque incluya el texto del límite del multipart', async () => {
  const { fetchFn, files } = fakeDrive();
  const content = '{"nota":"--forja_copia_limite dentro del texto"}';
  await uploadBackupFile(fetchFn, 'bueno', content);
  assert.equal(files[0].content, content);
});

test('copia a Drive y restauración en otra base de datos conservan los datos', async () => {
  const { fetchFn, files } = fakeDrive();
  const tokens = fixedToken('bueno');
  const source = await seeded();
  const savedAt = await backupToDrive(source, fetchFn, tokens);
  assert.equal(savedAt, files[0].modifiedTime);
  assert.equal(await driveBackupDate(fetchFn, tokens), savedAt);

  // Más datos y segunda copia: sigue habiendo un solo archivo, con lo último
  await saveBodyEntry(source, { date: '2026-11-08', weight: 82.5 });
  await backupToDrive(source, fetchFn, tokens);
  assert.equal(files.length, 1);

  const target = createTestDb();
  await migrate(target);
  await saveBodyEntry(target, { date: '2026-10-01', weight: 90 }); // se sustituye
  const found = await loadDriveBackup(fetchFn, tokens);
  assert.ok(found);
  assert.equal(found.modifiedTime, files[0].modifiedTime);
  assert.equal(found.backup.tables.session_log.length, 1);
  await importBackup(target, found.backup);
  assert.deepEqual(
    (await getBodyLog(target)).map((e) => [e.date, e.weight]).sort(),
    [
      ['2026-11-01', 83.2],
      ['2026-11-08', 82.5],
    ],
  );
});

test('un archivo de Drive que no es una copia se rechaza al cargarlo', async () => {
  const { fetchFn } = fakeDrive();
  await uploadBackupFile(fetchFn, 'bueno', '{"app":"otra"}');
  await assert.rejects(loadDriveBackup(fetchFn, fixedToken('bueno')), /no es una copia de seguridad de esta app/);
});

test('401: error de sesión; con un token renovado se reintenta una sola vez', async () => {
  const { fetchFn, files } = fakeDrive();
  await assert.rejects(findBackupFile(fetchFn, 'caducado'), (e) => needsSignIn(e) && /Vuelve a iniciar sesión/.test(errorText(e)));
  await assert.rejects(uploadBackupFile(fetchFn, 'caducado', '{}'), (e) => e instanceof DriveError && e.status === 401);
  assert.equal(files.length, 0);

  // El token guardado ha caducado y el renovado funciona
  const calls: string[] = [];
  const renewing: TokenSource = {
    get: async () => 'caducado',
    refresh: async (rejected) => {
      calls.push(rejected);
      return 'bueno';
    },
  };
  const db = await seeded();
  await backupToDrive(db, fetchFn, renewing);
  assert.deepEqual(calls, ['caducado']);
  assert.equal(files.length, 1);

  // El renovado tampoco vale: hay que volver a iniciar sesión, sin más reintentos
  let refreshes = 0;
  const dead: TokenSource = {
    get: async () => 'caducado',
    refresh: async () => {
      refreshes++;
      return 'otro-caducado';
    },
  };
  await assert.rejects(backupToDrive(db, fetchFn, dead), needsSignIn);
  assert.equal(refreshes, 1);

  // Los errores que no son de sesión no renuevan el token
  await assert.rejects(
    withToken(dead, async () => {
      throw new DriveError('http', 'x', 500);
    }),
    /x/,
  );
  assert.equal(refreshes, 1);
});

test('403, 500 y fallo de red dan mensajes claros y no piden iniciar sesión', async () => {
  const status = (code: number, body: unknown): FetchLike => async () => ({
    ok: false,
    status: code,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const disabled = status(403, { error: { message: 'Drive API has not been used', errors: [{ reason: 'accessNotConfigured' }] } });
  await assert.rejects(findBackupFile(disabled, 't'), (e) => {
    assert.ok(e instanceof DriveError);
    assert.equal(e.kind, 'permission');
    assert.match(e.message, /API de Drive está activada.*accessNotConfigured/);
    return !needsSignIn(e);
  });
  const limited = status(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } });
  await assert.rejects(findBackupFile(limited, 't'), /limitando las peticiones/);
  await assert.rejects(findBackupFile(status(500, '<html>error</html>'), 't'), (e) => {
    assert.ok(e instanceof DriveError);
    assert.equal(e.kind, 'http');
    return /error \(500\)/.test(e.message);
  });
  const offline: FetchLike = async () => {
    throw new TypeError('Network request failed');
  };
  await assert.rejects(uploadBackupFile(offline, 't', '{}'), (e) => {
    assert.ok(e instanceof DriveError);
    assert.equal(e.kind, 'network');
    return /No hay conexión/.test(e.message);
  });
  await assert.rejects(findBackupFile(async () => ({ ok: true, status: 200, text: async () => 'no es json' }), 't'), /respuesta inesperada/);
});

test('si el archivo se borra entre la búsqueda y la subida, se crea de nuevo', async () => {
  const { fetchFn, files } = fakeDrive();
  await uploadBackupFile(fetchFn, 'bueno', '{"n":1}');
  const racing: FetchLike = async (url, init) => {
    if (init?.method === 'PATCH') files.length = 0; // desaparece justo antes de sustituirlo
    return fetchFn(url, init);
  };
  await uploadBackupFile(racing, 'bueno', '{"n":2}');
  assert.equal(files.length, 1);
  assert.equal(files[0].content, '{"n":2}');
});

test('¿toca copia semanal?', () => {
  const now = new Date('2026-11-16T09:00:00.000Z');
  assert.equal(isWeeklyBackupDue(null, now), true, 'nunca se hizo');
  assert.equal(isWeeklyBackupDue('no es una fecha', now), true);
  assert.equal(isWeeklyBackupDue('2026-11-09T09:00:00.000Z', now), true, 'justo 7 días');
  assert.equal(isWeeklyBackupDue('2026-11-09T09:00:00.001Z', now), false, 'casi 7 días');
  assert.equal(isWeeklyBackupDue('2026-11-15T22:00:00.000Z', now), false);
  assert.equal(isWeeklyBackupDue('2026-10-01T00:00:00.000Z', now), true);
  assert.equal(isWeeklyBackupDue('2026-12-01T00:00:00.000Z', now), false, 'fecha futura (reloj cambiado)');

  const due = { signedIn: true, hasData: true, lastBackupAt: '2026-11-01T09:00:00.000Z', now };
  assert.equal(shouldAutoBackup(due), true);
  assert.equal(shouldAutoBackup({ ...due, signedIn: false }), false);
  assert.equal(shouldAutoBackup({ ...due, hasData: false }), false, 'una app vacía no pisa la copia');
  assert.equal(shouldAutoBackup({ ...due, lastBackupAt: '2026-11-14T09:00:00.000Z' }), false);
  assert.equal(shouldAutoBackup({ ...due, lastBackupAt: null }), false, 'la primera copia de un móvil es manual');
});

test('la app vacía no tiene datos que copiar; con una medición, sí', async () => {
  const db = createTestDb();
  await migrate(db);
  assert.equal(await localHasData(db), false);
  await saveBodyEntry(db, { date: '2026-11-01', weight: 83 });
  assert.equal(await localHasData(db), true);
});

test('configuración: el ID de cliente web solo vale si está relleno', () => {
  assert.equal(DRIVE_SCOPE, 'https://www.googleapis.com/auth/drive.appdata');
  assert.equal(readWebClientId(undefined), null);
  assert.equal(readWebClientId({}), null);
  assert.equal(readWebClientId({ google: { webClientId: '' } }), null);
  assert.equal(readWebClientId({ google: { webClientId: 'PEGA_AQUI' } }), null);
  assert.equal(readWebClientId({ google: { webClientId: '.apps.googleusercontent.com' } }), null);
  assert.equal(readWebClientId({ google: { webClientId: ' 123-abc.apps.googleusercontent.com ' } }), '123-abc.apps.googleusercontent.com');
});

test('los errores del inicio de sesión se muestran en español', () => {
  assert.match(errorText({ code: 'DEVELOPER_ERROR', message: 'raw' }), /SHA-1/);
  assert.match(errorText({ code: 'PLAY_SERVICES_NOT_AVAILABLE', message: 'raw' }), /Servicios de Google Play/);
  assert.equal(errorText(new Error('Mensaje propio')), 'Mensaje propio');
});
