import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveStretching } from '@/db/stretch';
import { today } from '@/domain/dates';
import { PREP_SECONDS, ROUTINES, STRETCHES, ZONE_LABEL, ZONE_ORDER, minutesByZone, routineSteps, type RoutineId } from '@/domain/stretches';
import { ExerciseFigure } from '@/illustrations/ExerciseFigure';
import { Button, Card, ProgressBar, SectionTitle } from '@/ui/components';
import { colors, radius, space, type, font } from '@/ui/theme';

type Phase = 'prep' | 'hold';

function say(text: string, enabled: boolean) {
  if (!enabled) return;
  try {
    Speech.stop();
    Speech.speak(text, { language: 'es-ES', rate: 1 });
  } catch {
    // Sin voz disponible: la rutina sigue con vibración y pantalla.
  }
}

export default function StretchPlayer() {
  useKeepAwake();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rutina: string }>();
  const routine = ROUTINES[(params.rutina in ROUTINES ? params.rutina : 'inferior') as RoutineId];
  const steps = useMemo(() => routineSteps(routine), [routine]);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('prep');
  const [endsAt, setEndsAt] = useState(() => Date.now() + PREP_SECONDS * 1000);
  const [left, setLeft] = useState(PREP_SECONDS);
  /** Milisegundos que quedaban al pausar; `null` si está en marcha. */
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [voice, setVoice] = useState(true);
  const [finished, setFinished] = useState(false);
  const done = useRef<{ stretchId: string; seconds: number }[]>([]);
  const saved = useRef(false);

  const step = steps[index];
  const stretch = STRETCHES[step.stretchId];

  const finish = async () => {
    if (saved.current) return;
    saved.current = true;
    Speech.stop();
    if (done.current.some((d) => d.seconds > 0)) await saveStretching(db, today(), routine.id, done.current);
    setFinished(true);
  };

  const goTo = (next: number) => {
    if (next >= steps.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      say('Rutina terminada. Buen trabajo.', voice);
      finish();
      return;
    }
    setIndex(next);
    setPhase('prep');
    setPausedLeft(null);
    setLeft(PREP_SECONDS);
    setEndsAt(Date.now() + PREP_SECONDS * 1000);
  };

  // Anuncia cada paso al empezar su preparación.
  useEffect(() => {
    if (finished || phase !== 'prep') return;
    say(
      step.side === 2
        ? `Cambia de lado. ${step.seconds} segundos.`
        : `${stretch.name}. ${step.seconds} segundos${step.side === 1 ? ' por lado' : ''}.`,
      voice,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, phase, finished]);

  useEffect(() => {
    if (finished || pausedLeft !== null) return;
    const tick = () => {
      const ms = endsAt - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms > 0) return;
      if (phase === 'prep') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPhase('hold');
        setLeft(step.seconds);
        setEndsAt(Date.now() + step.seconds * 1000);
      } else {
        Vibration.vibrate(350);
        done.current.push({ stretchId: step.stretchId, seconds: step.seconds });
        goTo(index + 1);
      }
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, phase, pausedLeft, finished, index]);

  useEffect(() => () => void Speech.stop(), []);

  const togglePause = () => {
    Haptics.selectionAsync();
    if (pausedLeft === null) {
      setPausedLeft(Math.max(0, endsAt - Date.now()));
    } else {
      setEndsAt(Date.now() + pausedLeft);
      setPausedLeft(null);
    }
  };

  /** Apunta lo aguantado del paso actual; en la fase de preparación no suma nada. */
  const recordPartial = () => {
    if (phase !== 'hold') return;
    const remaining = pausedLeft !== null ? pausedLeft / 1000 : Math.max(0, (endsAt - Date.now()) / 1000);
    done.current.push({ stretchId: step.stretchId, seconds: Math.max(0, Math.round(step.seconds - remaining)) });
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
    const entries = done.current.map((d) => ({ date: today(), ...d }));
    const zones = minutesByZone(entries);
    const total = Math.round(entries.reduce((a, e) => a + e.seconds, 0) / 60);
    const worked = ZONE_ORDER.filter((z) => zones[z] > 0);
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xl }}>
        <Stack.Screen options={{ title: 'Estiramientos' }} />
        <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.xl }}>
          <Ionicons name={worked.length ? 'checkmark-circle' : 'close-circle-outline'} size={56} color={worked.length ? colors.success : colors.muted} />
          <Text style={type.hero}>{worked.length ? '¡Hecho!' : 'Sin registrar'}</Text>
          <Text style={type.caption}>
            {worked.length ? `${total < 1 ? 'Menos de 1 minuto' : `${total} min`} de estiramiento guardados.` : 'No has llegado a mantener ningún estiramiento.'}
          </Text>
        </View>
        {worked.length > 0 && (
          <>
            <SectionTitle>Lo que has trabajado</SectionTitle>
            <Card style={{ gap: space.sm }}>
              {worked.map((z) => (
                <View key={z} style={styles.zoneRow}>
                  <Text style={[type.body, { flex: 1 }]}>{ZONE_LABEL[z]}</Text>
                  <Text style={type.subtitle}>{String(zones[z]).replace('.', ',')} min</Text>
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

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: routine.title,
          headerRight: () => (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: voice }}
              accessibilityLabel="Voz"
              hitSlop={12}
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
          <Text style={type.title}>{stretch.name}</Text>
          <Text style={[type.body, { color: colors.accent, ...font.w700 }]}>
            {ZONE_LABEL[stretch.zone]}
            {step.side ? ` · lado ${step.side} de 2` : ''}
          </Text>
        </View>

        <View style={[styles.timer, phase === 'hold' && !paused && { borderColor: colors.accent }]}>
          <Text style={type.overline}>{paused ? 'En pausa' : phase === 'prep' ? (step.side === 2 ? 'Cambia de lado' : 'Colócate') : 'Mantén'}</Text>
          <Text style={[styles.time, phase === 'prep' && { color: colors.muted }]} accessibilityLabel={`${shown} segundos`}>
            {shown}
          </Text>
          <Text style={type.caption}>{phase === 'prep' ? `Después, ${step.seconds} segundos` : 'Tirantez suave, sin dolor. Respira lento.'}</Text>
        </View>

        {stretch.figure && (
          <View style={{ alignItems: 'center' }}>
            <ExerciseFigure exerciseId={stretch.figure} size={190} />
          </View>
        )}

        <Card style={{ gap: space.sm }}>
          {stretch.cues.map((c) => (
            <View key={c} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 1 }} />
              <Text style={[type.body, { flex: 1, fontSize: 14 }]}>{c}</Text>
            </View>
          ))}
          <View style={styles.bullet}>
            <Ionicons name="close-circle" size={16} color={colors.danger} style={{ marginTop: 1 }} />
            <Text style={[type.caption, { flex: 1 }]}>Evita: {stretch.mistake.toLowerCase()}</Text>
          </View>
        </Card>

        {next && (
          <Text style={type.caption}>
            Después: {next.stretchId === step.stretchId ? 'el otro lado' : STRETCHES[next.stretchId].name}
          </Text>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: space.sm + insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <Button label={paused ? 'Seguir' : 'Pausa'} icon={paused ? 'play' : 'pause'} variant="secondary" onPress={togglePause} />
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
  timer: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  time: { fontSize: 72, ...font.display, color: colors.text, fontVariant: ['tabular-nums'], lineHeight: 80 },
  bullet: { flexDirection: 'row', gap: space.sm },
  zoneRow: { flexDirection: 'row', alignItems: 'center' },
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
