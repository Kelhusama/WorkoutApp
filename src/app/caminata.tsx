import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { deleteWalk, getWalk, loadMarch, saveWalk } from '@/db/march';
import { addDays, formatLong, today, type ISODate } from '@/domain/dates';
import { WALK_LABEL, formatPace, type WalkKind } from '@/domain/march';
import { KIND_LABEL, stepAt } from '@/domain/marchPlan';
import { Button, Card, SectionTitle, Stepper } from '@/ui/components';
import { NumberField, numberToText, parseNumber, useFieldChain } from '@/ui/NumberField';
import { colors, radius, space, type } from '@/ui/theme';

const KINDS: WalkKind[] = ['suave', 'cuestas', 'larga', 'extra', 'libre'];

export default function WalkScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; kind?: string; km?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [date, setDate] = useState<ISODate>(today());
  const [kind, setKind] = useState<WalkKind>(KINDS.includes(params.kind as WalkKind) ? (params.kind as WalkKind) : 'libre');
  const [km, setKm] = useState(params.km ?? '');
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [elevation, setElevation] = useState('');
  const [pack, setPack] = useState('');
  const [effort, setEffort] = useState(5);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id === undefined) return;
    getWalk(db, id).then((w) => {
      if (!w) return;
      setDate(w.date);
      setKind(w.kind);
      setKm(numberToText(w.km));
      setHours(w.minutes >= 60 ? String(Math.floor(w.minutes / 60)) : '');
      setMins(w.minutes % 60 ? String(Math.round(w.minutes % 60)) : '');
      setElevation(numberToText(w.elevation));
      setPack(numberToText(w.packKg));
      setEffort(w.effort ?? 5);
      setNotes(w.notes ?? '');
    });
  }, [db, id]);

  const kmValue = parseNumber(km);
  const minutes = (parseNumber(hours) ?? 0) * 60 + (parseNumber(mins) ?? 0);
  const valid = kmValue !== null && kmValue > 0 && kmValue <= 120 && minutes >= 0 && minutes < 48 * 60;
  const problem = kmValue === null ? 'Escribe los kilómetros.' : kmValue <= 0 || kmValue > 120 ? 'Los kilómetros deben estar entre 0,1 y 120.' : null;

  const save = async () => {
    if (!valid) return;
    await saveWalk(db, {
      id,
      date,
      kind,
      km: kmValue!,
      minutes,
      elevation: parseNumber(elevation),
      packKg: parseNumber(pack),
      effort,
      notes,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Poner el plan al día: puede avanzar de escalón con esta caminata.
    const { events } = await loadMarch(db, today());
    const reto = events.some((e) => e.type === 'reto');
    const advance = [...events].reverse().find((e) => e.type === 'avance');
    if (reto) {
      Alert.alert('¡50 km!', 'Has completado el reto. Enhorabuena: esto no se improvisa.');
    } else if (advance && advance.type === 'avance') {
      const next = stepAt(advance.to);
      Alert.alert('¡Escalón completado!', `Pasas al escalón ${next.n}: ${KIND_LABEL[next.kind].toLowerCase()}, con tirada larga de ${next.long} km.`);
    }
    router.back();
  };

  const remove = () =>
    Alert.alert('¿Borrar esta caminata?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (id !== undefined) await deleteWalk(db, id);
          router.back();
        },
      },
    ]);

  const chain = useFieldChain(['km', 'hours', 'mins', 'elevation', 'pack'] as const);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: id === undefined ? 'Registrar caminata' : 'Editar caminata' }} />

      <Card style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.caption}>Día</Text>
          <Text style={type.subtitle}>{formatLong(date)}</Text>
        </View>
        <Pressable accessibilityLabel="Un día antes" onPress={() => setDate(addDays(date, -1))} style={styles.stepBtn}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Un día después"
          onPress={() => date < today() && setDate(addDays(date, 1))}
          style={[styles.stepBtn, date >= today() && { opacity: 0.35 }]}>
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </Card>

      <View style={styles.kinds}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === k }}
            onPress={() => setKind(k)}
            style={[styles.kind, kind === k && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            <Text style={[styles.kindLabel, kind === k && { color: colors.onAccent }]}>{WALK_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ gap: space.lg }}>
        <NumberField label="Distancia" unit="km" value={km} onChange={setKm} placeholder="10,0" {...chain('km')} />
        <View style={{ gap: space.sm }}>
          <NumberField label="Tiempo" hint="Horas" unit="h" value={hours} onChange={setHours} placeholder="2" decimal={false} {...chain('hours')} />
          <NumberField label="" hint="Minutos" unit="min" value={mins} onChange={setMins} placeholder="15" decimal={false} {...chain('mins')} />
        </View>
        {kmValue !== null && kmValue > 0 && minutes > 0 && (
          <Text style={type.caption}>
            Ritmo: <Text style={{ color: colors.text, fontWeight: '700' }}>{formatPace(minutes / kmValue)}</Text> ·{' '}
            {((kmValue / minutes) * 60).toFixed(1).replace('.', ',')} km/h
          </Text>
        )}
      </Card>

      <SectionTitle>Opcional</SectionTitle>
      <Card style={{ gap: space.lg }}>
        <NumberField label="Desnivel positivo" unit="m" value={elevation} onChange={setElevation} decimal={false} {...chain('elevation')} />
        <NumberField label="Peso de la mochila" unit="kg" value={pack} onChange={setPack} {...chain('pack')} />
        <View style={{ gap: space.sm }}>
          <Text style={type.subtitle}>Esfuerzo</Text>
          <Text style={type.caption}>1 = paseo · 5 = cómodo pero se nota · 10 = al límite</Text>
          <Stepper value={effort} onChange={(v) => setEffort(Math.min(10, Math.max(1, v)))} min={1} suffix=" / 10" />
        </View>
        <View style={{ gap: space.sm }}>
          <Text style={type.subtitle}>Molestias o notas</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Rozadura en el talón izquierdo, calcetín nuevo…"
            placeholderTextColor={colors.faint}
            multiline
            style={styles.notes}
            accessibilityLabel="Molestias o notas"
          />
        </View>
      </Card>

      {problem && <Text style={[type.caption, { color: colors.danger }]}>{problem}</Text>}
      <Button label="Guardar caminata" icon="checkmark-circle" onPress={save} disabled={!valid} />
      {id !== undefined && <Button label="Borrar caminata" variant="ghost" icon="trash-outline" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.cardHigh, alignItems: 'center', justifyContent: 'center' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kind: {
    minHeight: 48,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  kindLabel: { fontSize: 14, fontWeight: '700', color: colors.muted },
  notes: {
    minHeight: 72,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.cardHigh,
    borderRadius: radius.sm,
    padding: space.md,
    textAlignVertical: 'top',
  },
});
