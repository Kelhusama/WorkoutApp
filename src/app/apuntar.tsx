import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addWorkout, getWorkouts } from '@/db/workouts';
import { addDays, formatLong, today as getToday, type ISODate } from '@/domain/dates';
import { QUICK_TYPES, typeInfo, workoutSummary, type Load, type State, type Workout } from '@/domain/workouts';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, SectionTitle, Stepper, type IconName } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';
import { LoadPicker, StatePicker } from '@/ui/WorkoutFields';

/** Pantallas que apuntan un entrenamiento con todos sus detalles. */
const DETAILED: { label: string; detail: string; icon: IconName; go: (date: ISODate) => void; todayOnly?: boolean }[] = [
  { label: 'Dominadas o peso muerto', detail: 'Plan de la prueba: series, lastre y agarre', icon: 'trophy', go: (date) => router.push({ pathname: '/prueba', params: { date } }) },
  { label: 'Gimnasio', detail: 'Qué has trabajado y el press de banca', icon: 'barbell', go: (date) => router.push({ pathname: '/gimnasio', params: { date } }) },
  { label: 'Casa: Tirón', detail: 'Ejercicio a ejercicio, con sus series', icon: 'arrow-down-circle', go: (date) => router.push({ pathname: '/sesion/[kind]', params: { kind: 'A', date } }) },
  { label: 'Casa: Empuje', detail: 'Ejercicio a ejercicio, con sus series', icon: 'arrow-up-circle', go: (date) => router.push({ pathname: '/sesion/[kind]', params: { kind: 'B', date } }) },
  { label: 'Casa: Mixta suave', detail: 'Ejercicio a ejercicio, con sus series', icon: 'sync-circle', go: (date) => router.push({ pathname: '/sesion/[kind]', params: { kind: 'C', date } }) },
  { label: 'Caminata', detail: 'Kilómetros, tiempo y desnivel', icon: 'walk', go: () => router.push('/caminata') },
  { label: 'Movilidad', detail: 'Sesión de flexibilidad guiada', icon: 'body', go: () => router.push('/flexibilidad'), todayOnly: true },
];

/**
 * Todo lo entrenado en un día, y cómo añadir más. En un día caben los entrenamientos que sean,
 * del tipo que sean: con sus detalles, o apuntados rápido con duración, carga y cómo estabas.
 */
export default function LogWorkoutScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const today = getToday();
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState<ISODate>(params.date && params.date <= today ? params.date : today);
  const [list, setList] = useState<Workout[]>([]);

  // Apunte rápido
  const [quick, setQuick] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [load, setLoad] = useState<Load | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [notes, setNotes] = useState('');

  const reload = useCallback(() => {
    getWorkouts(db, date, date).then(setList);
  }, [db, date]);
  useFocusEffect(reload);

  const needsName = quick === 'otro';
  const canSave = quick !== null && load !== null && (!needsName || name.trim().length > 0);

  const saveQuick = async () => {
    if (!quick || load === null) return;
    await addWorkout(db, { date, type: quick, title: needsName ? name.trim() : typeInfo(quick).label, minutes, load, state, notes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setQuick(null);
    setName('');
    setNotes('');
    setLoad(null);
    setState(null);
    reload();
    syncReminders(db);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Apuntar entrenamiento' }} />

      <Card style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Día</Text>
          <Text style={type.subtitle}>{date === today ? `Hoy, ${formatLong(date).toLowerCase()}` : formatLong(date)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Un día antes" onPress={() => setDate(addDays(date, -1))} style={styles.stepBtn}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Un día después"
          accessibilityState={{ disabled: date >= today }}
          disabled={date >= today}
          onPress={() => setDate(addDays(date, 1))}
          style={[styles.stepBtn, date >= today && { opacity: 0.4 }]}>
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </Card>

      <SectionTitle>{list.length === 0 ? 'Este día no hay nada apuntado' : list.length === 1 ? 'Apuntado este día' : `${list.length} entrenamientos este día`}</SectionTitle>
      {list.length > 0 && (
        <Card style={{ gap: space.sm }}>
          {list.map((w) => (
            <Pressable
              key={w.id}
              accessibilityRole="button"
              accessibilityLabel={`${w.title}. ${workoutSummary(w) || 'Sin carga apuntada'}. Abrir`}
              onPress={() => router.push({ pathname: '/entrenamiento', params: { id: String(w.id) } })}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
              <Ionicons name={typeInfo(w.type).icon as IconName} size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>{w.title}</Text>
                <Text style={type.caption}>{workoutSummary(w) || 'Toca para apuntar la carga y cómo estabas'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </Pressable>
          ))}
        </Card>
      )}

      <SectionTitle>Añadir con detalle</SectionTitle>
      <Card style={{ gap: space.sm }}>
        {DETAILED.filter((d) => !d.todayOnly || date === today).map((d) => (
          <Pressable key={d.label} accessibilityRole="button" accessibilityLabel={`${d.label}. ${d.detail}`} onPress={() => d.go(date)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
            <Ionicons name={d.icon} size={20} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={type.subtitle}>{d.label}</Text>
              <Text style={type.caption}>{d.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.faint} />
          </Pressable>
        ))}
      </Card>

      <SectionTitle>O apuntarlo rápido</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Text style={type.caption}>Sin series ni kilos: qué fue, cuánto duró, la carga y cómo estabas. Sirve también para una segunda sesión del mismo tipo.</Text>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Tipo de entrenamiento">
          {QUICK_TYPES.map((t) => {
            const on = quick === t;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={typeInfo(t).label}
                onPress={() => setQuick(t)}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}>
                <Ionicons name={typeInfo(t).icon as IconName} size={16} color={on ? colors.onAccent : colors.muted} />
                <Text style={[type.caption, { color: on ? colors.onAccent : colors.text }]}>{typeInfo(t).label}</Text>
              </Pressable>
            );
          })}
        </View>
        {quick && (
          <>
            {needsName && (
              <View style={{ gap: 4 }}>
                <Text style={type.caption}>¿Qué deporte?</Text>
                <TextInput
                  accessibilityLabel="Nombre del deporte"
                  value={name}
                  onChangeText={setName}
                  placeholder="Pádel, natación, bici…"
                  placeholderTextColor={colors.faint}
                  maxLength={30}
                  style={styles.input}
                />
              </View>
            )}
            <Text style={type.caption}>Duración</Text>
            <Stepper label="minutos" value={minutes} onChange={setMinutes} step={5} min={5} suffix=" min" />
            <Text style={type.caption}>Carga de la sesión</Text>
            <LoadPicker value={load} onChange={setLoad} />
            <Text style={type.caption}>¿Cómo estabas? (opcional)</Text>
            <StatePicker value={state} onChange={setState} />
            <TextInput
              accessibilityLabel="Nota"
              value={notes}
              onChangeText={setNotes}
              placeholder="Nota (opcional)"
              placeholderTextColor={colors.faint}
              maxLength={200}
              multiline
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            />
            {!canSave && <Text style={type.caption}>{needsName && !name.trim() ? 'Escribe qué deporte ha sido.' : 'Elige la carga para poder guardar.'}</Text>}
            <Button label="Guardar entrenamiento" icon="checkmark-circle" onPress={saveQuick} disabled={!canSave} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cardHigh, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, borderRadius: 22, backgroundColor: colors.cardHigh },
  chipOn: { backgroundColor: colors.accent },
  input: { backgroundColor: colors.cardHigh, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: 12, color: colors.text, fontSize: 16, minHeight: 48 },
});
