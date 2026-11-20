import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadFlex, recordFlexSession } from '@/db/flexibility';
import { today } from '@/domain/dates';
import {
  FLEX_BY_ID,
  FLEX_PREP_SECONDS,
  FLEX_ZONE_LABEL,
  METHOD_HINT,
  METHOD_LABEL,
  WEEKLY_TARGET,
  doseText,
  exerciseAt,
  nextPhase,
  phaseSeconds,
  sessionExercises,
  sessionSteps,
  weekAdherence,
  type FlexExercise,
  type FlexLevel,
  type FlexPhase,
  type FlexStep,
} from '@/domain/flexibility';
import { ExerciseFigure } from '@/illustrations/ExerciseFigure';
import { Button, Card, ProgressBar } from '@/ui/components';
import { colors, radius, space, type, font } from '@/ui/theme';

function say(text: string, enabled: boolean) {
  if (!enabled) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: 'es-ES', rate: 1 });
  } catch {
    // Sin voz disponible: la sesión sigue con vibración y pantalla.
  }
}

const timed = (phase: FlexPhase) => phase !== 'reps';

function phaseLength(step: FlexStep, phase: FlexPhase): number {
  return phase === 'prep' ? FLEX_PREP_SECONDS : phase === 'contract' ? step.contract : phase === 'hold' ? step.hold : 0;
}

/** Lo que se hará en el paso, en pocas palabras: «6 repeticiones», «aprieta 6 s y mantén 30 s». */
function stepText(step: FlexStep): string {
  const parts: string[] = [];
  if (step.reps) parts.push(`${step.reps} repeticiones`);
  if (step.contract) parts.push(`aprieta ${step.contract} segundos`);
  if (step.hold) parts.push(`mantén ${step.hold} segundos`);
  return parts.join(' y ');
}

interface Plan {
  level: FlexLevel;
  exercises: FlexExercise[];
  /** Días con sesión antes de empezar esta, para el resumen. */
  dates: string[];
}

export default function FlexSessionScreen() {
  const db = useSQLiteContext();
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    loadFlex(db, today()).then(({ progress, sessions }) =>
      setPlan({ level: progress.level, exercises: sessionExercises(progress.level, sessions.length), dates: sessions.map((s) => s.date) }),
    );
  }, [db]);

  if (!plan) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'Sesión de flexibilidad' }} />
      </View>
    );
  }
  return <Player plan={plan} />;
}

