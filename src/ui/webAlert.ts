import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * En el navegador, `Alert.alert` no hace nada: los avisos y las confirmaciones no aparecerían.
 * Aquí se sustituye por los diálogos del propio navegador. En el móvil no cambia nada.
 * Con varios botones, «Aceptar» ejecuta el primero que no sea cancelar.
 */
export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const cancel = buttons?.find((b) => b.style === 'cancel');
    const action = buttons?.find((b) => b.style !== 'cancel');
    if (!buttons || buttons.length < 2) {
      window.alert(text);
      (action ?? cancel)?.onPress?.();
      return;
    }
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}
