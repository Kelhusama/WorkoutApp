/** Errores de Google (inicio de sesión y Drive) con mensajes para mostrar tal cual al usuario. */

export type DriveErrorKind =
  /** Token caducado o revocado: hay que volver a iniciar sesión. */
  | 'auth'
  /** Drive rechaza la petición: API sin activar, permiso sin conceder o cuota. */
  | 'permission'
  /** Sin conexión o la petición no llegó a Google. */
  | 'network'
  /** Cualquier otra respuesta de error de Drive. */
  | 'http';

export class DriveError extends Error {
  kind: DriveErrorKind;
  status?: number;

  constructor(kind: DriveErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'DriveError';
    this.kind = kind;
    this.status = status;
  }
}

export const needsSignIn = (e: unknown): boolean => e instanceof DriveError && e.kind === 'auth';

/** Mensaje en español para los códigos de error de la librería de inicio de sesión. */
export function signInErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'DEVELOPER_ERROR':
      return 'Google no reconoce esta app. Revisa en Google Cloud el ID de cliente web, el nombre del paquete y la huella SHA-1 (docs/GOOGLE.md).';
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'Hacen falta los Servicios de Google Play actualizados en este móvil.';
    case 'SIGN_IN_REQUIRED':
      return 'La sesión de Google ha caducado. Vuelve a iniciar sesión.';
    case 'SIGN_IN_CANCELLED':
      return 'Sin el permiso de Google Drive no se puede guardar la copia.';
    case 'IN_PROGRESS':
      return 'Hay otra operación de Google en marcha. Espera un momento e inténtalo de nuevo.';
    case 'ONE_TAP_START_FAILED':
      return `No se pudo completar el inicio de sesión de Google. ${fallback}`.trim();
    default:
      return fallback;
  }
}

/** Texto de cualquier error para una alerta. */
export function errorText(e: unknown): string {
  if (e instanceof DriveError) return e.message;
  if (e && typeof e === 'object') {
    const { code, message } = e as { code?: unknown; message?: unknown };
    const text = typeof message === 'string' ? message : String(e);
    return signInErrorMessage(typeof code === 'string' ? code : undefined, text);
  }
  return String(e);
}
