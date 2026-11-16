import { usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

/**
 * Pregunta antes de salir de una pantalla con cambios sin guardar (botón atrás, gesto o flecha).
 * Devuelve una función para llamar justo antes de salir tras guardar, que desactiva la pregunta.
 */
export function useUnsavedGuard(dirty: boolean, what = 'lo que has escrito'): () => void {
  const [leaving, setLeaving] = useState(false);
  return usePreventRemove(dirty && !leaving, ({ repeat }) => {
    Alert.alert('¿Salir sin guardar?', `Perderás ${what}.`, [
      { text: 'Seguir aquí', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          repeat();
        },
      },
    ]);
  });
}
