import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { addTest, deleteTest, getTests, type TestResult } from '@/db/repo';
import { formatLong, today } from '@/domain/dates';
import { GOALS } from '@/domain/strength';
import { Button, Card, SectionTitle, Stepper } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

const TIPS = {
  dominadas: 'Calienta con 2 series suaves. Luego, una sola serie al máximo con técnica estricta: desde brazos estirados hasta barbilla sobre la barra.',
  flexiones: 'Calienta y haz una sola serie al máximo. Solo cuentan las estrictas: cuerpo recto y pecho casi al suelo.',
} as const;

export default function TestScreen() {
  const db = useSQLiteContext();
  const { test: param } = useLocalSearchParams<{ test?: string }>();
  const test = param === 'flexiones' ? 'flexiones' : 'dominadas';
  const goal = GOALS.find((g) => g.id === test)!;
  const [value, setValue] = useState(goal.start);
  const [results, setResults] = useState<TestResult[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getTests(db, test);
    setResults(r);
    return r;
  }, [db, test]);

  useEffect(() => {
    // Se parte del último resultado: lo normal es hacer las mismas o alguna más.
    load().then((r) => {
      if (r.length) setValue(r[0].value);
    });
  }, [load]);

  const best = results.reduce((b, r) => Math.max(b, r.value), 0);

  const save = async () => {
    await addTest(db, today(), test, value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedNote(value > best && results.length > 0 ? `Guardado: ${value}. ¡Nueva mejor marca!` : `Guardado: ${value}.`);
    load();
  };

  const remove = (r: TestResult) =>
    Alert.alert('¿Borrar este resultado?', `${r.value} el ${formatLong(r.date).toLowerCase()}. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteTest(db, r.id);
          setSavedNote(null);
          load();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: `Test de ${test}` }} />
      <Card>
        <Text style={type.body}>{TIPS[test]}</Text>
      </Card>

      <Text style={type.subtitle}>¿Cuántas has hecho seguidas hoy?</Text>
      <Stepper label={test} value={value} onChange={setValue} min={0} suffix=" reps" />
      <Button label="Guardar test" icon="checkmark-circle" onPress={save} />
      {savedNote && (
        <Text style={[type.caption, { color: colors.success }]} accessibilityLiveRegion="polite">
          {savedNote}
        </Text>
      )}

      <SectionTitle>Resultados anteriores</SectionTitle>
      {results.length === 0 ? (
        <Card>
          <Text style={type.caption}>Todavía no has hecho ningún test. Repítelo cada 4 semanas para ver tu progreso.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {results.map((r, i) => (
            <View key={r.id} style={[styles.row, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>
                  {r.value} {r.value === 1 ? 'repetición' : 'repeticiones'}
                  {r.value === best ? '  ·  mejor marca' : ''}
                </Text>
                <Text style={type.caption}>{formatLong(r.date)}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Borrar el resultado de ${r.value} del ${formatLong(r.date).toLowerCase()}`}
                onPress={() => remove(r)}
                style={styles.delete}>
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  delete: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
