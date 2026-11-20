import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getReminderSettings, saveReminderSettings } from '@/db/settings';
import { DEFAULT_REMINDERS, MAX_REMINDERS_PER_DAY, shiftTime, type ReminderSettings } from '@/domain/reminders';
import { ensurePermission, syncReminders } from '@/notifications/reminders';
import { Card, ToggleRow } from './components';
import { colors, radius, space, type, font } from './theme';

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
      <ToggleRow
        icon="notifications-outline"
        title="Avisos de sesión en casa"
        detail={`Hasta ${MAX_REMINDERS_PER_DAY} al día. Se paran al registrar la sesión o al marcar «Hoy no entreno».`}
        value={s.enabled}
        onChange={(v) => update({ ...s, enabled: v })}
      />

      {s.enabled &&
        s.times.map((t, i) => (
          <View key={i} style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color={colors.muted} />
            <Text style={[type.body, { flex: 1 }]}>Aviso {i + 1}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Aviso ${i + 1}: media hora antes`}
              onPress={() => update({ ...s, times: s.times.map((x, j) => (j === i ? shiftTime(x, -30) : x)) })}
              style={styles.btn}>
              <Ionicons name="remove" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.time}>{t}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Aviso ${i + 1}: media hora después`}
              onPress={() => update({ ...s, times: s.times.map((x, j) => (j === i ? shiftTime(x, 30) : x)) })}
              style={styles.btn}>
              <Ionicons name="add" size={18} color={colors.text} />
            </Pressable>
          </View>
        ))}

      {s.enabled && s.times.join() !== DEFAULT_REMINDERS.times.join() && (
        <Pressable accessibilityRole="button" onPress={() => update({ ...s, times: DEFAULT_REMINDERS.times })} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>Volver a 09:00 · 10:00 · 12:00</Text>
        </Pressable>
      )}

      {denied && (
        <Text style={[type.caption, { color: colors.danger }]}>
          El móvil no deja que esta app envíe notificaciones. Actívalas en los ajustes del teléfono, en el apartado de notificaciones de la app.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  btn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: { width: 56, textAlign: 'center', fontSize: 17, ...font.w800, color: colors.text, fontVariant: ['tabular-nums'] },
});