function Player({ plan }: { plan: Plan }) {
  useKeepAwake();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { level } = plan;
  const steps = useMemo(() => sessionSteps(plan.exercises, level), [plan.exercises, level]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<FlexPhase>('prep');
  const [endsAt, setEndsAt] = useState(() => Date.now() + FLEX_PREP_SECONDS * 1000);
  const [left, setLeft] = useState<number>(FLEX_PREP_SECONDS);
  /** Milisegundos que quedaban al pausar; `null` si está en marcha. */
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [voice, setVoice] = useState(true);
  const [finished, setFinished] = useState(false);
  /** Segundos hechos por ejercicio. */
  const done = useRef(new Map<string, number>());
  const saved = useRef(false);
  /** Evita que una misma cuenta atrás termine dos veces. */
  const firedFor = useRef(0);

  const step = steps[index];
  const exercise = FLEX_BY_ID[step.exerciseId];
  const { name, figure, dose } = exerciseAt(exercise, level);

  const credit = (seconds: number) => {
    if (seconds > 0) done.current.set(step.exerciseId, (done.current.get(step.exerciseId) ?? 0) + seconds);
  };

  const save = async () => {
    if (saved.current) return;
    saved.current = true;
    const seconds = [...done.current.values()].reduce((a, b) => a + b, 0);
    await recordFlexSession(db, { date: today(), level, seconds, exercises: [...done.current.keys()] });
  };

  const finish = async () => {
    Speech.stop();
    await save();
    setFinished(true);
  };

  const startPhase = (p: FlexPhase, s: FlexStep) => {
    const seconds = phaseLength(s, p);
    setPhase(p);
    setPausedLeft(null);
    setLeft(seconds);
    setEndsAt(Date.now() + seconds * 1000);
  };

  const goTo = (next: number) => {
    if (next >= steps.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      say('Sesión terminada. Buen trabajo.', voice);
      finish();
      return;
    }
    setIndex(next);
    startPhase('prep', steps[next]);
  };

  /** Da por hecha la fase actual y pasa a la siguiente, o al paso siguiente. */
  const completePhase = () => {
    credit(phaseSeconds(step, phase));
    const next = nextPhase(step, phase);
    if (next) {
      if (phase === 'prep') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else Vibration.vibrate(200);
      startPhase(next, step);
    } else {
      Vibration.vibrate(350);
      goTo(index + 1);
    }
  };

  // Anuncia cada fase al empezar.
  useEffect(() => {
    if (finished) return;
    if (phase === 'prep') {
      const first = step.set === 1 && step.side !== 2;
      say(
        step.side === 2
          ? 'Cambia de lado.'
          : first
            ? `${name}. ${stepText(step)}${step.side ? ', por cada lado' : ''}${dose.note ? `. ${dose.note}` : ''}.`
            : `Serie ${step.set} de ${step.sets}.`,
        voice,
      );
    } else if (phase === 'contract') {
      say(`Aprieta ${step.contract} segundos.`, voice);
    } else if (phase === 'hold' && (step.contract > 0 || step.reps > 0)) {
      say(step.contract > 0 ? 'Suelta y mantén.' : `Mantén ${step.hold} segundos.`, voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, finished]);

  useEffect(() => {
    if (finished || pausedLeft !== null || !timed(phase)) return;
    const tick = () => {
      const ms = endsAt - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms > 0 || firedFor.current === endsAt) return;
      firedFor.current = endsAt;
      completePhase();
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, phase, pausedLeft, finished, index]);

  // Al salir con el botón de atrás se guarda lo hecho hasta ese momento.
  useEffect(
    () => () => {
      Speech.stop();
      if (done.current.size > 0) void save();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const togglePause = () => {
    Haptics.selectionAsync();
    if (pausedLeft === null) {
      setPausedLeft(Math.max(0, endsAt - Date.now()));
    } else {
      setEndsAt(Date.now() + pausedLeft);
      setPausedLeft(null);
    }
  };

  /** Apunta lo aguantado de la fase actual; la preparación y las repeticiones a medias no suman. */
  const recordPartial = () => {
    if (phase !== 'contract' && phase !== 'hold') return;
    const remaining = pausedLeft !== null ? pausedLeft / 1000 : Math.max(0, (endsAt - Date.now()) / 1000);
    credit(Math.max(0, Math.round(phaseLength(step, phase) - remaining)));
  };

  const skip = () => {
    recordPartial();
    goTo(index + 1);
  };

  const stopNow = () => {
    recordPartial();
    finish();
  };

  if (finished) {
    const ids = [...done.current.keys()];
    const seconds = [...done.current.values()].reduce((a, b) => a + b, 0);
    const total = Math.round(seconds / 60);
    const any = ids.length > 0 && seconds > 0;
    const week = weekAdherence(any ? [...plan.dates, today()] : plan.dates, today());
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        <Stack.Screen options={{ title: 'Sesión de flexibilidad', headerRight: undefined }} />
        <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.xl }}>
          <Ionicons name={any ? 'checkmark-circle' : 'close-circle-outline'} size={56} color={any ? colors.success : colors.muted} />
          <Text style={type.hero}>{any ? '¡Hecho!' : 'Sin registrar'}</Text>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {any
              ? `${total < 1 ? 'Menos de 1 minuto' : `${total} min`} de trabajo guardados en el nivel ${level}.`
              : 'No has llegado a completar ningún ejercicio, así que no se ha guardado nada.'}
          </Text>
        </View>
        {any && (
          <>
            <Card style={styles.weekRow}>
              <Text style={styles.weekValue}>
                {week.done} de {WEEKLY_TARGET}
              </Text>
              <Text style={[type.body, { flex: 1 }]}>{week.met ? 'esta semana. Objetivo cumplido.' : 'esta semana.'}</Text>
            </Card>
            <Text accessibilityRole="header" style={styles.heading}>
              Lo que has trabajado
            </Text>
            <Card style={{ gap: space.sm }}>
              {ids.map((id) => (
                <View key={id} style={styles.doneRow}>
                  <Ionicons name="checkmark" size={18} color={colors.success} />
                  <Text style={[type.body, { flex: 1 }]}>{exerciseAt(FLEX_BY_ID[id], level).name}</Text>
                  <Text style={type.caption}>{FLEX_ZONE_LABEL[FLEX_BY_ID[id].zone]}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
        <Button label="Volver" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  const paused = pausedLeft !== null;
  const shown = paused ? Math.ceil(pausedLeft / 1000) : left;
  const next = steps[index + 1];
  const active = phase !== 'prep' && !paused;
  const phaseLabel = paused
    ? 'En pausa'
    : phase === 'prep'
      ? step.side === 2
        ? 'Cambia de lado'
        : 'Colócate'
      : phase === 'reps'
        ? 'Repeticiones'
        : phase === 'contract'
          ? 'Aprieta sin moverte'
          : 'Mantén';
  const hint =
    phase === 'prep'
      ? `Después: ${stepText(step)}`
      : phase === 'reps'
        ? `A tu ritmo${dose.note ? `, ${dose.note}` : ''}. Pulsa «Hecho» al acabar.`
        : phase === 'contract'
          ? `A media fuerza${dose.note ? `: ${dose.note}` : ''}.`
          : METHOD_HINT[dose.method];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: `Flexibilidad · nivel ${level}`,
          headerRight: () => (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: voice }}
              accessibilityLabel="Indicaciones por voz"
              style={styles.headerButton}
              onPress={() => {
                if (voice) Speech.stop();
                setVoice((v) => !v);
              }}>
              <Ionicons name={voice ? 'volume-high' : 'volume-mute'} size={24} color={voice ? colors.accent : colors.muted} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }}>
        <View style={{ gap: space.sm }}>
          <Text style={type.caption}>
            Paso {index + 1} de {steps.length}
          </Text>
          <ProgressBar value={index / steps.length} />
        </View>

        <View style={{ gap: 2 }}>
          <Text style={type.title}>{name}</Text>
          <Text style={[type.body, { color: colors.accent, ...font.w700 }]}>
            {FLEX_ZONE_LABEL[exercise.zone]} · serie {step.set} de {step.sets}
            {step.side ? ` · lado ${step.side} de 2` : ''}
          </Text>
          <Text style={type.caption}>
            {METHOD_LABEL[dose.method]} · {doseText(dose)}
          </Text>
        </View>

        <View style={[styles.timer, active && { borderColor: colors.accent }]}>
          <Text style={styles.phase}>{phaseLabel}</Text>
          <Text
            style={[styles.time, phase === 'prep' && { color: colors.muted }]}
            accessibilityLabel={phase === 'reps' ? `${step.reps} repeticiones` : `${shown} segundos`}>
            {phase === 'reps' ? `×${step.reps}` : shown}
          </Text>
          <Text style={[type.caption, { textAlign: 'center', paddingHorizontal: space.md }]}>{hint}</Text>
        </View>

        {figure && (
          <View style={{ alignItems: 'center' }}>
            <ExerciseFigure exerciseId={figure} size={180} />
          </View>
        )}

        <Card style={{ gap: space.sm }}>
          {exercise.cues.map((c) => (
            <View key={c} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 2 }} />
              <Text style={[type.body, { flex: 1 }]}>{c}</Text>
            </View>
          ))}
          <View style={styles.bullet}>
            <Ionicons name="close-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
            <Text style={[type.body, { flex: 1, color: colors.muted }]}>Evita: {exercise.mistake.toLowerCase()}</Text>
          </View>
        </Card>

        {next && (
          <Text style={type.caption}>
            Después:{' '}
            {next.exerciseId !== step.exerciseId
              ? exerciseAt(FLEX_BY_ID[next.exerciseId], level).name
              : next.side === 2
                ? 'el otro lado'
                : `serie ${next.set} de ${next.sets}`}
          </Text>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: space.sm + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          {phase === 'reps' ? (
            <Button label="Hecho" icon="checkmark" onPress={completePhase} />
          ) : (
            <Button label={paused ? 'Seguir' : 'Pausa'} icon={paused ? 'play' : 'pause'} variant="secondary" onPress={togglePause} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Saltar" icon="play-skip-forward" variant="secondary" onPress={skip} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Terminar" variant="ghost" onPress={stopNow} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 17, ...font.w700, color: colors.text, marginTop: space.md },
  timer: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  phase: { fontSize: 15, ...font.w700, color: colors.muted },
  time: { fontSize: 72, ...font.display, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 80 },
  bullet: { flexDirection: 'row', gap: space.sm },
  weekRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  weekValue: { fontSize: 28, ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
