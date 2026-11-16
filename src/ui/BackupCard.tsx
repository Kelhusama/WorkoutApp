import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { backupSummary, exportBackup, importBackup, parseBackup } from '@/db/backup';
import { formatShort, today } from '@/domain/dates';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card } from './components';
import { colors, space, type } from './theme';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Exportar todos los datos a un archivo y restaurarlos desde uno. */
export function BackupCard({ onRestored }: { onRestored?: () => void }) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const doExport = async () => {
    try {
      setBusy(true);
      const file = new File(Paths.cache, `forja-copia-${today()}.json`);
      file.create({ overwrite: true });
      await file.write(JSON.stringify(await exportBackup(db)));
      if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Guardar copia de Forja' });
      setNote('Copia creada. Guárdala en Drive o envíatela para tenerla fuera del móvil.');
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

  return (
    <Card style={{ gap: space.md }}>
      <Text style={type.subtitle}>Copia de seguridad</Text>
      <Text style={type.caption}>
        Guarda en un archivo tus sesiones, progresión, mediciones, viajes y ajustes. Úsala para cambiar de móvil o al pasar a la app
        instalada. Las fotos de progreso no se incluyen.
      </Text>
      <Button label="Exportar copia" icon="download-outline" variant="secondary" onPress={doExport} disabled={busy} />
      <Button label="Restaurar desde un archivo" icon="refresh-outline" variant="ghost" onPress={doImport} disabled={busy} />
      {note && <Text style={[type.caption, { color: colors.success }]}>{note}</Text>}
    </Card>
  );
}
