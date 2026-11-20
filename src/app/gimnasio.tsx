import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLastBench, getSessionLog, saveGymSession } from '@/db/repo';
import { getBenchSeries } from '@/db/stats';
import { syncReminders } from '@/notifications/reminders';
import { GYM_WORK, RESERVE_OPTIONS, benchAdvice, parseGymWork, type BenchAdvice, type GymWork, type Reserve } from '@/domain/coach';
import { formatLong, formatShort, today as getToday } from '@/domain/dates';
import { BAR_KG, platesPerSide, warmupSets } from '@/domain/gymTools';
import type { Feeling } from '@/domain/progression';
import { estimate1RM } from '@/domain/strength';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Button, Card, FeelingPicker, SectionTitle, Segmented, Stepper, ToggleRow } from '@/ui/components';
import { colors, radius, space, type, font } from '@/ui/theme';

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
  const [reserve, setReserve] = useState<Reserve | null>(null);
  // Qué se ha trabajado hoy: sirve para no cargar los mismos músculos al día siguiente.
  const [work, setWork] = useState<GymWork[]>([]);
  // Lo que propone el entrenador para hoy, según el último día de banca.
  const [advice, setAdvice] = useState<BenchAdvice | null>(null);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useUnsavedGuard(dirty, 'el registro del gimnasio');

  useEffect(() => {
    (async () => {
      const existing = await getSessionLog(db, date, 'gym');
      const prev = await getLastBench(db, date);
      if (prev) {
        const a = benchAdvice({ weight: prev.bench_weight, reps: prev.bench_reps, reserve: prev.bench_reserve });
        setLast({ date: prev.date, w: prev.bench_weight, r: prev.bench_reps });
        setAdvice(a);
        // Se precarga lo que propone el entrenador; se corrige con lo que salga de verdad.
        setWeight(a.weight);
        setReps(a.reps);
      }
      if (existing?.status === 'done') {
        setFeeling(existing.feeling);
        setWork(parseGymWork(existing.gym_work));
        if (existing.bench_weight) {
          setDidBench(true);
          setWeight(existing.bench_weight);
          setReps(existing.bench_reps ?? 5);
          setReserve(existing.bench_reserve);
        }
      }
    })();
  }, [db, date]);

  const save = async () => {
    if (!feeling) return;
    // Mejor 1RM estimado de otros días, para avisar si hoy se bate.
    const previous = (await getBenchSeries(db)).filter((p) => p.date !== date).map((p) => p.value);
    const best = previous.length ? Math.max(...previous) : null;
    await saveGymSession(db, date, feeling, didBench ? { weight, reps, reserve } : null, work);
    if (didBench && best !== null && estimate1RM(weight, reps) > best) {
      Alert.alert('¡Récord de banca!', `1RM estimado: ${fmtKg(estimate1RM(weight, reps))} kg (antes ${fmtKg(best)} kg).`);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    allowLeave();
    router.back();
  };

  const e1rm = estimate1RM(weight, reps);
  const plates = platesPerSide(weight);
  const lastE1rm = last ? estimate1RM(last.w, last.r) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.md }}>
      <Text style={type.overline}>{formatLong(date)}</Text>

      <SectionTitle>¿Cómo ha ido?</SectionTitle>
      <FeelingPicker
        value={feeling}
        onChange={(v) => {
          setDirty(true);
          setFeeling(v);
        }}
      />

      <SectionTitle>¿Qué has trabajado?</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <View style={styles.works}>
          {GYM_WORK.map((w) => {
            const on = work.includes(w.id);
            return (
              <Pressable
                key={w.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={w.label}
                onPress={() => {
                  Haptics.selectionAsync();
                  setDirty(true);
                  setWork(on ? work.filter((x) => x !== w.id) : [...work, w.id]);
                }}
                style={[styles.work, on && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? colors.onAccent : colors.muted} />
                <Text style={[styles.workLabel, on && { color: colors.onAccent }]}>{w.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={type.caption}>
          Opcional. Tirón son jalones, remos y dominadas; empuje, banca, press y fondos. Si marcas tirón, mañana te avisaré antes de las dominadas.
        </Text>
      </Card>

      <SectionTitle>Press de banca</SectionTitle>
      <Card style={{ gap: space.md }}>
        <ToggleRow
          title="¿Hoy hiciste press de banca?"
          value={didBench}
          onChange={(v) => {
            setDirty(true);
            setDidBench(v);
          }}
        />

        {didBench ? (
          <>
            {advice && (
              <View style={styles.tools} accessible accessibilityLabel={`El entrenador propone ${fmtKg(advice.weight)} kilos por ${advice.reps}. ${advice.reason}`}>
                <Text style={type.subtitle}>
                  Hoy: 3 series de {advice.reps} con {fmtKg(advice.weight)} kg
                </Text>
                <Text style={type.caption}>{advice.reason}</Text>
              </View>
            )}
            <Text style={type.caption}>Tu mejor serie de hoy</Text>
            <Stepper
              label="peso"
              value={weight}
              onChange={(v) => {
                setDirty(true);
                setWeight(v);
              }}
              step={2.5}
              min={0}
              suffix=" kg"
              format={fmtKg}
            />
            <Stepper
              label="repeticiones"
              value={reps}
              onChange={(v) => {
                setDirty(true);
                setReps(v);
              }}
              step={1}
              min={1}
              suffix=" reps"
            />
            <Text style={type.overline}>En esa serie, ¿cuántas más habrías podido hacer?</Text>
            <Segmented
              label="Lo que te quedaba en la mejor serie"
              options={RESERVE_OPTIONS}
              value={reserve === null ? null : (String(reserve) as `${Reserve}`)}
              onChange={(v) => {
                setDirty(true);
                setReserve(Number(v) as Reserve);
              }}
            />
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
            <View style={styles.tools}>
              <Text style={type.subtitle}>Para montar {fmtKg(weight)} kg</Text>
              <Text style={type.caption}>
                Discos por lado (barra de {BAR_KG} kg):{' '}
                <Text style={styles.toolValue}>{plates.plates.length ? plates.plates.map(fmtKg).join(' + ') : 'solo la barra'}</Text>
                {plates.rest > 0 ? ` · sobran ${fmtKg(plates.rest)} kg que no se pueden montar` : ''}
              </Text>
              <Text style={type.caption}>
                Calentamiento:{' '}
                <Text style={styles.toolValue}>{warmupSets(weight).map((s) => `${fmtKg(s.weight)} × ${s.reps}`).join('  →  ')}</Text>
              </Text>
            </View>
          </>
        ) : (
          <Text style={type.caption}>
            Si hoy no tocaba, intenta añadir 3 series de 5 al final: es lo que más acelera el camino a 80 kg.
          </Text>
        )}
      </Card>

      <View style={{ marginTop: space.md }}>
        {!feeling && <Text style={[type.caption, { marginBottom: space.sm }]}>Elige cómo ha ido para poder guardar.</Text>}
        <Button label="Guardar gimnasio" icon="checkmark-circle" onPress={save} disabled={!feeling} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  works: { flexDirection: 'row', gap: space.sm },
  work: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardHigh,
  },
  workLabel: { fontSize: 14, ...font.w700, color: colors.muted },
  e1rm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  tools: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.cardHigh },
  toolValue: { color: colors.text, ...font.w700 },
  e1rmValue: { fontSize: 20, ...font.display, color: colors.accent },
});
