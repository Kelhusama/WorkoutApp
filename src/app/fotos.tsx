import Ionicons from '@expo/vector-icons/Ionicons';
import { Directory, File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { addPhoto, deletePhoto, getPhotos, type PhotoPose, type ProgressPhoto } from '@/db/stats';
import { formatShort, fromISODate, today } from '@/domain/dates';
import { Button, Card, SectionTitle } from '@/ui/components';
import { colors, radius, space, type } from '@/ui/theme';

const POSES: { id: PhotoPose; label: string }[] = [
  { id: 'frente', label: 'Frente' },
  { id: 'lado', label: 'Lado' },
  { id: 'espalda', label: 'Espalda' },
];

const daysBetween = (a: string, b: string) => Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);

/** Copia la imagen a la carpeta de la app para que no dependa de la galería. */
async function keepCopy(sourceUri: string, pose: PhotoPose): Promise<string> {
  const dir = new Directory(Paths.document, 'fotos');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${today()}-${pose}-${Date.now()}.jpg`);
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

export default function PhotosScreen() {
  const db = useSQLiteContext();
  const [pose, setPose] = useState<PhotoPose>('frente');
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getPhotos(db).then(setPhotos), [db]);
  useEffect(() => {
    load();
  }, [load]);

  const list = photos.filter((p) => p.pose === pose);
  const latest = list[list.length - 1];
  const before = list.find((p) => p.id === beforeId) ?? list[0];
  const canCompare = list.length >= 2 && before && latest && before.id !== latest.id;

  const add = async (source: 'camera' | 'library') => {
    try {
      setBusy(true);
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Sin permiso de cámara', 'Actívalo en los ajustes del móvil o elige la foto de la galería.');
          return;
        }
      }
      const options = { mediaTypes: ['images' as const], quality: 0.7 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const uri = await keepCopy(result.assets[0].uri, pose);
      await addPhoto(db, { date: today(), pose, uri });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e) {
      Alert.alert('No se pudo guardar la foto', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (p: ProgressPhoto) =>
    Alert.alert('¿Borrar esta foto?', `${formatShort(p.date)} · no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deletePhoto(db, p.id);
          try {
            new File(p.uri).delete();
          } catch {
            // El archivo ya no estaba: no pasa nada.
          }
          load();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <View style={styles.segment}>
        {POSES.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: pose === p.id }}
            onPress={() => {
              setPose(p.id);
              setBeforeId(null);
            }}
            style={[styles.segmentItem, pose === p.id && { backgroundColor: colors.accent }]}>
            <Text style={[styles.segmentLabel, pose === p.id && { color: '#fff' }]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {canCompare ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {[before, latest].map((p, i) => (
              <View key={p.id} style={{ flex: 1, gap: 4 }}>
                <Image source={{ uri: p.uri }} style={styles.compare} contentFit="cover" />
                <Text style={[type.caption, { textAlign: 'center' }]}>
                  {i === 0 ? 'Antes' : 'Ahora'} · {formatShort(p.date)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {daysBetween(before.date, latest.date)} días de diferencia. Toca otra foto de abajo para cambiar el «antes».
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={type.caption}>
            {list.length === 0
              ? 'Aún no hay fotos de esta postura. Hazlas siempre igual: misma luz, mismo sitio y a la misma hora.'
              : 'Con una segunda foto podrás comparar el antes y el ahora.'}
          </Text>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Hacer foto" icon="camera" onPress={() => add('camera')} disabled={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="De la galería" variant="secondary" icon="images" onPress={() => add('library')} disabled={busy} />
        </View>
      </View>

      {list.length > 0 && (
        <>
          <SectionTitle>Todas ({list.length})</SectionTitle>
          <View style={styles.grid}>
            {[...list].reverse().map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setBeforeId(p.id)}
                onLongPress={() => remove(p)}
                accessibilityLabel={`Foto del ${formatShort(p.date)}`}
                style={[styles.thumbWrap, before?.id === p.id && canCompare && { borderColor: colors.accent }]}>
                <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                <Text style={styles.thumbDate}>{formatShort(p.date)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            <Ionicons name="information-circle-outline" size={13} color={colors.muted} /> Mantén pulsada una foto para borrarla. Las fotos solo se guardan en tu móvil.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentLabel: { fontSize: 15, fontWeight: '700', color: colors.muted },
  compare: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.cardHigh },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thumbWrap: { width: '31.5%', borderRadius: radius.sm, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.cardHigh },
  thumbDate: { fontSize: 11, color: colors.muted, textAlign: 'center', paddingVertical: 3 },
});
