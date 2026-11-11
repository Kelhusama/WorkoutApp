import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getBestBench1RM, getBestTests } from '@/db/repo';
import { formatShort } from '@/domain/dates';
import { GOALS, goalProgress, nextMilestone, type Goal } from '@/domain/strength';
import { Button, Card, Pill, ProgressBar } from './components';
import { colors, space, type } from './theme';

interface Current {
  value: number;
  measured: boolean;
  when?: string;
}

export function GoalsSummary({ compact = false }: { compact?: boolean }) {
  const db = useSQLiteContext();
  const [current, setCurrent] = useState<Record<Goal['id'], Current> | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const tests = await getBestTests(db);
        const bench = await getBestBench1RM(db);
        const pick = (g: Goal, v: number | null | undefined, when?: string): Current =>
          v == null ? { value: g.start, measured: false } : { value: v, measured: true, when };
        const [dom, flex, ban] = GOALS;
        setCurrent({
          dominadas: pick(dom, tests.dominadas?.best, tests.dominadas?.last_date),
          flexiones: pick(flex, tests.flexiones?.best, tests.flexiones?.last_date),
          banca: pick(ban, bench),
        });
      })();
    }, [db]),
  );

  if (!current) return null;

  return (
    <View style={{ gap: space.md }}>
      {GOALS.map((g) => {
        const c = current[g.id];
        const pct = goalProgress(g, c.value);
        const next = nextMilestone(g, c.value);
        const reached = c.value >= g.target;
        return (
          <Card key={g.id} style={{ gap: space.sm }}>
            <View style={styles.row}>
              <Text style={[type.subtitle, { flex: 1 }]}>{g.title}</Text>
              <Text style={styles.value}>
                {c.value}
                <Text style={styles.target}>
                  {' '}
                  / {g.target}
                  {g.unit}
                </Text>
              </Text>
            </View>
            <ProgressBar value={pct} color={reached ? colors.success : colors.accent} />
            <View style={styles.row}>
              <Text style={[type.caption, { flex: 1 }]}>
                {reached
                  ? '¡Meta conseguida!'
                  : next
                    ? `Próximo hito: ${next}${g.unit}`
                    : ''}
                {!c.measured ? ' · punto de partida' : c.when ? ` · ${formatShort(c.when)}` : ''}
              </Text>
            </View>
            {!compact && (
              <>
                <View style={styles.milestones}>
                  {g.milestones.map((m) => (
                    <Pill
                      key={m}
                      label={`${m}${g.unit}`}
                      color={c.value >= m ? colors.success : colors.muted}
                      bg={c.value >= m ? colors.successSoft : colors.cardHigh}
                    />
                  ))}
                </View>
                {g.id !== 'banca' ? (
                  <Button
                    label="Registrar test de máximo"
                    variant="secondary"
                    icon="stopwatch-outline"
                    onPress={() => router.push({ pathname: '/test', params: { test: g.id } })}
                  />
                ) : (
                  <Text style={type.caption}>Se calcula con la mejor serie de banca que registres en el gimnasio.</Text>
                )}
              </>
            )}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 20, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  target: { fontSize: 14, fontWeight: '600', color: colors.muted },
  milestones: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
