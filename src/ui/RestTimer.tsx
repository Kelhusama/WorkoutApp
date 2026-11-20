import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { ensurePermission } from '@/notifications/reminders';
import { colors, radius, space, font } from './theme';

const PRESETS = [45, 60, 90, 120];
const NOTIFICATION_ID = 'descanso';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const label = (s: number) => (s % 60 === 0 ? `${s / 60} min` : s < 60 ? `${s} s` : mmss(s));

/** Programa el aviso de fin de descanso, por si la app queda en segundo plano. */
export async function scheduleEnd(seconds: number) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
    if (!(await ensurePermission())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: { title: 'Descanso terminado', body: 'A por la siguiente serie.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'recordatorios' },
    });
  } catch {
    // Sin permiso o sin soporte: el temporizador sigue funcionando en pantalla.
  }
}

export function cancelEnd() {
  if (Platform.OS !== 'web') Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
}

/**
 * Temporizador de descanso entre series, fijo al pie de la sesión.
 * Avisa con vibración y, si la app está en segundo plano, con una notificación.
 */
export function RestTimer({ bottomInset = 0 }: { bottomInset?: number }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [total, setTotal] = useState(90);
  const done = useRef(false);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !done.current) {
        done.current = true;
        Vibration.vibrate([0, 400, 200, 400]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // El aviso ya se ve en pantalla: la notificación solo hace falta en segundo plano.
        cancelEnd();
        setEndsAt(null);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  useEffect(() => cancelEnd, []);

  const start = (seconds: number) => {
    Haptics.selectionAsync();
    done.current = false;
    setTotal(seconds);
    setLeft(seconds);
    setEndsAt(Date.now() + seconds * 1000);
    scheduleEnd(seconds);
  };

  const add = (seconds: number) => {
    if (endsAt === null) return;
    const next = endsAt + seconds * 1000;
    setEndsAt(next);
    setTotal((t) => t + seconds);
    scheduleEnd(Math.max(1, Math.round((next - Date.now()) / 1000)));
  };

  const stop = () => {
    cancelEnd();
    done.current = true;
    setEndsAt(null);
    setLeft(0);
  };

  const running = endsAt !== null;

  return (
    <View style={[styles.bar, { paddingBottom: space.sm + bottomInset }]}>
      {running ? (
        <>
          <View style={[styles.progress, { width: `${Math.min(100, (left / total) * 100)}%` }]} />
          <Ionicons name="timer" size={22} color={colors.accent} />
          <Text style={styles.time} accessibilityLabel={`Quedan ${left} segundos de descanso`}>
            {mmss(left)}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => add(15)} style={styles.chip} accessibilityLabel="Añadir 15 segundos">
            <Text style={styles.chipLabel}>+15 s</Text>
          </Pressable>
          <Pressable onPress={stop} style={[styles.chip, { backgroundColor: colors.accentSoft }]} accessibilityLabel="Parar el descanso">
            <Text style={[styles.chipLabel, { color: colors.accent }]}>Parar</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Ionicons name="timer-outline" size={20} color={colors.muted} />
          <Text style={styles.caption}>Descanso</Text>
          <View style={{ flex: 1 }} />
          {PRESETS.map((s) => (
            <Pressable key={s} onPress={() => start(s)} style={styles.chip} accessibilityLabel={`Descanso de ${label(s)}`}>
              <Text style={styles.chipLabel}>{label(s)}</Text>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    overflow: 'hidden',
  },
  progress: { position: 'absolute', top: 0, left: 0, height: 3, backgroundColor: colors.accent },
  time: { fontSize: 26, ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 14, ...font.w600, color: colors.muted },
  chip: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: { fontSize: 14, ...font.w700, color: colors.text },
});
