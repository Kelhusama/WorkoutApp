import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BLOCK_PASS,
  BLOCK_PLANNED,
  BLOCK_WEEKS,
  FLEX_TESTS,
  METHOD_LABEL,
  WEEKLY_TARGET,
  changeText,
  doseText,
  exerciseAt,
  formatFlexValue,
  milestones,
  sessionExercises,
  sessionMinutes,
  sessionSteps,
  testSummary,
  type TestSummary,
} from '@/domain/flexibility';
import { useFlex } from '@/hooks/useFlex';
import { Button, Card, Pill, ProgressBar } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, space, type } from '@/ui/theme';

/** Título de sección en minúsculas normales (sin mayúsculas forzadas). */
function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

function TestCard({ summary }: { summary: TestSummary }) {
  const { test, latest, series, due } = summary;
  const change = changeText(summary);
  const improved = (summary.improvement ?? 0) > 0;
  const worse = (summary.improvement ?? 0) < 0;
  const label = [
    test.name,
    latest ? `Último resultado: ${formatFlexValue(test, latest.value)}` : 'Sin medir todavía',
    change,
    due ? 'Test pendiente' : null,
    'Abrir el test',
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/flex-test', params: { test: test.id } })}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card style={styles.test}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.subtitle}>{test.name}</Text>
            <Text style={type.caption}>{test.measures}</Text>
          </View>
          {latest && <Text style={styles.value}>{formatFlexValue(test, latest.value)}</Text>}
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
        {series.length >= 2 && <LineChart points={series} height={48} compact />}
        {change && (
          <Text style={[type.caption, improved && summary.real !== false && { color: colors.success }, worse && { color: colors.warn }]}>{change}</Text>
        )}
        {!latest && <Text style={type.caption}>Sin medir todavía. Toca para ver cómo se hace y apuntar el resultado.</Text>}
        {latest && series.length === 1 && <Text style={type.caption}>Con el segundo test verás aquí el cambio y la gráfica.</Text>}
        {due && <Pill label={latest ? 'Test pendiente: ha pasado un mes' : 'Test pendiente'} color={colors.warn} />}
      </Card>
    </Pressable>
  );
}

export default function FlexibilityScreen() {
  const { view } = useFlex();

  if (!view) return <View style={{ flex: 1 }} />;

  const { progress, week, sessions, tests, today } = view;
  const plan = sessionExercises(progress.level, sessions.length);
  const minutes = sessionMinutes(sessionSteps(plan, progress.level));
  const doneToday = sessions.some((s) => s.date === today);
  const summaries = FLEX_TESTS.map((t) => testSummary(tests, t, today));
  const pendingTests = summaries.filter((s) => s.due).length;
  const marks = milestones(tests);
  const last = progress.lastBlock;

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Card style={{ gap: space.sm }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>Tu nivel</Text>
            <Text style={type.hero}>Nivel {progress.level} de 3</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.value}>
              {week.done} de {WEEKLY_TARGET}
            </Text>
            <Text style={type.caption}>esta semana</Text>
          </View>
        </View>
        <View
          style={{ gap: space.xs }}
          accessible
          accessibilityLabel={`Bloque de ${BLOCK_WEEKS} semanas: semana ${progress.weekInBlock}, ${progress.sessionsInBlock} de ${BLOCK_PLANNED} sesiones`}>
          <Text style={type.body}>
            Semana {progress.weekInBlock} de {BLOCK_WEEKS} · {progress.sessionsInBlock} de {BLOCK_PLANNED} sesiones del bloque
          </Text>
          <ProgressBar value={Math.min(1, progress.sessionsInBlock / BLOCK_PLANNED)} color={progress.sessionsInBlock >= BLOCK_PASS ? colors.success : colors.accent} />
        </View>
        <Text style={type.caption}>
          {progress.level === 3
            ? 'Estás en el nivel más alto. Mantén 3 sesiones por semana.'
            : progress.sessionsInBlock >= BLOCK_PASS
              ? 'Ya tienes las sesiones para subir de nivel al acabar el bloque.'
              : `Subes de nivel con ${BLOCK_PASS} sesiones en el bloque. Te faltan ${BLOCK_PASS - progress.sessionsInBlock}.`}
        </Text>
        <Text style={type.caption}>
          {week.met ? 'Objetivo de la semana cumplido. Hasta 5 sesiones siguen sumando.' : 'Objetivo: 3 sesiones por semana. Si fallas un día, no pasa nada.'}
        </Text>
      </Card>

      {progress.changed && (
        <Card style={[styles.notice, { borderColor: colors.success }]}>
          <Ionicons name="trending-up" size={22} color={colors.success} />
          <Text style={[type.body, { flex: 1 }]}>Bloque completado: pasas al nivel {progress.level}. Si algo duele, baja la intensidad.</Text>
        </Card>
      )}
      {!progress.changed && last && !last.passed && last.sessions > 0 && (
        <Card style={styles.notice}>
          <Ionicons name="repeat" size={22} color={colors.muted} />
          <Text style={[type.body, { flex: 1 }]}>
            En el bloque anterior hiciste {last.sessions} de {BLOCK_PLANNED} sesiones. Repites el nivel {progress.level} para asentarlo.
          </Text>
        </Card>
      )}

      <Heading>Sesión de hoy</Heading>
      <Card style={{ gap: space.md }}>
        <Text style={type.caption}>
          {doneToday ? 'Hoy ya has hecho una sesión. ' : ''}Unos {minutes} minutos · {plan.length} ejercicios · sin material
        </Text>
        <View style={{ gap: space.sm }}>
          {plan.map((ex) => {
            const { name, dose } = exerciseAt(ex, progress.level);
            return (
              <View key={ex.id} style={styles.exercise}>
                <Text style={styles.number}>{ex.n}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={type.subtitle}>{name}</Text>
                  <Text style={type.caption}>
                    {doseText(dose)} · {METHOD_LABEL[dose.method].toLowerCase()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <Button
          label={doneToday ? 'Hacer otra sesión' : 'Empezar la sesión de hoy'}
          icon="play"
          variant={doneToday ? 'secondary' : 'primary'}
          onPress={() => router.push('/flexionar')}
        />
      </Card>

      <Card style={styles.notice}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.info} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.subtitle}>Antes de empezar</Text>
          <Text style={type.caption}>Calienta 3–5 minutos (camina o mueve las articulaciones). Busca tirantez, nunca dolor. Sin rebotes.</Text>
        </View>
      </Card>

      <Heading>Tests mensuales</Heading>
      <Text style={type.caption}>
        {pendingTests === 0
          ? 'Todos al día. Repítelos una vez al mes, a la misma hora y tras calentar.'
          : `${pendingTests === 1 ? 'Tienes 1 test pendiente' : `Tienes ${pendingTests} tests pendientes`}. Hazlos una vez al mes, a la misma hora y tras calentar.`}
      </Text>
      {summaries.map((s) => (
        <TestCard key={s.test.id} summary={s} />
      ))}

      <Heading>Hitos</Heading>
      <Card style={{ gap: space.md }}>
        {marks.map((m) => (
          <View key={m.id} style={styles.exercise} accessible accessibilityLabel={`${m.label}. ${m.reached ? 'Conseguido' : m.detail}`}>
            <Ionicons name={m.reached ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={m.reached ? colors.success : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={type.subtitle}>{m.label}</Text>
              <Text style={[type.caption, m.reached && { color: colors.success }]}>{m.detail}</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  value: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  test: { gap: space.sm, minHeight: 64 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  number: { width: 24, fontSize: 15, fontWeight: '700', color: colors.muted, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
