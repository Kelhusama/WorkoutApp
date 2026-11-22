import { DriveError } from './errors';

/**
 * Llamadas REST a Google Drive para el archivo de copia, en la carpeta privada de la app
 * (`appDataFolder`). No depende del móvil: recibe `fetch` y el token de acceso.
 */

export const BACKUP_FILE_NAME = 'forja-copia.json';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS = 'id,name,modifiedTime,size';

export interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type FetchLike = (url: string, init?: FetchInit) => Promise<FetchResponse>;

export interface DriveFile {
  id: string;
  name: string;
  /** Fecha y hora (ISO) de la última vez que se guardó. */
  modifiedTime: string;
  size?: string;
}

function errorFor(status: number, body: string): DriveError {
  let reason = '';
  try {
    const e = (JSON.parse(body) as { error?: { message?: string; errors?: { reason?: string }[] } }).error;
    reason = e?.errors?.[0]?.reason ?? e?.message ?? '';
  } catch {
    // respuesta sin JSON: nos quedamos con el código
  }
  if (status === 401) return new DriveError('auth', 'La sesión de Google ha caducado. Vuelve a iniciar sesión.', status);
  if (status === 403) {
    const limit = /rateLimit|quota/i.test(reason);
    return new DriveError(
      'permission',
      limit
        ? 'Google Drive está limitando las peticiones o no queda espacio. Inténtalo más tarde.'
        : `Google Drive ha rechazado la petición. Comprueba que la API de Drive está activada en tu proyecto de Google Cloud y que diste permiso a la app.${reason ? ` (${reason})` : ''}`,
      status,
    );
  }
  return new DriveError('http', `Google Drive ha respondido con un error (${status}). Inténtalo más tarde.`, status);
}

async function call(fetchFn: FetchLike, token: string, url: string, init: FetchInit = {}): Promise<string> {
  let res: FetchResponse;
  let body: string;
  try {
    res = await fetchFn(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
    body = await res.text();
  } catch {
    throw new DriveError('network', 'No hay conexión con Google Drive. Comprueba internet e inténtalo de nuevo.');
  }
  if (!res.ok) throw errorFor(res.status, body);
  return body;
}

function parseFile(body: string): DriveFile {
  let f: Partial<DriveFile> | null = null;
  try {
    f = JSON.parse(body) as Partial<DriveFile>;
  } catch {
    // se trata abajo
  }
  if (!f || typeof f.id !== 'string') throw new DriveError('http', 'Google Drive ha devuelto una respuesta inesperada.');
  return { id: f.id, name: f.name ?? BACKUP_FILE_NAME, modifiedTime: f.modifiedTime ?? new Date().toISOString(), size: f.size };
}

/** El archivo de copia de la carpeta privada (el más reciente), o null si todavía no hay ninguno. */
export async function findBackupFile(fetchFn: FetchLike, token: string): Promise<DriveFile | null> {
  const query = [
    'spaces=appDataFolder',
    `q=${encodeURIComponent(`name = '${BACKUP_FILE_NAME}'`)}`,
    `orderBy=${encodeURIComponent('modifiedTime desc')}`,
    'pageSize=10',
    `fields=${encodeURIComponent(`files(${FILE_FIELDS})`)}`,
  ].join('&');
  const body = await call(fetchFn, token, `${API}?${query}`);
  let files: DriveFile[] | undefined;
  try {
    files = (JSON.parse(body) as { files?: DriveFile[] }).files;
  } catch {
    throw new DriveError('http', 'Google Drive ha devuelto una respuesta inesperada.');
  }
  return files?.[0] ?? null;
}

function multipart(metadata: object, content: string): { contentType: string; body: string } {
  let boundary = 'forja_copia_limite';
  while (content.includes(boundary)) boundary += '_x';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return { contentType: `multipart/related; boundary=${boundary}`, body };
}

async function createBackupFile(fetchFn: FetchLike, token: string, content: string): Promise<DriveFile> {
  const { contentType, body } = multipart(
    { name: BACKUP_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' },
    content,
  );
  return parseFile(
    await call(fetchFn, token, `${UPLOAD}?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    }),
  );
}

/**
 * Guarda la copia: crea el archivo la primera vez y después sustituye siempre el mismo.
 * (Subida en una sola petición: vale hasta 5 MB, muy por encima de lo que ocupan los datos.)
 */
export async function uploadBackupFile(fetchFn: FetchLike, token: string, content: string): Promise<DriveFile> {
  const existing = await findBackupFile(fetchFn, token);
  if (!existing) return createBackupFile(fetchFn, token, content);
  try {
    return parseFile(
      await call(
        fetchFn,
        token,
        `${UPLOAD}/${encodeURIComponent(existing.id)}?uploadType=media&fields=${encodeURIComponent(FILE_FIELDS)}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: content },
      ),
    );
  } catch (e) {
    // Borrado entre la búsqueda y la subida: se crea de nuevo.
    if (e instanceof DriveError && e.status === 404) return createBackupFile(fetchFn, token, content);
    throw e;
  }
}

/** Descarga el contenido de la copia, o null si no hay ninguna. */
export async function downloadBackupFile(
  fetchFn: FetchLike,
  token: string,
): Promise<{ file: DriveFile; content: string } | null> {
  const file = await findBackupFile(fetchFn, token);
  if (!file) return null;
  const content = await call(fetchFn, token, `${API}/${encodeURIComponent(file.id)}?alt=media`);
  return { file, content };
}
