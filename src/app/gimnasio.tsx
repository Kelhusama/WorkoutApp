import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLastBench, getSessionLog, saveGymSession } from '@/db/repo';
import { syncReminders } from '@/notifications/reminders';
import { formatLong, formatShort, today as getToday } from '@/domain/dates';
import type { Feeling } from '@/domain/progression';
import { estimate1RM } from '@/domain/strength';
import { Button, Card, FeelingPicker, SectionTitle, Stepper } from '@/ui/components';
import { colors, radius, space, type } from '@/ui/theme';

const fmtKg = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

export default function GymScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? getToday();

  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [didBench, setDidBench] = useState(false);
  const [weight, setWeight] = useState(50);
  const [reps, setReps] = useState(5);
  const [last, setLast] = useState<{ date: string; w: number; r: number } | null>(null);

  useEffect(() => {
    (async () => {
      const existing = await getSessionLog(db, date, 'gym');
      const prev = await getLastBench(db);
      if (prev) {
        setLast({ date: prev.date, w: prev.bench_weight, r: prev.bench_reps });
        setWeight(prev.bench_weight);
        setReps(prev.bench_reps);
      }
      if (existing?.status === 'done') {
        setFeeling(existing.feeling);
        if (existing.bench_weight) {
          setDidBench(true);
          setWeight(existing.bench_weight);
          setReps(existing.bench_reps ?? 5);
        }
      }
    })();
  }, [db, date]);

  const save = async () => {
    if (!feeling) return;
    await saveGymSession(db, date, feeling, didBench ? { weight, reps } : null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    router.back();
  };

  const e1rm = estimate1RM(weight, reps);
  const lastE1rm = last ? estimate1RM(last.w, last.r) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.md }}>
      <Text style={type.overline}>{formatLong(date)}</Text>

      <SectionTitle>¿Cómo ha ido?</SectionTitle>
      <FeelingPicker value={feeling} onChange={setFeeling} />

      <SectionTitle>Press de banca</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: didBench }}
          onPress={() => {
            Haptics.selectionAsync();
            setDidBench((b) => !b);
          }}
          style={styles.toggleRow}>
          <Text style={[type.subtitle, { flex: 1 }]}>¿Hoy hiciste press de banca?</Text>
          <View style={[styles.toggle, didBench && { backgroundColor: colors.accent }]}>
            <View style={[styles.knob, didBench && { alignSelf: 'flex-end' }]} />
          </View>
        </Pressable>

        {didBench ? (
          <>
            <Text style={type.caption}>Tu mejor serie de hoy</Text>
            <Stepper value={weight} onChange={setWeight} step={2.5} min={0} suffix=" kg" format={fmtKg} />
            <Stepper value={reps} onChange={setReps} step={1} min={1} suffix=" reps" />
            <View style={styles.e1rm}>
              <Ionicons name="analytics" size={20} color={colors.accent} />
              <Text style={[type.body, { flex: 1 }]}>1RM estimado</Text>
              <Text style={styles.e1rmValue}>{fmtKg(e1rm)} kg</Text>
            </View>
            {lastE1rm !== null && (
              <Text style={type.caption}>
                Último registro: {fmtKg(last!.w)} kg × {last!.r} ({formatShort(last!.date)}) → {fmtKg(lastE1rm)} kg
                {e1rm > lastE1rm ? '  ·  ¡Mejoras!' : ''}
              </Text>
            )}
          </>
        ) : (
          <Text style={type.caption}>
            Si hoy no tocaba, intenta añadir 3 series de 5 al final: es lo que más acelera el camino a 80 kg.
          </Text>
        )}
      </Card>

      <View style={{ marginTop: space.md }}>
        <Button label="Guardar gimnasio" icon="checkmark-circle" onPress={save} disabled={!feeling} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: colors.cardHigh, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  e1rm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  e1rmValue: { fontSize: 20, fontWeight: '800', color: colors.accent },
});
