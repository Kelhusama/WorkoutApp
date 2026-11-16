import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addFlexTest, deleteFlexTest, getFlexTests } from '@/db/flexibility';
import { formatLong, formatShort, today } from '@/domain/dates';
import {
  FLEX_TEST_BY_ID,
  changeText,
  formatFlexValue,
  isFlexTestId,
  testSummary,
  validateFlexValue,
  type FlexResult,
  type FlexTest,
} from '@/domain/flexibility';
import { Button, Card } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, radius, space, type } from '@/ui/theme';

type Saved = FlexResult & { id: number };

const dateText = (d: string) => `${formatShort(d)} ${d.slice(0, 4)}`;

/** «80,5» o «80.5» → número; vacío o no numérico → null. */
function parse(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Motivo por el que no se puede guardar, o `null` si el valor vale. */
function problem(test: FlexTest, text: string, value: number | null): string | null {
  if (text.trim() && value === null) return 'Escribe solo números, por ejemplo 12,5.';
  if (value !== null && test.sign && parse(text)! < 0) return 'Escribe la cifra sin signo y elige arriba qué ha pasado.';
  if (value !== null && test.decimals === 0 && !Number.isInteger(value)) return 'Este test se apunta sin decimales.';
  return validateFlexValue(test, value);
}

function SignPicker({ test, negative, onChange }: { test: FlexTest; negative: boolean; onChange: (negative: boolean) => void }) {
  if (!test.sign) return null;
  const options = [
    { negative: false, label: test.sign.positive },
    { negative: true, label: test.sign.negative },
  ];
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.negative === negative;
        return (
          <Pressable
            key={o.label}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.negative);
            }}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}>
            <Text style={[styles.segmentLabel, { color: active ? colors.onAccent : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function FlexTestScreen() {
  const db = useSQLiteContext();
  const { test: param } = useLocalSearchParams<{ test?: string }>();
  const test = isFlexTestId(param) ? FLEX_TEST_BY_ID[param] : null;
  const [results, setResults] = useState<Saved[]>([]);
  const [text, setText] = useState('');
  const [negative, setNegative] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (test) setResults(await getFlexTests(db, test.id));
  }, [db, test]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!test) {
    return (
      <View style={{ padding: space.lg, gap: space.lg }}>
        <Stack.Screen options={{ title: 'Test de flexibilidad' }} />
        <Text style={type.body}>No encuentro ese test. Vuelve a Flexibilidad y elige uno de la lista.</Text>
        <Button label="Volver" onPress={() => router.back()} />
      </View>
    );
  }

  const now = today();
  const typed = parse(text);
  const value = typed === null ? null : negative ? -Math.abs(typed) : typed;
  const reason = problem(test, text, value);
  const summary = testSummary(results, test, now);
  const change = changeText(summary);

  const save = async () => {
    if (reason || value === null || saving) return;
    setSaving(true);
    await addFlexTest(db, now, test.id, value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const remove = (r: Saved) => {
    Alert.alert('¿Borrar este resultado?', `${formatFlexValue(test, r.value)} del ${dateText(r.date)}. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteFlexTest(db, r.id);
          reload();
        },
      },
    ]);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: test.name }} />

      <View style={{ gap: 2 }}>
        <Text style={type.title}>{test.name}</Text>
        <Text style={type.caption}>
          Mide: {test.measures.toLowerCase()} · {test.higherIsBetter ? 'cuanto más, mejor' : 'cuanto menos, mejor'}
        </Text>
      </View>

      <Text accessibilityRole="header" style={styles.heading}>
        Cómo se hace
      </Text>
      <Card style={{ gap: space.sm }}>
        {test.steps.map((s, i) => (
          <View key={s} style={styles.step}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <Text style={[type.body, { flex: 1 }]}>{s}</Text>
          </View>
        ))}
        <Text style={type.caption}>{test.reference}</Text>
      </Card>

      <Text accessibilityRole="header" style={styles.heading}>
        Resultado de hoy
      </Text>
      <Card style={{ gap: space.md }}>
        <Text style={type.caption}>{formatLong(now)}</Text>
        <SignPicker test={test} negative={negative} onChange={setNegative} />
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType={test.decimals === 0 ? 'number-pad' : 'decimal-pad'}
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={styles.input}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel={`Resultado en ${test.unit === 'cm' ? 'centímetros' : test.unit === 's' ? 'segundos' : 'grados'}`}
          />
          <Text style={styles.unit}>{test.unit === '°' ? 'grados' : test.unit}</Text>
        </View>
        {test.sign && value !== null && !reason && <Text style={type.caption}>Se guardará como {formatFlexValue(test, value)}.</Text>}
        <Button label="Guardar resultado" icon="checkmark-circle" onPress={save} disabled={!!reason || saving} />
        {reason && (
          <Text style={[styles.reason, text.trim() !== '' && { color: colors.danger }]} accessibilityLiveRegion="polite">
            {reason}
          </Text>
        )}
      </Card>

      <Text accessibilityRole="header" style={styles.heading}>
        Resultados anteriores
      </Text>
      {results.length === 0 ? (
        <Text style={type.caption}>Aún no hay resultados. Haz el test, apunta la cifra arriba y aquí verás tu evolución.</Text>
      ) : (
        <>
          {summary.series.length >= 2 && (
            <Card style={{ gap: space.sm }}>
              <LineChart points={summary.series} height={150} format={(v) => String(Math.round(v * 10) / 10).replace('.', ',')} />
              {change && <Text style={type.caption}>{change}</Text>}
            </Card>
          )}
          <Card style={{ gap: space.xs }}>
            {[...results].reverse().map((r) => (
              <View key={r.id} style={styles.result}>
                <Text style={[type.body, { flex: 1 }]}>{dateText(r.date)}</Text>
                <Text style={styles.resultValue}>{formatFlexValue(test, r.value)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Borrar el resultado del ${dateText(r.date)}, ${formatFlexValue(test, r.value)}`}
                  onPress={() => remove(r)}
                  style={({ pressed }) => [styles.trash, pressed && { opacity: 0.6 }]}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </Card>
          <Text style={type.caption}>Si te equivocaste al teclear, borra el resultado con la papelera y apúntalo de nuevo.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space.md },
  step: { flexDirection: 'row', gap: space.md },
  stepNumber: { width: 20, fontSize: 15, fontWeight: '700', color: colors.accent, textAlign: 'center', fontVariant: ['tabular-nums'] },
  segmented: { flexDirection: 'row', gap: space.xs, backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: space.xs },
  segment: { flex: 1, minHeight: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm, paddingVertical: space.xs },
  segmentLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardHigh,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: 64,
  },
  input: { flex: 1, minHeight: 56, color: colors.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { color: colors.muted, fontSize: 16, fontWeight: '600', marginLeft: space.sm },
  reason: { fontSize: 14, color: colors.muted },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  resultValue: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  trash: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
