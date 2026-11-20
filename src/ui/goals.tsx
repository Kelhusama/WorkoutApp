import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { getBenchSeries, getTestSeries } from '@/db/stats';
import type { Point } from '@/domain/body';
import { goalWindow, type Window } from '@/domain/coach';
import { formatShort, monthTitle, today } from '@/domain/dates';
import { projectGoal, type Projection } from '@/domain/insights';
import { GOALS, goalProgress, nextMilestone, type Goal } from '@/domain/strength';
import { Button, Card, Pill, ProgressBar } from './components';
import { colors, space, type, font } from './theme';

interface Current {
  value: number;
  measured: boolean;
  when?: string;
  projection: Projection;
  /** Horquilla de fechas según el filtro del entrenador, si hay mejora clara. */
  window: Window | null;
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

function projectionText(g: Goal, p: Projection): string {
  switch (p.status) {
    case 'conseguido':
      return 'Objetivo conseguido.';
    case 'pocos_datos':
      return g.id === 'banca'
        ? 'Con tres registros de banca en dos semanas o más verás cuándo llegarías.'
        : 'Con tres tests en dos semanas o más verás cuándo llegarías.';
    case 'estancado':
      return 'En los últimos tres meses no has mejorado. Toca cambiar algo: más series, o un test tras una semana suave.';
    case 'en_camino':
      return `Mejoras ${num(p.perWeek)}${g.unit} por semana. A este ritmo llegarías en ${
        p.weeks! > 104 ? 'más de dos años' : `${p.weeks} ${p.weeks === 1 ? 'semana' : 'semanas'} (${monthTitle(p.date!).toLowerCase()})`
      }.`;
  }
}

/** Objetivos: una tarjeta resumida (Hoy) o una por objetivo con hitos y proyección (Progreso). */
export function GoalsSummary({ compact = false }: { compact?: boolean }) {
  const db = useSQLiteContext();
  const [current, setCurrent] = useState<Record<Goal['id'], Current> | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const now = today();
        const series: Record<Goal['id'], Point[]> = {
          dominadas: await getTestSeries(db, 'dominadas'),
          flexiones: await getTestSeries(db, 'flexiones'),
          banca: await getBenchSeries(db),
        };
        const out = {} as Record<Goal['id'], Current>;
        for (const g of GOALS) {
          const pts = series[g.id];
          const best = pts.reduce<Point | null>((b, p) => (!b || p.value > b.value ? p : b), null);
          out[g.id] = {
            value: best?.value ?? g.start,
            measured: best !== null,
            when: best?.date,
            projection: projectGoal(pts, g.target, now),
            window: goalWindow(pts, g.target, now),
          };
        }
        setCurrent(out);
      })();
    }, [db]),
  );

  if (!current) return null;

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Objetivos. Abrir progreso"
        onPress={() => router.push('/progreso')}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <Card style={{ gap: space.md }}>
          {GOALS.map((g) => {
            const c = current[g.id];
            const reached = c.value >= g.target;
            return (
              <View key={g.id} style={{ gap: 6 }}>
                <View style={styles.row}>
                  <Text style={[type.subtitle, { flex: 1 }]}>{g.title}</Text>
                  <Text style={styles.valueSmall}>
                    {num(c.value)}
                    <Text style={styles.target}>
                      {' '}
                      / {g.target}
                      {g.unit}
                    </Text>
                  </Text>
                </View>
                <ProgressBar value={goalProgress(g, c.value)} color={reached ? colors.success : colors.accent} />
              </View>
            );
          })}
        </Card>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: space.md }}>
      {GOALS.map((g) => {
        const c = current[g.id];
        const next = nextMilestone(g, c.value);
        const reached = c.value >= g.target;
        return (
          <Card key={g.id} style={{ gap: space.sm }}>
            <View style={styles.row}>
              <Text style={[type.subtitle, { flex: 1 }]}>{g.title}</Text>
              <Text style={styles.value}>
                {num(c.value)}
                <Text style={styles.target}>
                  {' '}
                  / {g.target}
                  {g.unit}
                </Text>
              </Text>
            </View>
            <ProgressBar value={goalProgress(g, c.value)} color={reached ? colors.success : colors.accent} />
            <Text style={type.caption}>
              {reached ? '¡Meta conseguida!' : next ? `Próximo hito: ${next}${g.unit}` : ''}
              {!c.measured ? ' (punto de partida)' : c.when ? ` (mejor marca, el ${formatShort(c.when)})` : ''}
            </Text>
            <View style={styles.milestones}>
              {g.milestones.map((m) => {
                const got = c.value >= m;
                return (
                  <View key={m} style={styles.milestone} accessible accessibilityLabel={`Hito de ${m}${g.unit}: ${got ? 'conseguido' : 'pendiente'}`}>
                    <Svg width={14} height={14} viewBox="0 0 14 14">
                      <Polygon points="0,14 14,14 14,0" fill={got ? colors.accent : 'none'} stroke={got ? colors.accent : colors.faint} strokeWidth={1.5} />
                    </Svg>
                    <Text style={[type.caption, got && { color: colors.text }]}>
                      {m}
                      {g.unit}
                    </Text>
                  </View>
                );
              })}
            </View>
            {!reached && (
              <Text style={[type.caption, c.projection.status === 'en_camino' && { color: colors.text }]}>{projectionText(g, c.projection)}</Text>
            )}
            {!reached && c.window && (
              <Text style={type.caption}>
                Con margen de error: {c.window.to ? `entre ${monthTitle(c.window.from).toLowerCase()} y ${monthTitle(c.window.to).toLowerCase()}` : `no antes de ${monthTitle(c.window.from).toLowerCase()}`}.
              </Text>
            )}
            {g.id !== 'banca' ? (
              <Button
                label="Tests de máximo"
                variant="secondary"
                icon="stopwatch-outline"
                onPress={() => router.push({ pathname: '/test', params: { test: g.id } })}
              />
            ) : (
              <Text style={type.caption}>Se calcula con la mejor serie de banca que registres en el gimnasio.</Text>
            )}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 20, ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
  valueSmall: { fontSize: 16, ...font.w800, color: colors.text, fontVariant: ['tabular-nums'] },
  target: { fontSize: 14, ...font.w600, color: colors.muted },
  milestones: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
