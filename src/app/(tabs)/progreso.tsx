import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRecentLogs, type SessionLog } from '@/db/repo';
import { formatShort } from '@/domain/dates';
import { FEELING_LABEL } from '@/domain/progression';
import { SESSION_INFO } from '@/domain/schedule';
import { Card, Pill, SectionTitle } from '@/ui/components';
import { GoalsSummary } from '@/ui/goals';
import { colors, space, type } from '@/ui/theme';
import { STATUS_STYLE } from '@/ui/week';

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<SessionLog[]>([]);

  useFocusEffect(
    useCallback(() => {
      getRecentLogs(db, 15).then(setLogs);
    }, [db]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl }}>
      <Text style={type.overline}>Progreso</Text>
      <Text style={[type.hero, { marginTop: 2 }]}>Tus objetivos</Text>

      <View style={{ marginTop: space.lg }}>
        <GoalsSummary />
      </View>

      <SectionTitle>Últimos registros</SectionTitle>
      {logs.length === 0 ? (
        <Card>
          <Text style={type.caption}>Aún no hay registros. Tu primera sesión aparecerá aquí.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {logs.map((l, i) => {
            const s = STATUS_STYLE[l.status];
            return (
              <View key={l.id} style={[styles.row, i > 0 && styles.divider]}>
                <Text style={styles.date}>{formatShort(l.date)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.subtitle}>{SESSION_INFO[l.kind].title}</Text>
                  {(l.feeling || l.bench_weight) && (
                    <Text style={type.caption}>
                      {l.feeling ? FEELING_LABEL[l.feeling] : ''}
                      {l.bench_weight ? ` · Banca ${l.bench_weight} kg × ${l.bench_reps}` : ''}
                    </Text>
                  )}
                </View>
                <Pill label={s.label} color={s.color} bg={s.bg} />
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  date: { width: 52, fontSize: 13, fontWeight: '700', color: colors.muted },
});
