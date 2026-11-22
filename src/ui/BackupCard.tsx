import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';

import { backupSummary, exportBackup, importBackup, parseBackup } from '@/db/backup';
import { getLastExport, saveLastExport } from '@/db/settings';
import { listSnapshots, readSnapshot, type Snapshot } from '@/db/snapshots';
import { formatLong, formatShort, today } from '@/domain/dates';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card } from './components';
import { colors, space, type } from './theme';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Exportar todos los datos a un archivo y restaurarlos desde uno. */
export function BackupCard({ onRestored }: { onRestored?: () => void }) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [auto, setAuto] = useState<Snapshot | null>(null);

  useEffect(() => {
    getLastExport(db).then(setLastExport);
    try {
      setAuto(listSnapshots()[0] ?? null);
    } catch {
      setAuto(null);
    }
  }, [db]);

  const doExport = async () => {
    try {
      setBusy(true);
      const file = new File(Paths.cache, `forja-copia-${today()}.json`);
      file.create({ overwrite: true });
      await file.write(JSON.stringify(await exportBackup(db)));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Guardar copia de Forja del Canario' });
      // Android no dice si el archivo se llegó a guardar o se cerró el menú sin más: se pregunta.
      // Solo se da por hecha la copia si el usuario lo confirma.
      setNote(null);
      Alert.alert('¿Ha quedado guardada la copia?', 'Si cerraste el menú sin enviarla a ningún sitio, contesta que no: no cuenta como copia.', [
        {
          text: 'No, la cancelé',
          style: 'cancel',
          onPress: () => setNote('No se ha apuntado ninguna copia. Tus datos siguen solo en este móvil.'),
        },
        {
          text: 'Sí, guardada',
          onPress: async () => {
            await saveLastExport(db, today());
            setLastExport(today());
            setNote('Copia apuntada. Si puedes, comprueba que el archivo está donde lo enviaste.');
          },
        },
      ]);
    } catch (e) {
      Alert.alert('No se pudo crear la copia', message(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    try {
      setBusy(true);
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const backup = parseBackup(await new File(picked.assets[0].uri).text());
      const s = backupSummary(backup);
      Alert.alert(
        '¿Restaurar esta copia?',
        `Copia del ${formatShort(s.date)}: ${s.sessions} sesiones y ${s.measurements} mediciones.\n\nSustituye TODOS los datos actuales de la app. No se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              try {
                await importBackup(db, backup);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                syncReminders(db);
                setNote('Copia restaurada.');
                onRestored?.();
              } catch (e) {
                Alert.alert('No se pudo restaurar', `${message(e)}\n\nTus datos no han cambiado.`);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('No se pudo leer la copia', message(e));
    } finally {
      setBusy(false);
    }
  };

  const restoreAuto = () => {
    if (!auto) return;
    Alert.alert('¿Volver a la copia automática?', `Es del ${formatLong(auto.date).toLowerCase()}.\n\nSustituye TODOS los datos actuales de la app. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        style: 'destructive',
        onPress: async () => {
          try {
            await importBackup(db, await readSnapshot(auto));
            syncReminders(db);
            setNote('Copia automática restaurada.');
            onRestored?.();
          } catch (e) {
            Alert.alert('No se pudo restaurar', `${message(e)}\n\nTus datos no han cambiado.`);
          }
        },
      },
    ]);
  };

  return (
    <Card style={{ gap: space.md }}>
      <Text style={type.subtitle}>Copia de seguridad</Text>
      <Text style={type.caption}>
        Tus datos solo están en este móvil. «Exportar copia» los guarda en un archivo: al pulsarlo, elige Google Drive para tenerlos fuera.
        Hazlo cada semana, y antes de cambiar de móvil o de pasar a la app instalada. Las fotos de progreso no se incluyen.
      </Text>
      <Text style={[type.caption, { color: lastExport ? colors.text : colors.warn }]}>
        {lastExport ? `Última copia fuera del móvil: ${formatLong(lastExport).toLowerCase()}.` : 'Aún no has sacado ninguna copia fuera del móvil.'}
      </Text>
      <Button label="Exportar copia" icon="download-outline" variant="secondary" onPress={doExport} disabled={busy} />
      <Button label="Restaurar desde un archivo" icon="refresh-outline" variant="ghost" onPress={doImport} disabled={busy} />
      {auto && (
        <>
          <Text style={type.caption}>
            Además, la app guarda sola una copia al día dentro del móvil (las últimas 7) y otra antes de cada actualización. Sirven si algo se
            estropea, no si pierdes el móvil. La más reciente es del {formatLong(auto.date).toLowerCase()}.
          </Text>
          <Button label="Volver a la última copia automática" icon="time-outline" variant="ghost" onPress={restoreAuto} disabled={busy} />
        </>
      )}
      {note && <Text style={[type.caption, { color: note.startsWith('No se ha apuntado') ? colors.warn : colors.success }]}>{note}</Text>}
    </Card>
  );
}
