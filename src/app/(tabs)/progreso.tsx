import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRecentLogs, type SessionLog } from '@/db/repo';
import { getBenchSeries, getExerciseSummaries, getPhotos, getSetCounts, getTestSeries } from '@/db/stats';
import type { Point } from '@/domain/body';
import { addDays, formatShort, today, weekStart, type ISODate } from '@/domain/dates';
import { EXERCISES } from '@/domain/exercises';
import { FEELING_LABEL } from '@/domain/progression';
import { SESSION_INFO } from '@/domain/schedule';
import { weeklyVolume, type MuscleGroup } from '@/domain/volume';
import { useStreak } from '@/hooks/useStreak';
import { Card, Pill, SectionTitle } from '@/ui/components';
import { GoalsSummary } from '@/ui/goals';
import { LineChart } from '@/ui/LineChart';
import { colors, space, type, font } from '@/ui/theme';
import { VolumeBars } from '@/ui/VolumeBars';
import { STATUS_STYLE } from '@/ui/week';

interface Charts {
  banca: Point[];
  dominadas: Point[];
  flexiones: Point[];
}

const CHARTS: { key: keyof Charts; title: string; unit: string; decimals: number }[] = [
  { key: 'banca', title: 'Press de banca · 1RM estimado', unit: ' kg', decimals: 1 },
  { key: 'dominadas', title: 'Test de dominadas', unit: '', decimals: 0 },
  { key: 'flexiones', title: 'Test de flexiones', unit: '', decimals: 0 },
];

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const streak = useStreak();
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [charts, setCharts] = useState<Charts>({ banca: [], dominadas: [], flexiones: [] });
  const [exercises, setExercises] = useState<{ exerciseId: string; sessions: number; lastDate: ISODate }[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [volume, setVolume] = useState<Record<MuscleGroup, number> | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLogs(await getRecentLogs(db, 10));
        setCharts({
          banca: await getBenchSeries(db),
          dominadas: await getTestSeries(db, 'dominadas'),
          flexiones: await getTestSeries(db, 'flexiones'),
        });
        setExercises((await getExerciseSummaries(db)).filter((e) => EXERCISES[e.exerciseId]));
        setPhotoCount((await getPhotos(db)).length);
        const monday = weekStart(today());
        setVolume(weeklyVolume(await getSetCounts(db, monday, addDays(monday, 6))));
      })();
    }, [db]),
  );

  const pct = streak && streak.planned > 0 ? Math.round((streak.done / streak.planned) * 100) : null;
  const shownCharts = CHARTS.filter((c) => charts[c.key].length >= 2);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl }}>
      <Text style={type.overline}>Progreso</Text>
      <Text style={[type.hero, { marginTop: 2 }]}>Cómo vas</Text>

      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <Ionicons name="flame" size={20} color={colors.accent} />
          <Text style={styles.tileValue}>{streak?.weeks ?? 0}</Text>
          <Text style={type.caption}>{streak?.weeks === 1 ? 'Semana cumplida' : 'Semanas cumplidas'}</Text>
        </Card>
        <Card style={styles.tile}>
          <Ionicons name="trophy" size={20} color={colors.accent} />
          <Text style={styles.tileValue}>{streak?.bestWeeks ?? 0}</Text>
          <Text style={type.caption}>Mejor racha</Text>
        </Card>
        <Card style={styles.tile}>
          <Ionicons name="checkmark-done" size={20} color={colors.accent} />
          <Text style={styles.tileValue}>{pct === null ? '—' : `${pct}%`}</Text>
          <Text style={type.caption}>Últimas 4 semanas</Text>
        </Card>
      </View>
      <Text style={[type.caption, { marginTop: space.sm }]}>
        Una semana se cumple si entrenas y fallas como mucho una sesión: ese es tu comodín
        {streak?.passUsed ? ', y esta semana ya lo has usado' : ''}. Los descansos y los viajes no rompen la racha.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Revisión de la semana. Abrir"
        onPress={() => router.push('/revision')}
        style={({ pressed }) => [{ marginTop: space.md }, pressed && { opacity: 0.7 }]}>
        <Card style={styles.review}>
          <Ionicons name="clipboard-outline" size={24} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={type.subtitle}>Revisión de la semana</Text>
            <Text style={type.caption}>Qué has hecho, qué récords has batido y un foco para la siguiente</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Card>
      </Pressable>

      <SectionTitle>Objetivos</SectionTitle>
      <GoalsSummary />

      {shownCharts.length === 0 && (
        <>
          <SectionTitle>Evolución</SectionTitle>
          <Card>
            <Text style={type.caption}>
              Con dos registros de banca o dos tests de máximo verás aquí cómo evolucionas.
            </Text>
          </Card>
        </>
      )}
      {shownCharts.length > 0 && (
        <>
          <SectionTitle>Evolución</SectionTitle>
          <View style={{ gap: space.md }}>
            {shownCharts.map((c) => (
              <Card key={c.key} style={{ gap: space.sm }}>
                <Text style={type.subtitle}>{c.title}</Text>
                <LineChart points={charts[c.key]} height={150} format={(v) => v.toFixed(c.decimals).replace('.', ',')} />
              </Card>
            ))}
          </View>
        </>
      )}

      {volume && (
        <>
          <SectionTitle>Volumen semanal por músculo</SectionTitle>
          <VolumeBars volume={volume} />
        </>
      )}

      <SectionTitle>Ejercicios</SectionTitle>
      {exercises.length === 0 ? (
        <Card>
          <Text style={type.caption}>Cuando registres sesiones verás aquí cada ejercicio con sus récords y su gráfica.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: space.sm }}>
          {exercises.map((e, i) => (
            <Pressable
              key={e.exerciseId}
              accessibilityRole="button"
              accessibilityLabel={`${EXERCISES[e.exerciseId].name}. Ver récords y gráfica`}
              onPress={() => router.push({ pathname: '/ejercicio/[id]', params: { id: e.exerciseId } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>{EXERCISES[e.exerciseId].name}</Text>
                <Text style={type.caption}>
                  {e.sessions} {e.sessions === 1 ? 'sesión' : 'sesiones'} · última {formatShort(e.lastDate)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          ))}
        </Card>
      )}

      <SectionTitle>Fotos</SectionTitle>
      <Pressable accessibilityRole="button" accessibilityLabel="Fotos de progreso. Abrir" onPress={() => router.push('/fotos')} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="camera-outline" size={24} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={type.subtitle}>Fotos de progreso</Text>
            <Text style={type.caption}>
              {photoCount === 0 ? 'Compara el antes y el ahora: frente, lado y espalda' : `${photoCount} ${photoCount === 1 ? 'foto guardada' : 'fotos guardadas'}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Card>
      </Pressable>

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
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  tile: { flex: 1, gap: 2, padding: space.md },
  tileValue: { fontSize: 26, ...font.display, color: colors.text, fontVariant: ['tabular-nums'], marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  review: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  date: { width: 52, fontSize: 13, ...font.w700, color: colors.muted },
});
