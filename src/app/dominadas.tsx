import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addHangLog, addTrialLog, getHangLogs, getTrialLogs } from '@/db/event';
import { getGymWork } from '@/db/repo';
import { setWorkoutMeta } from '@/db/workouts';
import type { State } from '@/domain/workouts';
import { StatePicker } from '@/ui/WorkoutFields';
import { RESERVE_OPTIONS, pullWarning, type Reserve } from '@/domain/coach';
import { addDays, today as getToday } from '@/domain/dates';
import {
  ELBOW_CARE,
  GRIP_INFO,
  LIFT_INFO,
  PULLUP_REST_SECONDS,
  PULLUP_WARMUP,
  TEST_GRIP,
  doseText,
  gripPlan,
  gripPlanText,
  hangDose,
  pullFatigue,
  slowNegatives,
  isElbowCareDay,
  pullupDose,
  todayPlan,
  type Dose,
  type Grip,
  type HangDose,
} from '@/domain/event';
import { ROUTINES, routineMinutes } from '@/domain/stretches';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, ProgressBar, SectionTitle, Segmented, Stepper } from '@/ui/components';
import { cancelEnd, scheduleEnd } from '@/ui/RestTimer';
import { colors, space, type, font } from '@/ui/theme';

type Step = 'calentar' | 'series' | 'apuntar' | 'hecho';

