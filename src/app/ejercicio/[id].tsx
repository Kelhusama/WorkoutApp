import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getExerciseHistory, getExerciseReserves } from '@/db/stats';
import { capacity, fitStrength, projectWindow, trendText, type Observation, type Reserve } from '@/domain/coach';
import { formatLong, formatShort, today, type ISODate } from '@/domain/dates';
import { EXAM_MIN, exam } from '@/domain/neural';
import { EXERCISES } from '@/domain/exercises';
import { amountText } from '@/domain/format';
import { exerciseStats, seriesOf, type SessionSets } from '@/domain/stats';
import { ExerciseFigure } from '@/illustrations/ExerciseFigure';
import { Card, SectionTitle, Segmented } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, space, type, font } from '@/ui/theme';

type Metric = 'best' | 'total';

export default function ExerciseScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = EXERCISES[id];
  const [history, setHistory] = useState<SessionSets[]>([]);
  const [metric, setMetric] = useState<Metric>('best');
  const [reserves, setReserves] = useState<Map<ISODate, Reserve>>(new Map());

  useFocusEffect(
    useCallback(() => {
      getExerciseHistory(db, id).then(setHistory);
      getExerciseReserves(db, id).then(setReserves);
    }, [db, id]),
  );

  if (!ex) return null;
  const stats = exerciseStats(history);
  const unit = ex.measure === 'time' ? ' s' : '';
  const perArm = ex.perArm ? ` por ${ex.side ?? 'brazo'}` : '';
  // Entrenador: nivel real estimado a partir de las series y de lo que quedaba en la última.
  const timed = ex.measure === 'time';
  const observations = useMemo(
    () => history.map((h) => capacity(h.date, h.values, reserves.get(h.date) ?? null, timed ? 5 : 1)).filter((o): o is Observation => o !== null),
    [history, reserves, timed],
  );
  const strength = fitStrength(observations);
  // Experimento: la red neuronal, examinada contra el filtro con tus datos pasados.
  const test = useMemo(() => exam(observations), [observations]);
  const round = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
  const goalValue = stats && strength && strength.trend === 'mejorando' ? Math.ceil((strength.level * 1.25) / (timed ? 5 : 1)) * (timed ? 5 : 1) : null;
  const eta = strength && goalValue ? projectWindow(strength, goalValue, today()) : null;

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

          {strength && (
            <>
              <SectionTitle>Tu nivel real</SectionTitle>
              <Card style={{ gap: space.sm }}>
                <Text style={styles.tileValue}>
                  {round(strength.level)}
                  {timed ? ' s' : ' repeticiones'}
                  <Text style={type.caption}> ± {round(strength.levelSd)}</Text>
                </Text>
                <Text style={type.caption}>
                  Lo que harías hoy en una serie a tope{perArm}, quitando el efecto de los días buenos y malos.
                </Text>
                <Text style={type.body}>{trendText(strength, timed ? 'segundos' : 'repeticiones')}</Text>
                {eta && goalValue && (
                  <Text style={type.caption}>
                    A este ritmo llegarías a {goalValue}
                    {timed ? ' s' : ''} {eta.to ? `entre el ${formatLong(eta.from).toLowerCase()} y el ${formatLong(eta.to).toLowerCase()}` : `no antes del ${formatLong(eta.from).toLowerCase()}`}.
                  </Text>
                )}
                {strength.n >= 2 && <LineChart points={strength.series} height={150} format={round} />}
                <View style={styles.exam}>
                  <Text style={type.overline}>Experimento: red neuronal</Text>
                  {test ? (
                    <Text style={type.caption}>
                      Al predecir tus últimas {test.n} sesiones, la red falla {round(test.neural)} de media y el filtro {round(test.kalman)} (decir «lo
                      mismo que la última vez» falla {round(test.last)}). {test.winner === 'neural' ? 'Aquí gana la red' : 'Aquí manda el filtro'}: para la
                      próxima sesión prevé {round(test.next)}
                      {timed ? ' s' : ''}.
                    </Text>
                  ) : (
                    <Text style={type.caption}>
                      Con {EXAM_MIN} sesiones de este ejercicio se examina una red neuronal contra el filtro y se usa la que más acierte. Llevas {observations.length}.
                    </Text>
                  )}
                </View>
                {reserves.size === 0 && (
                  <Text style={type.caption}>
                    Apunta en cada sesión cuántas te quedaban en la última serie y esta estimación será más precisa.
                  </Text>
                )}
              </Card>
            </>
          )}

          <SectionTitle>Evolución</SectionTitle>
          <Card style={{ gap: space.md }}>
            <Segmented
              label="Qué mostrar en la gráfica"
              options={[
                { id: 'best', label: 'Mejor serie' },
                { id: 'total', label: 'Total' },
              ]}
              value={metric}
              onChange={setMetric}
            />
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
  tileValue: { fontSize: 20, ...font.display, color: colors.text, fontVariant: ['tabular-nums'], marginTop: 4 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  exam: { gap: 4, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bullet: { flexDirection: 'row', gap: space.sm },
});
