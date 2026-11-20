import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Segmented } from './components';
import { colors, radius, space, type, font } from './theme';

const TIMERS = [
  { id: '0', label: 'Ya' },
  { id: '5', label: '5 s' },
  { id: '10', label: '10 s' },
] as const;

/**
 * Cámara a pantalla completa con la foto anterior semitransparente encima,
 * para repetir el mismo encuadre. Devuelve la ruta de la foto hecha.
 */
export function GuidedCamera({
  visible,
  ghostUri,
  onClose,
  onShot,
}: {
  visible: boolean;
  /** Foto anterior de la misma postura, si la hay. */
  ghostUri?: string;
  onClose: () => void;
  onShot: (uri: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [ghost, setGhost] = useState(true);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]['id']>('5');
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) requestPermission();
    if (!visible) {
      setCount(null);
      setReady(false);
    }
  }, [visible, permission, requestPermission]);

  // Cuenta atrás: un segundo cada vez; al llegar a cero, dispara.
  useEffect(() => {
    if (count === null) return;
    if (count > 0) {
      const id = setTimeout(() => {
        Haptics.selectionAsync();
        setCount(count - 1);
      }, 1000);
      return () => clearTimeout(id);
    }
    let cancelled = false;
    (async () => {
      try {
        const shot = await camera.current?.takePictureAsync({ quality: 0.7 });
        if (shot && !cancelled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onShot(shot.uri);
        }
      } finally {
        if (!cancelled) setCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [count, onShot]);

  const counting = count !== null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {permission?.granted ? (
          <>
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} mirror={facing === 'front'} onCameraReady={() => setReady(true)} />
            {ghost && ghostUri && <Image source={{ uri: ghostUri }} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} contentFit="cover" pointerEvents="none" />}
            {counting && count > 0 && (
              <View style={styles.count} pointerEvents="none" accessibilityLiveRegion="assertive">
                <Text style={styles.countText}>{count}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.noPerm}>
            <Ionicons name="camera-outline" size={40} color={colors.muted} />
            <Text style={[type.subtitle, { textAlign: 'center' }]}>Hace falta permiso para usar la cámara</Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>
              {permission?.canAskAgain === false
                ? 'Actívalo en los ajustes del móvil, o cierra y elige la foto de la galería.'
                : 'Solo se usa para tus fotos de progreso, que no salen del móvil.'}
            </Text>
            {permission?.canAskAgain !== false && <Button label="Dar permiso" icon="camera" onPress={() => requestPermission()} />}
          </View>
        )}

        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar la cámara" onPress={onClose} style={styles.round}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[type.caption, styles.tip]}>
            {ghostUri
              ? 'Colócate encima de tu foto anterior: misma distancia, misma altura y misma luz.'
              : 'Primera foto: apoya el móvil siempre en el mismo sitio y marca dónde te pones.'}
          </Text>
        </View>

        {permission?.granted && (
          <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Segmented label="Temporizador" options={TIMERS} value={timer} onChange={setTimer} />
              </View>
              {ghostUri && (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: ghost }}
                  accessibilityLabel="Mostrar la foto anterior encima"
                  onPress={() => setGhost((g) => !g)}
                  style={[styles.round, ghost && { backgroundColor: colors.accent }]}>
                  <Ionicons name="layers" size={22} color={ghost ? colors.onAccent : colors.text} />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={facing === 'back' ? 'Cambiar a la cámara frontal' : 'Cambiar a la cámara trasera'}
                onPress={() => {
                  setReady(false);
                  setFacing((f) => (f === 'back' ? 'front' : 'back'));
                }}
                style={styles.round}>
                <Ionicons name="camera-reverse" size={22} color={colors.text} />
              </Pressable>
            </View>
            {counting ? (
              <Button label="Cancelar" variant="secondary" icon="close-circle-outline" onPress={() => setCount(null)} />
            ) : (
              <Button
                label={!ready ? 'Preparando la cámara…' : timer === '0' ? 'Hacer la foto' : `Hacer la foto en ${timer} s`}
                icon="camera"
                onPress={() => setCount(Number(timer))}
                disabled={!ready}
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  noPerm: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  tip: { flex: 1, color: colors.text, backgroundColor: 'rgba(11,27,43,0.75)', padding: space.sm, borderRadius: radius.md, overflow: 'hidden' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, gap: space.sm, padding: space.md, backgroundColor: 'rgba(11,27,43,0.85)' },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,54,83,0.9)' },
  count: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 120, ...font.display, color: '#fff', textShadowColor: '#000', textShadowRadius: 12 },
});