const GRIPS = (['prono', 'supino', 'neutro'] as const).map((id) => ({ id, label: GRIP_INFO[id].label }));

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Sesión guiada de dominadas: calentamiento, series con descanso cronometrado, registro y estiramientos. */
export default function PullupSession() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const today = getToday();
  useKeepAwake();

  const [dose, setDose] = useState<Dose | null | undefined>(undefined);
  const [step, setStep] = useState<Step>('calentar');
  const [done, setDone] = useState(0);
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [reps, setReps] = useState(1);
  const [reserve, setReserve] = useState<Reserve | null>(null);
  const rang = useRef(false);
  // Cómo estabas hoy y cuándo empezaron las series, para lo común a cualquier entrenamiento.
  const [mood, setMood] = useState<State | null>(null);
  const startedAt = useRef<number | null>(null);
  // Colgarse, al final: lo que toca hoy y los segundos que se apuntan.
  const [hang, setHang] = useState<HangDose | null>(null);
  const [hangSeconds, setHangSeconds] = useState(30);
  const [hangSaved, setHangSaved] = useState(false);
  // Aviso si ayer u hoy ya hubo tirón en el gimnasio.
  const [warning, setWarning] = useState<string | null>(null);
  // Bajadas lentas para acabar, los días que tocan.
  const [negatives, setNegatives] = useState(0);
  const allowLeave = useUnsavedGuard(done > 0 && step !== 'hecho', 'la sesión de dominadas');

  useEffect(() => {
    (async () => {
      const week = todayPlan(today).week;
      const logs = await getTrialLogs(db);
      const d = week ? pullupDose(today, week, logs) : null;
      setDose(d);
      if (d) setReps(d.reps);
      // Aviso si ayer u hoy hubo tirón en el gimnasio, o si las últimas sesiones de dominadas fueron al límite.
      setNegatives(slowNegatives(today, logs));
      const tired = pullFatigue(logs, today);
      setWarning(
        pullWarning(await getGymWork(db, addDays(today, -2)), today) ??
          (tired ? tired.replace('hoy afloja en todo lo que tire de brazos', 'hoy para una serie antes si la técnica se rompe, y no añadas lastre') : null),
      );
      const h = hangDose(await getHangLogs(db), today);
      setHang(h);
      if (!h.max) setHangSeconds(h.seconds);
    })();
  }, [db, today]);

  // Cuenta atrás del descanso: vibra al acabar; si la app está en segundo plano, avisa con una notificación.
  useEffect(() => {
    if (restEnds === null) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((restEnds - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !rang.current) {
        rang.current = true;
        Vibration.vibrate([0, 400, 200, 400]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cancelEnd();
        setRestEnds(null);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restEnds]);
  useEffect(() => cancelEnd, []);

  const startRest = (seconds: number) => {
    rang.current = false;
    setLeft(seconds);
    setRestEnds(Date.now() + seconds * 1000);
    scheduleEnd(seconds);
  };
  const stopRest = () => {
    cancelEnd();
    rang.current = true;
    setRestEnds(null);
    setLeft(0);
  };

  if (dose === undefined) return <View style={{ flex: 1 }} />;
  if (dose === null) {
    return (
      <View style={{ padding: space.lg }}>
        <Card>
          <Text style={type.body}>El plan de la prueba ya ha terminado. Las dominadas siguen en tus sesiones de casa.</Text>
        </Card>
      </View>
    );
  }

  // El agarre de cada serie lo marca el plan: no se elige.
  const grips = gripPlan(dose.sets, today);
  const kinds = [...new Set(grips)];
  const grip: Grip = grips[Math.min(done, grips.length - 1)] ?? TEST_GRIP;
  const resting = restEnds !== null;
  const finishSet = () => {
    Haptics.selectionAsync();
    const n = done + 1;
    setDone(n);
    if (n >= dose.sets) {
      stopRest();
      setStep('apuntar');
    } else {
      startRest(PULLUP_REST_SECONDS);
    }
  };

  const save = async () => {
    const logId = await addTrialLog(db, { date: today, lift: 'dominada', weight: dose.weight, reps, sets: Math.max(1, done), reserve, grip: grips[grips.length - 1] ?? TEST_GRIP });
    const minutes = startedAt.current ? (Date.now() - startedAt.current) / 60_000 : null;
    await setWorkoutMeta(db, 'trial_log', logId, { state: mood, minutes: minutes && minutes >= 2 && minutes <= 120 ? minutes : null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    allowLeave();
    setStep('hecho');
  };

  const stretchMinutes = routineMinutes(ROUTINES.postA);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: insets.bottom + space.xxl }}>
      <Card style={{ gap: 4 }}>
        <Text style={type.caption}>Hoy</Text>
        <Text style={styles.dose}>{dose.test ? 'Test de máximo: una serie, todas las limpias' : doseText('dominada', dose)}</Text>
        <Text style={type.caption}>{dose.note}</Text>
      </Card>

      {warning && (
        <Card style={{ flexDirection: 'row', gap: space.md, borderColor: colors.warn }}>
          <Ionicons name="alert-circle" size={20} color={colors.warn} style={{ marginTop: 2 }} />
          <Text style={[type.caption, { flex: 1, color: colors.text }]}>{warning}</Text>
        </Card>
      )}

      {step !== 'hecho' && (
        <Card style={{ gap: space.sm }}>
          <Text style={type.subtitle}>Agarres de hoy: {gripPlanText(grips)}</Text>
          {kinds.map((g) => (
            <Text key={g} style={type.caption}>
              <Text style={{ ...font.w700, color: colors.text }}>{GRIP_INFO[g].label}.</Text> {GRIP_INFO[g].how}
            </Text>
          ))}
          {kinds.length > 1 && (
            <Text style={type.caption}>Primero las del agarre de la prueba, que es el que hay que dominar; después las del otro. En cada serie te digo cuál toca.</Text>
          )}
        </Card>
      )}

      {step === 'calentar' && (
        <>
          <SectionTitle>1 · Calentamiento (3–4 minutos)</SectionTitle>
          <Card style={{ gap: space.md }}>
            {PULLUP_WARMUP.map((w, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.number}>{i + 1}</Text>
                <Text style={[type.body, { flex: 1 }]}>{w}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.item}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} style={{ marginTop: 2 }} />
            <Text style={[type.caption, { flex: 1 }]}>{LIFT_INFO.dominada.rules}</Text>
          </Card>
          <Button label="Ya he calentado: empezar las series" icon="play" onPress={() => {
              startedAt.current = Date.now();
              setStep('series');
            }}
          />
        </>
      )}

      {step === 'series' && (
        <>
          <SectionTitle>2 · Las series</SectionTitle>
          <Card style={{ gap: space.md, alignItems: 'center' }}>
            <Text style={type.caption} accessibilityLiveRegion="polite">
              {done} de {dose.sets} series hechas
            </Text>
            <View style={{ alignSelf: 'stretch' }}>
              <ProgressBar value={done / dose.sets} />
            </View>
            {resting ? (
              <>
                <Text style={type.subtitle}>Descansa</Text>
                <Text style={styles.clock} accessibilityLabel={`Quedan ${left} segundos de descanso`}>
                  {mmss(left)}
                </Text>
                <Text style={[type.caption, { textAlign: 'center' }]}>
                  Suelta los brazos y respira. La siguiente, en agarre {GRIP_INFO[grip].label.toLowerCase()}, tiene que salir tan limpia como la primera.
                </Text>
                <View style={styles.buttons}>
                  <View style={{ flex: 1 }}>
                    <Button label="+30 s" variant="secondary" onPress={() => startRest(left + 30)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Ya estoy listo" variant="secondary" onPress={stopRest} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={type.subtitle}>
                  Serie {done + 1} · agarre {GRIP_INFO[grip].label.toLowerCase()}
                </Text>
                <Text style={styles.clock}>{dose.test ? 'Todas las limpias' : `${dose.reps} ${dose.reps === 1 ? 'repetición' : 'repeticiones'}`}</Text>
                <Text style={[type.caption, { textAlign: 'center' }]}>
                  {dose.weight > 0 ? `Con ${String(dose.weight).replace('.', ',')} kg en la mochila. ` : ''}Desde brazos estirados hasta la barbilla por encima de la barra.
                </Text>
                <View style={{ alignSelf: 'stretch' }}>
                  <Button label="Serie hecha" icon="checkmark-circle" onPress={finishSet} />
                </View>
              </>
            )}
          </Card>
          {done > 0 && <Button label="Terminar aquí y apuntar" variant="ghost" onPress={() => (stopRest(), setStep('apuntar'))} />}
        </>
      )}

      {step === 'apuntar' && (
        <>
          {negatives > 0 && (
            <>
              <SectionTitle>3 · Para acabar: {negatives} bajadas lentas</SectionTitle>
              <Card style={{ gap: space.sm }}>
                <Text style={type.body}>Sube con un salto o desde un escalón y baja en 5 segundos, frenando todo el recorrido hasta estirar los brazos. Un minuto de descanso entre las dos.</Text>
                <Text style={type.caption}>Es de lo que más fuerza da para la dominada con lastre. Si el codo molesta, sáltatelas: hoy no son obligatorias.</Text>
              </Card>
            </>
          )}
          <SectionTitle>{negatives > 0 ? '4' : '3'} · ¿Cómo ha salido?</SectionTitle>
          <Card style={{ gap: space.sm }}>
            <Text style={type.body}>
              Has hecho {done} {done === 1 ? 'serie' : 'series'}.
            </Text>
            <Text style={type.caption}>{dose.test ? 'Repeticiones limpias que han salido' : 'Repeticiones limpias en la peor serie'}</Text>
            <Stepper label="repeticiones" value={reps} onChange={setReps} min={1} suffix=" reps" />
            <Text style={type.overline}>En la última serie, ¿cuántas más habrías podido hacer?</Text>
            <Segmented
              label="Lo que te quedaba en la última serie"
              options={RESERVE_OPTIONS}
              value={reserve === null ? null : (String(reserve) as `${Reserve}`)}
              onChange={(v) => setReserve(Number(v) as Reserve)}
            />
            <Text style={type.caption}>
              {reserve === null ? 'Con esta respuesta el plan decide si subes de lastre. Puedes guardar sin contestar.' : 'Con margen, el plan te deja subir; al límite, repite.'}
            </Text>
            <Text style={type.overline}>¿Cómo estabas hoy? (opcional)</Text>
            <StatePicker value={mood} onChange={setMood} />
            <Button label="Guardar la sesión" icon="checkmark-circle" onPress={save} />
          </Card>
        </>
      )}

      {step === 'hecho' && (
        <>
          <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.lg }}>
            <Ionicons name="trophy" size={52} color={colors.accent} />
            <Text style={type.hero}>¡Dominadas hechas!</Text>
          </View>
          {hang && (
            <>
              <SectionTitle>Para acabar: colgarse</SectionTitle>
              <Card style={{ gap: space.sm }}>
                <Text style={type.body}>{hang.text}</Text>
                <Text style={type.caption}>Brazos estirados y hombros activos, sin encogerte. Cuenta los segundos o usa un cronómetro.</Text>
                {hangSaved ? (
                  <Text style={[type.caption, { color: colors.success }]} accessibilityLiveRegion="polite">
                    Apuntado: {hangSeconds} s.
                  </Text>
                ) : (
                  <>
                    <Stepper label="segundos colgado" value={hangSeconds} onChange={setHangSeconds} step={5} min={5} suffix=" s" />
                    <Button
                      label={hang.max ? 'Apuntar mi marca' : 'Apuntar lo que aguanté'}
                      variant="secondary"
                      icon="checkmark-circle"
                      onPress={async () => {
                        await addHangLog(db, today, hangSeconds);
                        setHangSaved(true);
                      }}
                    />
                  </>
                )}
              </Card>
            </>
          )}
          {isElbowCareDay(today) && (
            <>
              <SectionTitle>Hoy toca cuidar los codos (3 minutos)</SectionTitle>
              <Card style={{ gap: space.md }}>
                {ELBOW_CARE.map((w, i) => (
                  <View key={i} style={styles.item}>
                    <Ionicons name="medkit-outline" size={18} color={colors.info} style={{ marginTop: 2 }} />
                    <Text style={[type.body, { flex: 1 }]}>{w}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}
          <Button
            label={`Estirar ahora (${stretchMinutes} min)`}
            icon="body"
            onPress={() => router.replace({ pathname: '/estirar/[rutina]', params: { rutina: 'postA' } })}
          />
          <Button label="Volver" variant="secondary" onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dose: { fontSize: 18, ...font.w800, color: colors.accent },
  item: { flexDirection: 'row', gap: space.md },
  number: { width: 22, fontSize: 15, ...font.w800, color: colors.accent, textAlign: 'center' },
  clock: { fontSize: 44, ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
});
