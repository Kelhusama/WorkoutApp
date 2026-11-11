import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPrescriptions, getSessionLog, getSessionSets, saveHomeSession, type SlotChange } from '@/db/repo';
import { formatLong, today as getToday } from '@/domain/dates';
import { describeChange } from '@/domain/format';
import type { Feeling, Prescription } from '@/domain/progression';
import { SESSION_INFO, type SessionKind } from '@/domain/schedule';
import { TEMPLATES, exerciseFor } from '@/domain/templates';
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
  const slots = TEMPLATES[kind];

  const [targets, setTargets] = useState<Record<string, Prescription> | null>(null);
  const [values, setValues] = useState<Record<string, number[]>>({});
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<SlotChange[] | null>(null);

  useEffect(() => {
    (async () => {
      const t = await getPrescriptions(db, kind);
      const log = await getSessionLog(db, date, kind);
      const saved = log?.status === 'done' ? await getSessionSets(db, log.id) : {};
      const initial: Record<string, number[]> = {};
      for (const s of slots) initial[s.key] = saved[s.key] ?? Array(t[s.key].sets).fill(t[s.key].reps);
      setTargets(t);
      setValues(initial);
      if (log?.status === 'done') {
        setEditing(true);
        setFeeling(log.feeling);
      }
    })();
  }, [db, kind, date, slots]);

  const save = async () => {
    if (!feeling) return;
    setSaving(true);
    try {
      const result = await saveHomeSession(
        db,
        date,
        kind,
        feeling,
        slots.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: values[s.key] ?? [] })),
      );
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
