import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getReminderSettings, saveReminderSettings } from '@/db/settings';
import { DEFAULT_REMINDERS, MAX_REMINDERS_PER_DAY, shiftTime, type ReminderSettings } from '@/domain/reminders';
import { ensurePermission, syncReminders } from '@/notifications/reminders';
import { Card } from './components';
import { colors, radius, space, type } from './theme';

/** Ajustes de avisos: se guardan al momento y reprograman las notificaciones. */
export function RemindersSettings() {
  const db = useSQLiteContext();
  const [s, setS] = useState<ReminderSettings | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    getReminderSettings(db).then(setS);
  }, [db]);

  const update = async (next: ReminderSettings) => {
    setS(next);
    await saveReminderSettings(db, next);
    if (next.enabled) setDenied(!(await ensurePermission()));
    syncReminders(db);
  };

  if (!s) return null;

  return (
    <Card style={{ gap: space.md }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: s.enabled }}
        onPress={() => update({ ...s, enabled: !s.enabled })}
        style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={type.subtitle}>Avisos de sesión en casa</Text>
          <Text style={type.caption}>Hasta {MAX_REMINDERS_PER_DAY} al día. Se paran al registrar la sesión o pulsar «Hoy no».</Text>
        </View>
        <View style={[styles.toggle, s.enabled && { backgroundColor: colors.accent }]}>
          <View style={[styles.knob, s.enabled && { alignSelf: 'flex-end' }]} />
        </View>
      </Pressable>

      {s.enabled &&
        s.times.map((t, i) => (
          <View key={i} style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color={colors.muted} />
            <Text style={[type.body, { flex: 1 }]}>Aviso {i + 1}</Text>
            <Pressable
              accessibilityLabel={`Aviso ${i + 1} media hora antes`}
              onPress={() => update({ ...s, times: s.times.map((x, j) => (j === i ? shiftTime(x, -30) : x)) })}
              style={styles.btn}>
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.time}>{t}</Text>
            <Pressable
              accessibilityLabel={`Aviso ${i + 1} media hora después`}
              onPress={() => update({ ...s, times: s.times.map((x, j) => (j === i ? shiftTime(x, 30) : x)) })}
              style={styles.btn}>
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        ))}

      {s.enabled && s.times.join() !== DEFAULT_REMINDERS.times.join() && (
        <Pressable onPress={() => update({ ...s, times: DEFAULT_REMINDERS.times })}>
          <Text style={[type.caption, { textAlign: 'center' }]}>Volver a 09:00 · 10:00 · 12:00</Text>
        </Pressable>
      )}

      {denied && (
        <Text style={[type.caption, { color: colors.danger }]}>
          El móvil no permite notificaciones a esta app. Actívalas en Ajustes de Android → Aplicaciones → Expo Go (o la app) → Notificaciones.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: colors.cardHigh, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { width: 56, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
});
