import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCloudAsked, setCloudAsked } from '@/db/settings';
import { Button, Card } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';
import { currentAccount, googleStatus, signIn } from './auth';
import { errorText } from './errors';
import { ago } from './relative';
import { onSyncStatus, syncIfNeeded, syncStatus, type SyncStatus } from './sync';

/**
 * Estado del guardado en la nube, en la pantalla Hoy.
 * - La primera vez invita a iniciar sesión, con «Ahora no» a mano: la app funciona igual sin cuenta.
 * - Después, una línea discreta dice si todo está guardado, si hay cambios pendientes o si hay que decidir algo.
 * No pinta nada donde Google no está disponible (Expo Go): ahí manda el aviso de la copia manual.
 */
export function CloudStatus() {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<SyncStatus>(syncStatus);
  const [asked, setAsked] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCloudAsked(db).then(setAsked);
    return onSyncStatus(setStatus);
  }, [db]);

  if (googleStatus() !== 'ready') return null;

  const dismiss = async () => {
    await setCloudAsked(db);
    setAsked(true);
  };

  const start = async () => {
    try {
      setBusy(true);
      await setCloudAsked(db);
      const account = await signIn();
      if (account) await syncIfNeeded(db, { checkRemote: true });
    } catch (e) {
      Alert.alert('No se pudo iniciar sesión', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (currentAccount() == null) {
    if (!asked) {
      return (
        <Card style={{ gap: space.sm, borderColor: colors.accent }}>
          <Text style={type.title}>Guarda tu avance en la nube</Text>
          <Text style={type.caption}>
            Ahora todo está solo en este dispositivo. Con tu cuenta de Google se guarda solo en una carpeta privada de tu Drive, y lo recuperas si
            cambias de móvil. La app funciona igual sin conexión: sube los cambios cuando la haya.
          </Text>
          <Button label="Iniciar sesión con Google" icon="logo-google" onPress={start} disabled={busy} />
          <Button label="Ahora no" variant="ghost" onPress={dismiss} disabled={busy} />
        </Card>
      );
    }
    return <Line icon="cloud-offline-outline" tint={colors.warn} text="Sin copia en la nube. Inicia sesión con Google en Perfil." onPress={() => router.push('/perfil')} />;
  }

  switch (status.state) {
    case 'pendiente':
      return <Line icon="cloud-upload-outline" tint={colors.warn} text="Cambios sin subir. Se guardarán en cuanto haya conexión." />;
    case 'conflicto':
      return (
        <Line
          icon="alert-circle-outline"
          tint={colors.warn}
          text="En Drive hay otra copia que no es de este dispositivo. Elige en Perfil cuál vale."
          onPress={() => router.push('/perfil')}
        />
      );
    case 'caducada':
      return <Line icon="key-outline" tint={colors.warn} text="La sesión de Google ha caducado. Vuelve a iniciarla en Perfil." onPress={() => router.push('/perfil')} />;
    case 'guardado':
      return <Line icon="cloud-done-outline" tint={colors.success} text={`Guardado en Drive ${ago(status.at)}`.trim() + '.'} />;
    default:
      return <Line icon="cloud-outline" tint={colors.faint} text="Con sesión de Google. Se guardará al apuntar algo." />;
  }
}

function Line({ icon, tint, text, onPress }: { icon: keyof typeof Ionicons.glyphMap; tint: string; text: string; onPress?: () => void }) {
  const body = (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[type.caption, { flex: 1 }]}>{text}</Text>
      {onPress && <Ionicons name="chevron-forward" size={14} color={colors.faint} />}
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={text}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={({ pressed }) => [styles.touch, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Alto de toque suficiente aunque la línea sea pequeña.
  touch: { minHeight: 44, justifyContent: 'center' },
});
