import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getExerciseHistory } from '@/db/stats';
import { formatShort } from '@/domain/dates';
import { EXERCISES } from '@/domain/exercises';
import { amountText } from '@/domain/format';
import { exerciseStats, seriesOf, type SessionSets } from '@/domain/stats';
import { ExerciseFigure } from '@/illustrations/ExerciseFigure';
import { Card, SectionTitle } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, radius, space, type } from '@/ui/theme';

type Metric = 'best' | 'total';

export default function ExerciseScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = EXERCISES[id];
  const [history, setHistory] = useState<SessionSets[]>([]);
  const [metric, setMetric] = useState<Metric>('best');

  useFocusEffect(
    useCallback(() => {
      getExerciseHistory(db, id).then(setHistory);
    }, [db, id]),
  );

  if (!ex) return null;
  const stats = exerciseStats(history);
  const unit = ex.measure === 'time' ? ' s' : '';
  const perArm = ex.perArm ? ' por brazo' : '';

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}>
      <Stack.Screen options={{ title: ex.name }} />

      <Card style={{ alignItems: 'center', gap: space.sm }}>
        <ExerciseFigure exerciseId={ex.id} size={210} />
        <Text style={type.caption}>{ex.muscles.join(' · ')}</Text>
      </Card>

      {stats ? (
        <>
          <View style={styles.tiles}>
            <Card style={styles.tile}>
              <Ionicons name="trophy" size={18} color={colors.accent} />
              <Text style={styles.tileValue}>{amountText(stats.bestSet, ex, true)}</Text>
              <Text style={type.caption}>Mejor serie{perArm}</Text>
              <Text style={[type.caption, { color: colors.faint }]}>{formatShort(stats.bestSetDate)}</Text>
            </Card>
            <Card style={styles.tile}>
              <Ionicons name="layers" size={18} color={colors.accent} />
              <Text style={styles.tileValue}>
                {stats.bestTotal}
                {unit}
              </Text>
              <Text style={type.caption}>Más en una sesión</Text>
              <Text style={[type.caption, { color: colors.faint }]}>{formatShort(stats.bestTotalDate)}</Text>
            </Card>
            <Card style={styles.tile}>
              <Ionicons name="calendar" size={18} color={colors.accent} />
              <Text style={styles.tileValue}>{stats.sessions}</Text>
              <Text style={type.caption}>{stats.sessions === 1 ? 'Sesión' : 'Sesiones'}</Text>
              <Text style={[type.caption, { color: colors.faint }]}>Última {formatShort(stats.lastDate)}</Text>
            </Card>
          </View>

          <SectionTitle>Evolución</SectionTitle>
          <Card style={{ gap: space.md }}>
            <View style={styles.segment}>
              {(
                [
                  ['best', 'Mejor serie'],
                  ['total', 'Total de la sesión'],
                ] as const
              ).map(([m, label]) => (
                <Pressable
                  key={m}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: metric === m }}
                  onPress={() => setMetric(m)}
                  style={[styles.segmentItem, metric === m && { backgroundColor: colors.accent }]}>
                  <Text style={[styles.segmentLabel, metric === m && { color: '#fff' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <LineChart points={seriesOf(history, metric)} format={(v) => String(Math.round(v))} />
            {history.length < 2 && <Text style={type.caption}>Con dos sesiones o más verás la línea de evolución.</Text>}
          </Card>

          <SectionTitle>Historial</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {[...history].reverse().map((h, i) => (
              <View key={h.date} style={[styles.histRow, i > 0 && styles.divider]}>
                <Text style={[type.caption, { width: 56 }]}>{formatShort(h.date)}</Text>
                <Text style={[type.body, { flex: 1, fontVariant: ['tabular-nums'] }]}>{h.values.join(' · ')}</Text>
                <Text style={type.caption}>
                  {h.values.reduce((a, b) => a + b, 0)}
                  {unit}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <Card>
          <Text style={type.caption}>Aún no has registrado este ejercicio. Cuando lo hagas verás aquí tus marcas y tu evolución.</Text>
        </Card>
      )}

      <SectionTitle>Técnica</SectionTitle>
      <Card style={{ gap: space.sm }}>
        {ex.cues.map((c) => (
          <View key={c} style={styles.bullet}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 1 }} />
            <Text style={[type.body, { flex: 1, fontSize: 14 }]}>{c}</Text>
          </View>
        ))}
        {ex.mistakes.map((m) => (
          <View key={m} style={styles.bullet}>
            <Ionicons name="close-circle" size={16} color={colors.danger} style={{ marginTop: 1 }} />
            <Text style={[type.caption, { flex: 1 }]}>Evita: {m.toLowerCase()}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, gap: 2, padding: space.md },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], marginTop: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentLabel: { fontSize: 13, fontWeight: '700', color: colors.muted },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bullet: { flexDirection: 'row', gap: space.sm },
});
