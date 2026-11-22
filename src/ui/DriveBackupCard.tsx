import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { backupSummary, importBackup } from '@/db/backup';
import { exportBackup } from '@/db/backup';
import { getDriveLastBackup, setDriveFingerprint, setDriveLastBackup } from '@/db/settings';
import { formatShort, toISODate } from '@/domain/dates';
import { currentAccount, googleStatus, signIn, signOut, type GoogleAccount } from '@/google/auth';
import { fingerprint, localHasData } from '@/google/driveBackup';
import { errorText, needsSignIn } from '@/google/errors';
import { backupNow, loadRemoteBackup, onDriveBackup, remoteBackupDate, syncIfNeeded } from '@/google/sync';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card } from './components';
import { colors, space, type } from './theme';

/** «16 nov, 09:05» en hora local a partir de la fecha ISO que da Drive. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatShort(toISODate(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Copia de seguridad en la carpeta privada de la app en Google Drive. */
export function DriveBackupCard({ onRestored }: { onRestored?: () => void }) {
  const db = useSQLiteContext();
  const [status] = useState(googleStatus);
  const [account, setAccount] = useState<GoogleAccount | null>(currentAccount);
  /** Última copia guardada o restaurada desde este móvil. */
  const [last, setLast] = useState<string | null>(null);
  /** Copia que hay en Drive cuando este móvil todavía no ha guardado ni restaurado ninguna. */
  const [remote, setRemote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDriveLastBackup(db).then((mine) => {
      setLast(mine);
      // Con sesión pero sin copia propia, se mira si ya hay una en Drive (de otro móvil); sin red, no pasa nada.
      if (!mine && currentAccount()) {
        remoteBackupDate()
          .then(setRemote)
          .catch(() => {});
      }
    });
    return onDriveBackup((savedAt) => {
      setLast(savedAt);
      setRemote(null);
    });
  }, [db]);

  /** Muestra el error; si la sesión ya no vale, vuelve al estado «sin sesión». */
  const fail = async (e: unknown) => {
    setNote(null);
    setError(errorText(e));
    if (needsSignIn(e)) {
      await signOut().catch(() => {});
      setAccount(null);
    }
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      await task();
    } catch (e) {
      await fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = () =>
    run(async () => {
      const signed = await signIn();
      if (!signed) {
        setNote('Inicio de sesión cancelado. Si no llegaste a ver tus cuentas de Google, revisa la configuración (docs/GOOGLE.md).');
        return;
      }
      setAccount(signed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const inDrive = await remoteBackupDate();
      const mine = await getDriveLastBackup(db);
      if (inDrive && !mine) {
        setRemote(inDrive);
        setNote('Ya hay una copia en Drive. Restáurala, o guarda la de este móvil para sustituirla.');
      } else if (!inDrive && (await localHasData(db))) {
        await backupNow(db);
        setNote('Sesión iniciada y primera copia guardada en Drive.');
      } else {
        setNote('Sesión iniciada.');
      }
    });

  const save = () =>
    run(async () => {
      await backupNow(db);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNote('Copia guardada en Drive.');
    });

  const doBackup = () => {
    // Un móvil que aún no ha guardado ni restaurado nada no sustituye la copia de Drive sin preguntar.
    if (!last && remote) {
      Alert.alert(
        '¿Sustituir la copia de Drive?',
        `En Drive hay una copia del ${formatDateTime(remote)}. Si guardas la de este móvil, la anterior se pierde.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sustituir', style: 'destructive', onPress: save },
        ],
      );
      return;
    }
    save();
  };

  const doRestore = () =>
    run(async () => {
      const found = await loadRemoteBackup();
      if (!found) {
        setNote('Todavía no hay ninguna copia en Drive.');
        return;
      }
      const s = backupSummary(found.backup);
      Alert.alert(
        '¿Restaurar la copia de Drive?',
        `Copia del ${formatDateTime(found.modifiedTime)}: ${s.sessions} sesiones y ${s.measurements} mediciones.\n\nSustituye TODOS los datos actuales de la app. No se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackup(db, found.backup);
                // Los ajustes restaurados traen la fecha del móvil anterior: se apunta la de esta copia.
                await setDriveLastBackup(db, found.modifiedTime);
                await setDriveFingerprint(db, fingerprint(await exportBackup(db)));
                syncIfNeeded(db, { checkRemote: true });
                setLast(found.modifiedTime);
                setRemote(null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                syncReminders(db);
                setNote('Copia restaurada.');
                onRestored?.();
              } catch (e) {
                Alert.alert('No se pudo restaurar', `${errorText(e)}\n\nTus datos no han cambiado.`);
              }
            },
          },
        ],
      );
    });

  const doSignOut = () =>
    run(async () => {
      await signOut();
      setAccount(null);
      setRemote(null);
      setNote('Sesión cerrada. La copia sigue guardada en tu Drive.');
    });

  const shown = last ?? remote;

  return (
    <Card style={{ gap: space.md }}>
      <Text style={type.subtitle}>Copia en Google Drive</Text>

      {status === 'unavailable' && (
        <Text style={type.caption}>
          Disponible en la app instalada. En Expo Go no se puede iniciar sesión con Google; mientras tanto usa «Exportar copia».
        </Text>
      )}

      {status === 'unconfigured' && (
        <Text style={type.caption}>
          Falta configurar Google: crea el proyecto en Google Cloud y pega el ID de cliente web en app.json (expo.extra.google.webClientId).
          Los pasos están en docs/GOOGLE.md.
        </Text>
      )}

      {status === 'ready' && !account && (
        <>
          <Text style={type.caption}>
            Guarda tus datos en una carpeta privada de tu Google Drive: una copia automática cada semana y otra cuando tú quieras. La
            app no puede ver el resto de tu Drive.
          </Text>
          <Button label="Iniciar sesión con Google" icon="logo-google" onPress={doSignIn} disabled={busy} />
        </>
      )}

      {status === 'ready' && account && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name="person-circle-outline" size={22} color={colors.muted} />
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
              {account.email}
            </Text>
          </View>
          <Text style={type.caption}>
            {shown ? `Última copia en Drive: ${formatDateTime(shown)}.` : 'Todavía no hay ninguna copia en Drive.'}
            {last
              ? ' Se guarda sola una vez por semana al abrir la app.'
              : ' La copia semanal automática empieza cuando guardes o restaures la primera desde este móvil.'}{' '}
            Las fotos de progreso no se incluyen.
          </Text>
          <Button label="Guardar copia en Drive" icon="cloud-upload-outline" onPress={doBackup} disabled={busy} />
          <Button label="Restaurar desde Drive" icon="cloud-download-outline" variant="secondary" onPress={doRestore} disabled={busy} />
          <Button label="Cerrar sesión" icon="log-out-outline" variant="ghost" onPress={doSignOut} disabled={busy} />
        </>
      )}

      {busy && <Text style={type.caption}>Conectando con Google…</Text>}
      {note && <Text style={[type.caption, { color: colors.success }]}>{note}</Text>}
      {error && (
        <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>
          {error}
        </Text>
      )}
    </Card>
  );
}
