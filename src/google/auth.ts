import Constants from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';

import { DRIVE_SCOPE, readWebClientId } from './config';
import type { TokenSource } from './driveBackup';
import { DriveError } from './errors';

/**
 * Inicio de sesión de Google con `react-native-nitro-google-signin` (Credential Manager de Android).
 *
 * La librería lleva código nativo que NO existe en Expo Go, así que nunca se importa arriba:
 * se carga con `require` la primera vez que hace falta y solo si el módulo nativo está presente.
 * Este es el único archivo que la toca.
 */

type Lib = typeof import('react-native-nitro-google-signin');

let lib: Lib | null | undefined;
let configured = false;

function load(): Lib | null {
  if (lib !== undefined) return lib;
  lib = null;
  // La app es solo Android; en iOS haría falta además un esquema de URL en la configuración nativa.
  if (Platform.OS !== 'android') return lib;
  try {
    // En Expo Go no está el módulo nativo de Nitro: se comprueba sin lanzar error antes de cargar nada.
    if (TurboModuleRegistry.get('NitroModules') == null) return lib;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lib = require('react-native-nitro-google-signin') as Lib;
  } catch {
    lib = null;
  }
  return lib;
}

const webClientId = () => readWebClientId(Constants.expoConfig?.extra);

/**
 * - `unavailable`: no hay módulo nativo (Expo Go o una compilación anterior a añadir Google).
 * - `unconfigured`: falta el ID de cliente web en app.json.
 * - `ready`: se puede iniciar sesión.
 */
export type GoogleStatus = 'unavailable' | 'unconfigured' | 'ready';

export function googleStatus(): GoogleStatus {
  if (!load()) return 'unavailable';
  return webClientId() ? 'ready' : 'unconfigured';
}

/** La librería lista para usar; lanza un error legible si no se puede. */
function ready(): Lib['GoogleOneTapSignIn'] {
  const l = load();
  const id = webClientId();
  if (!l) throw new Error('El inicio de sesión de Google solo está disponible en la app instalada.');
  if (!id) throw new Error('Falta el ID de cliente web de Google en app.json (docs/GOOGLE.md).');
  if (!configured) {
    // Sin `scopes` aquí: el permiso de Drive se pide aparte, justo después de elegir la cuenta.
    l.GoogleOneTapSignIn.configure({ webClientId: id });
    configured = true;
  }
  return l.GoogleOneTapSignIn;
}

/** Solo hace falta en el navegador, donde iniciar sesión obliga a salir de la página. Aquí no hace nada. */
export function beforeLeaving(_fn: () => Promise<void>): () => void {
  return () => {};
}

export interface GoogleAccount {
  email: string;
}

/** La cuenta con sesión iniciada y permiso de Drive concedido, o null. No usa la red. */
export function currentAccount(): GoogleAccount | null {
  try {
    if (googleStatus() !== 'ready') return null;
    const user = ready().getCurrentUser();
    if (!user || !user.scopes.includes(DRIVE_SCOPE)) return null;
    return { email: user.user.email ?? 'Cuenta de Google' };
  } catch {
    return null;
  }
}

/**
 * Abre el selector de cuentas de Google y pide el permiso de la carpeta privada de Drive.
 * Devuelve null si el usuario cancela al elegir la cuenta.
 */
export async function signIn(): Promise<GoogleAccount | null> {
  const google = ready();
  const { isSuccessResponse, isNoSavedCredentialFoundResponse, isErrorWithCode, statusCodes } = load()!;
  await google.checkPlayServices();

  // Primero las cuentas que ya autorizaron la app; si no hay, todas las del móvil; y si tampoco, el diálogo completo.
  let res = await google.signIn();
  if (isNoSavedCredentialFoundResponse(res)) res = await google.createAccount();
  if (isNoSavedCredentialFoundResponse(res)) res = await google.presentExplicitSignIn();
  if (!isSuccessResponse(res)) return null;

  try {
    await google.requestScopes([DRIVE_SCOPE]);
  } catch (e) {
    // Sin el permiso de Drive la sesión no sirve de nada: se deshace para no quedar a medias.
    await google.signOut().catch(() => {});
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Sin el permiso de Google Drive no se puede guardar la copia. Inicia sesión de nuevo y acéptalo.');
    }
    throw e;
  }
  return { email: res.data.user.email ?? 'Cuenta de Google' };
}

export async function signOut(): Promise<void> {
  if (googleStatus() !== 'ready') return;
  await ready().signOut();
}

async function accessToken(): Promise<string> {
  const google = ready();
  try {
    return (await google.getTokens()).accessToken;
  } catch (e) {
    const { isErrorWithCode, statusCodes } = load()!;
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED) {
      throw new DriveError('auth', 'La sesión de Google ha caducado. Vuelve a iniciar sesión.');
    }
    throw e;
  }
}

/** Tokens de acceso para Drive; Google los renueva sin mostrar nada mientras el permiso siga concedido. */
export const googleTokens: TokenSource = {
  get: accessToken,
  async refresh(rejected) {
    await ready()
      .clearCachedAccessToken(rejected)
      .catch(() => {});
    return accessToken();
  },
};
