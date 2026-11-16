import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPrescriptions, getSessionLog, getSessionSets, getTripOn, saveHomeSession, type SlotChange } from '@/db/repo';
import { getBests } from '@/db/stats';
import { formatLong, today as getToday } from '@/domain/dates';
import { EXERCISES } from '@/domain/exercises';
import { detectRecords, type NewRecord } from '@/domain/stats';
import { amountText, describeChange } from '@/domain/format';
import type { Feeling, Prescription } from '@/domain/progression';
import { SESSION_INFO, type SessionKind } from '@/domain/schedule';
import { exerciseFor, type Slot } from '@/domain/templates';
import { sessionSlots } from '@/domain/travel';
import { Button, Card, FeelingPicker, SectionTitle } from '@/ui/components';
import { syncReminders } from '@/notifications/reminders';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { colors, space, type } from '@/ui/theme';

export default function SessionScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind: string; date?: string }>();
  const kind = (['A', 'B', 'C'].includes(params.kind) ? params.kind : 'A') as SessionKind;
  const date = params.date ?? getToday();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [travelling, setTravelling] = useState(false);

  const [targets, setTargets] = useState<Record<string, Prescription> | null>(null);
  const [values, setValues] = useState<Record<string, number[]>>({});
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<SlotChange[] | null>(null);
  const [records, setRecords] = useState<NewRecord[]>([]);

  useEffect(() => {
    (async () => {
      // De viaje, los ejercicios se adaptan al material disponible ese día.
      const trip = await getTripOn(db, date);
      const slots = sessionSlots(kind, trip?.gear);
      const t = await getPrescriptions(db, slots);
      const log = await getSessionLog(db, date, kind);
      const saved = log?.status === 'done' ? await getSessionSets(db, log.id) : {};
      const initial: Record<string, number[]> = {};
      for (const s of slots) initial[s.key] = saved[s.key] ?? Array(t[s.key].sets).fill(t[s.key].reps);
      setSlots(slots);
      setTravelling(!!trip);
      setTargets(t);
      setValues(initial);
      if (log?.status === 'done') {
        setEditing(true);
        setFeeling(log.feeling);
      }
    })();
  }, [db, kind, date]);

  const save = async () => {
    if (!feeling) return;
    setSaving(true);
    try {
      const results = slots.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: values[s.key] ?? [] }));
      // Marcas anteriores a hoy, para saber si esta sesión bate algún récord.
      const before = await getBests(db, date);
      const result = await saveHomeSession(db, date, kind, feeling, results, slots);
      setRecords(detectRecords(before, results));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setChanges(result);
      syncReminders(db);
    } finally {
      setSaving(false);
    }
  };

  const info = SESSION_INFO[kind];

  if (!targets) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (changes) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <Stack.Screen options={{ title: 'Sesión guardada' }} />
        <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.xl }}>
          <Ionicons name="trophy" size={56} color={colors.accent} />
          <Text style={type.hero}>¡Sesión hecha!</Text>
          <Text style={type.caption}>{formatLong(date)}</Text>
        </View>
        {records.length > 0 && (
          <Card style={{ gap: space.md, borderColor: colors.accent, marginBottom: space.md }}>
            <Text style={[type.subtitle, { color: colors.accent }]}>
              {records.length === 1 ? '¡Nuevo récord!' : `¡${records.length} récords nuevos!`}
            </Text>
            {records.map((r) => {
              const ex = EXERCISES[r.exerciseId];
              return (
                <View key={r.exerciseId + r.kind} style={styles.changeRow}>
                  <Ionicons name="trophy" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.subtitle}>{ex.name}</Text>
                    <Text style={type.caption}>
                      {r.kind === 'serie'
                        ? `${amountText(r.value, ex)} en una serie (antes ${r.previous})`
                        : `${amountText(r.value, ex)} en toda la sesión (antes ${r.previous})`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        {changes.length > 0 ? (
          <>
            <SectionTitle>Para la próxima vez</SectionTitle>
            <Card style={{ gap: space.md }}>
              {changes.map((c) => {
                const ex = exerciseFor(slots.find((s) => s.key === c.slotKey)!);
                const up = c.change !== 'none';
                return (
                  <View key={c.slotKey} style={styles.changeRow}>
                    <Ionicons
                      name={up ? 'arrow-up-circle' : 'pause-circle'}
                      size={22}
                      color={up ? colors.success : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={type.subtitle}>{ex.name}</Text>
                      <Text style={type.caption}>{describeChange(c.change, c.next, ex)}</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        ) : (
          <Card>
            <Text style={type.caption}>Registro actualizado. La progresión ya se aplicó la primera vez que guardaste este día.</Text>
          </Card>
        )}
        <View style={{ marginTop: space.xl }}>
          <Button label="Volver" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl, gap: space.md }}>
      <Stack.Screen options={{ title: `${info.title}` }} />
      <View>
        <Text style={type.overline}>{formatLong(date)}</Text>
        <Text style={type.caption}>
          {editing
            ? 'Editando un registro guardado.'
            : 'Está precargado lo planificado: corrige solo las series que no salieron así.'}
        </Text>
        {travelling && (
          <Text style={[type.caption, { color: colors.info, marginTop: 4 }]}>
            <Ionicons name="airplane" size={12} color={colors.info} /> Modo viaje: ejercicios adaptados a lo que tienes a mano.
          </Text>
        )}
      </View>

      {slots.map((s) => (
        <ExerciseCard
          key={s.key}
          slot={s}
          target={targets[s.key]}
          values={values[s.key] ?? []}
          onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
        />
      ))}

      <SectionTitle>¿Cómo ha ido?</SectionTitle>
      <FeelingPicker value={feeling} onChange={setFeeling} />
      <Text style={type.caption}>
        Con «Fácil» la app sube la dificultad; con «Dura» la mantiene.
      </Text>

      <View style={{ marginTop: space.md }}>
        <Button
          label={saving ? 'Guardando…' : 'Guardar sesión'}
          icon="checkmark-circle"
          onPress={save}
          disabled={!feeling || saving}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
