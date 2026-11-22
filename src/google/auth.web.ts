import Constants from 'expo-constants';

import { DRIVE_SCOPE, readWebClientId } from './config';
import type { TokenSource } from './driveBackup';
import { DriveError } from './errors';

/**
 * Inicio de sesión de Google en el navegador (solo para probar la app en el ordenador).
 *
 * Metro elige este archivo en vez de `auth.ts` al compilar para web; expone lo mismo.
 * Usa el flujo de OAuth por redirección: la página va a Google y vuelve con el permiso en la
 * dirección. No abre ventanas emergentes, porque las cabeceras que necesita la base de datos
 * en el navegador (aislamiento entre orígenes) impiden que una ventana emergente conteste.
 *
 * Límites respecto al móvil: el permiso dura una hora y no se renueva solo; al caducar hay
 * que volver a iniciar sesión. Se guarda en la pestaña (sessionStorage), no entre sesiones.
 */

const KEY = 'forja.google';

interface Saved {
  token: string;
  /** Momento en que caduca, en milisegundos. */
  expires: number;
  email: string;
}

const hasWindow = typeof window !== 'undefined';
const clientId = () => readWebClientId(Constants.expoConfig?.extra);

function read(): Saved | null {
  if (!hasWindow) return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s && typeof s.token === 'string' && s.expires > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function save(s: Saved | null) {
  if (!hasWindow) return;
  try {
    if (s) window.sessionStorage.setItem(KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // Navegación privada sin almacenamiento: la sesión durará lo que dure la página.
  }
}

/** Al volver de Google, el permiso viene en la parte final de la dirección (#access_token=…). */
function captureRedirect() {
  if (!hasWindow || !window.location.hash.includes('access_token=')) return;
  const p = new URLSearchParams(window.location.hash.slice(1));
  const token = p.get('access_token');
  const seconds = Number(p.get('expires_in') ?? '3600');
  // Se limpia la dirección para que el permiso no quede a la vista ni en el historial.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (!token || !(p.get('scope') ?? '').includes(DRIVE_SCOPE)) return;
  const saved: Saved = { token, expires: Date.now() + seconds * 1000, email: '' };
  save(saved);
  // El correo se pide aparte; si falla, se muestra «Cuenta de Google».
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then((info: { email?: string } | null) => {
      if (info?.email) save({ ...saved, email: info.email });
    })
    .catch(() => {});
}
captureRedirect();

export type GoogleStatus = 'unavailable' | 'unconfigured' | 'ready';

export function googleStatus(): GoogleStatus {
  if (!hasWindow) return 'unavailable';
  return clientId() ? 'ready' : 'unconfigured';
}

export interface GoogleAccount {
  email: string;
}

export function currentAccount(): GoogleAccount | null {
  const s = read();
  return s ? { email: s.email || 'Cuenta de Google' } : null;
}

/** Lleva a la página de Google. La promesa no se resuelve: al volver, la página se carga de nuevo. */
export async function signIn(): Promise<GoogleAccount | null> {
  const id = clientId();
  if (!id) throw new Error('Falta el ID de cliente web de Google en app.json (docs/GOOGLE.md).');
  const params = new URLSearchParams({
    client_id: id,
    // Tiene que estar dada de alta tal cual en Google Cloud, en «URI de redireccionamiento autorizados».
    redirect_uri: `${window.location.origin}/perfil`,
    response_type: 'token',
    scope: `${DRIVE_SCOPE} email`,
    prompt: 'select_account',
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  return new Promise<GoogleAccount | null>(() => {});
}

export async function signOut(): Promise<void> {
  save(null);
}

const expired = () => new DriveError('auth', 'La sesión de Google ha caducado (en el navegador dura una hora). Vuelve a iniciar sesión.');

export const googleTokens: TokenSource = {
  async get() {
    const s = read();
    if (!s) throw expired();
    return s.token;
  },
  // En el navegador no hay forma de renovar el permiso sin que el usuario vuelva a pasar por Google.
  async refresh() {
    save(null);
    throw expired();
  },
};
