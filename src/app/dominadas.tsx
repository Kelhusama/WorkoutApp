import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addHangLog, addTrialLog, getHangLogs, getTrialLogs } from '@/db/event';
import { RESERVE_OPTIONS, type Reserve } from '@/domain/coach';
import { today as getToday } from '@/domain/dates';
import {
  ELBOW_CARE,
  GRIP_INFO,
  LIFT_INFO,
  PULLUP_REST_SECONDS,
  PULLUP_WARMUP,
  TEST_GRIP,
  doseText,
  gripFor,
  hangDose,
  isElbowCareDay,
  prescription,
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
import { colors, space, type } from '@/ui/theme';

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
  // Agarre del día según el plan; se puede cambiar si la barra o el codo piden otro.
  const [grip, setGrip] = useState<Grip>(gripFor(today) ?? TEST_GRIP);
  const rang = useRef(false);
  // Colgarse, al final: lo que toca hoy y los segundos que se apuntan.
  const [hang, setHang] = useState<HangDose | null>(null);
  const [hangSeconds, setHangSeconds] = useState(30);
  const [hangSaved, setHangSaved] = useState(false);
  const allowLeave = useUnsavedGuard(done > 0 && step !== 'hecho', 'la sesión de dominadas');

  useEffect(() => {
    (async () => {
      const week = todayPlan(today).week;
      const d = week ? prescription('dominada', week, await getTrialLogs(db)) : null;
      setDose(d);
      if (d) setReps(d.reps);
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
    await addTrialLog(db, { date: today, lift: 'dominada', weight: dose.weight, reps, sets: Math.max(1, done), reserve, grip });
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
        <Text style={styles.dose}>{doseText('dominada', dose)}</Text>
        <Text style={type.caption}>{dose.note}</Text>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={type.subtitle}>Agarre de hoy: {GRIP_INFO[grip].label.toLowerCase()}</Text>
        <Segmented label="Agarre" options={GRIPS} value={grip} onChange={setGrip} />
        <Text style={type.caption}>{GRIP_INFO[grip].how}</Text>
      </Card>

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
          <Button label="Ya he calentado: empezar las series" icon="play" onPress={() => setStep('series')} />
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
                <Text style={[type.caption, { textAlign: 'center' }]}>Suelta los brazos y respira. La siguiente tiene que salir tan limpia como la primera.</Text>
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
                <Text style={type.subtitle}>Serie {done + 1}</Text>
                <Text style={styles.clock}>
                  {dose.reps} {dose.reps === 1 ? 'repetición' : 'repeticiones'}
                </Text>
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
          <SectionTitle>3 · ¿Cómo ha salido?</SectionTitle>
          <Card style={{ gap: space.sm }}>
            <Text style={type.body}>
              Has hecho {done} {done === 1 ? 'serie' : 'series'}.
            </Text>
            <Text style={type.caption}>Repeticiones limpias en la peor serie</Text>
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
  dose: { fontSize: 18, fontWeight: '800', color: colors.accent },
  item: { flexDirection: 'row', gap: space.md },
  number: { width: 22, fontSize: 15, fontWeight: '800', color: colors.accent, textAlign: 'center' },
  clock: { fontSize: 44, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  buttons: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
});
