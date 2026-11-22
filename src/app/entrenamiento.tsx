import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteWorkout, getWorkout, updateWorkout } from '@/db/workouts';
import { formatLong } from '@/domain/dates';
import { typeInfo, type Load, type State, type Workout } from '@/domain/workouts';
import { Button, Card, SectionTitle, Stepper, ToggleRow, type IconName } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';
import { LoadPicker, StatePicker } from '@/ui/WorkoutFields';

/** Dónde se ven los detalles de un entrenamiento, según la tabla de la que viene. */
function openDetail(w: Workout) {
  if (w.source === 'trial_log') router.push('/prueba');
  else if (w.source === 'walk_log') router.push('/marcha');
  else if (w.source === 'flex_session') router.push('/flexibilidad');
  else if (w.source === 'stretch_log') router.push('/estiramientos');
  else if (w.source === 'session_log' && w.type === 'gimnasio') router.push({ pathname: '/gimnasio', params: { date: w.date } });
  else if (w.source === 'session_log') {
    const kind = w.title === 'Tirón' ? 'A' : w.title === 'Empuje' ? 'B' : 'C';
    router.push({ pathname: '/sesion/[kind]', params: { kind, date: w.date } });
  }
}

/** Lo común a cualquier entrenamiento: duración, carga, cómo estabas y una nota. */
export default function WorkoutScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [load, setLoad] = useState<Load | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    getWorkout(db, Number(id)).then((x) => {
      setW(x);
      if (!x) return;
      setTimed(x.minutes != null);
      setMinutes(x.minutes ?? 30);
      setLoad(x.load);
      setState(x.state);
      setNotes(x.notes ?? '');
    });
  }, [db, id]);

  if (w === undefined) return <View style={{ flex: 1 }} />;
  if (w === null) {
    return (
      <View style={{ padding: space.lg }}>
        <Card>
          <Text style={type.body}>Este entrenamiento ya no existe.</Text>
        </Card>
      </View>
    );
  }

  const save = async () => {
    await updateWorkout(db, w.id, { minutes: timed ? minutes : null, load, state, notes });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = () =>
    Alert.alert('¿Borrar este entrenamiento?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, w.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: w.title }} />
      <Card style={styles.head}>
        <Ionicons name={typeInfo(w.type).icon as IconName} size={26} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{w.title}</Text>
          <Text style={type.caption}>
            {typeInfo(w.type).label} · {formatLong(w.date)}
          </Text>
        </View>
      </Card>

      <SectionTitle>Carga de la sesión</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <LoadPicker value={load} onChange={setLoad} />
        {w.source && <Text style={type.caption}>Sale de lo que apuntaste al acabar. Si la cambias aquí, se queda como la pongas.</Text>}
      </Card>

      <SectionTitle>¿Cómo estabas?</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <StatePicker value={state} onChange={setState} />
        <Text style={type.caption}>Aparte de lo dura que fuera la sesión: sirve para saber si costó porque era exigente o porque llegabas mal.</Text>
      </Card>

      <SectionTitle>Duración</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <ToggleRow title="Apuntar la duración" value={timed} onChange={setTimed} />
        {timed && <Stepper label="minutos" value={minutes} onChange={setMinutes} step={5} min={5} suffix=" min" />}
      </Card>

      <TextInput
        accessibilityLabel="Nota"
        value={notes}
        onChangeText={setNotes}
        placeholder="Nota (opcional): una molestia, poco sueño…"
        placeholderTextColor={colors.faint}
        maxLength={200}
        multiline
        style={styles.input}
      />

      <Button label="Guardar" icon="checkmark-circle" onPress={save} />
      {w.source ? <Button label="Ver los detalles" variant="secondary" icon="list" onPress={() => openDetail(w)} /> : <Button label="Borrar este entrenamiento" variant="ghost" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: 12, color: colors.text, fontSize: 16, minHeight: 72, textAlignVertical: 'top' },
});
