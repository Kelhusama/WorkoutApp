/** Permiso mínimo: solo la carpeta privada de la app en Drive, invisible para el usuario y otras apps. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

/**
 * Lee el ID de cliente web de `expo.extra.google.webClientId` (app.json).
 * Devuelve null mientras esté vacío o no tenga forma de ID de cliente de Google.
 */
export function readWebClientId(extra: unknown): string | null {
  const google = (extra as { google?: { webClientId?: unknown } } | null | undefined)?.google;
  const id = typeof google?.webClientId === 'string' ? google.webClientId.trim() : '';
  return id.endsWith(CLIENT_ID_SUFFIX) && id.length > CLIENT_ID_SUFFIX.length ? id : null;
}
