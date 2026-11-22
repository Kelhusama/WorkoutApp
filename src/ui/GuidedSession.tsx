import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import type React from 'react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';

import { amountText, prescriptionText } from '@/domain/format';
import { guidePlan, type Pair, type PlanStep } from '@/domain/guide';
import type { Prescription } from '@/domain/progression';
import { exerciseFor, restSeconds, restText, type Slot } from '@/domain/templates';
import { ExerciseFigure } from '@/illustrations/ExerciseFigure';
import { Button, Card, ProgressBar, SectionTitle, Stepper } from './components';
import { cancelEnd, scheduleEnd } from './RestTimer';
import { colors, space, type, font } from './theme';

type Phase = 'inicio' | 'serie' | 'descanso' | 'fin';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  slots: Slot[];
  targetOf: (key: string) => Prescription;
  values: Record<string, number[]>;
  /** Apunta las series de un ejercicio según se van haciendo. */
  onSets: (key: string, values: number[]) => void;
  /** Lo que se enseña antes de empezar (elegir la rutina). */
  intro?: ReactNode;
  /** Lo que se enseña al acabar (cómo ha ido y guardar). */
  outro: ReactNode;
  /** Salir a la lista completa, para corregir a mano. */
  onList: () => void;
  bottomInset?: number;
  /** Sesión ligera: descansos más cortos. */
  light?: boolean;
  /** Parejas de ejercicios que se alternan (superseries), por clave. */
  pairs?: readonly (readonly [string, string])[];
}

/**
 * Sesión paso a paso: una serie cada vez, con el dibujo del ejercicio, y el descanso que arranca solo.
 * En las superseries alterna los dos ejercicios. Los aguantes (barca, planchas) tienen su cuenta atrás.
 */
export function GuidedSession({ slots, targetOf, values, onSets, intro, outro, onList, bottomInset = 0, light = false, pairs = [] }: Props) {
  useKeepAwake();
  const [phase, setPhase] = useState<Phase>('inicio');
  // Paso por el que se va, dentro de todas las series de la sesión.
  const [index, setIndex] = useState(0);
  const [amount, setAmount] = useState(0);
  const [doneSets, setDoneSets] = useState(0);
  // Ejercicios que se han dejado a medias: sus series pendientes ya no se piden.
  const [skipped, setSkipped] = useState<number[]>([]);
  // Cuenta atrás: de descanso o del aguante de un ejercicio por tiempo.
  const [timer, setTimer] = useState<{ ends: number; kind: 'rest' | 'hold' } | null>(null);
  const [left, setLeft] = useState(0);
  // En los aguantes por cada lado, la cuenta se hace dos veces seguidas.
  const [secondSide, setSecondSide] = useState(false);
  const rang = useRef(false);
  const onEnd = useRef<() => void>(() => {});
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const setsKey = slots.map((s) => `${s.key}:${targetOf(s.key).sets}`).join('|');
  const pairsKey = pairs.map((p) => p.join('+')).join('|');
  const steps: PlanStep[] = useMemo(() => {
    const at = (k: string) => slots.findIndex((s) => s.key === k);
    const byIndex: Pair[] = pairs.map(([a, b]) => [at(a), at(b)] as const).filter(([a, b]) => a >= 0 && b >= 0);
    return guidePlan(
      slots.map((s) => ({ sets: targetOf(s.key).sets, rest: restSeconds(s, light) })),
      byIndex,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsKey, pairsKey, light]);

  const step = steps[index];
  const slot = step ? slots[step.slot] : undefined;
  const target = slot ? targetOf(slot.key) : null;
  const ex = slot ? exerciseFor(slot) : null;
  const partner = step?.partner !== undefined && !skipped.includes(step.partner) ? slots[step.partner] : undefined;
  const total = steps.length;

  useEffect(() => {
    if (!timer) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((timer.ends - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !rang.current) {
        rang.current = true;
        Vibration.vibrate([0, 400, 200, 400]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cancelEnd();
        setTimer(null);
        onEnd.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timer]);
  useEffect(() => cancelEnd, []);

  const start = (seconds: number, kind: 'rest' | 'hold') => {
    rang.current = false;
    setLeft(seconds);
    setTimer({ ends: Date.now() + seconds * 1000, kind });
    scheduleEnd(seconds);
  };
  const stop = () => {
    cancelEnd();
    rang.current = true;
    setTimer(null);
    setLeft(0);
  };
  const top = () => scroll.current?.scrollTo({ y: 0, animated: false });

  /** Siguiente serie que queda por hacer, saltando los ejercicios que se han dejado. */
  const nextIndex = (from: number, without: readonly number[]) => {
    for (let k = from + 1; k < steps.length; k++) if (!without.includes(steps[k].slot)) return k;
    return -1;
  };

  const goTo = (next: number, rest: number | null) => {
    top();
    if (next < 0) {
      stop();
      setPhase('fin');
      return;
    }
    setSecondSide(false);
    setIndex(next);
    setAmount(targetOf(slots[steps[next].slot].key).reps);
    if (rest === null) {
      stop();
      setPhase('serie');
    } else {
      setPhase('descanso');
      start(rest, 'rest');
    }
  };

  /** Apunta la serie actual con lo que se ha hecho y pasa a la siguiente. */
  const finishSet = (value: number) => {
    if (!step || !slot || !target) return;
    Haptics.selectionAsync();
    const list = Array.from({ length: target.sets }, (_, k) => values[slot.key]?.[k] ?? target.reps);
    list[step.set] = value;
    onSets(slot.key, list);
    setDoneSets((n) => n + 1);
    const next = nextIndex(index, skipped);
    // Si lo siguiente es otra serie del mismo ejercicio (su pareja se saltó), el descanso es el normal, no el corto.
    const rest = next >= 0 && steps[next].slot === step.slot ? restSeconds(slot, light) : step.rest;
    goTo(next, rest);
  };

  /** Deja el ejercicio: las series que faltaban quedan a cero. */
  const skip = () => {
    if (!step || !slot || !target) return;
    const list = Array.from({ length: target.sets }, (_, k) => (k < step.set ? (values[slot.key]?.[k] ?? target.reps) : 0));
    onSets(slot.key, list);
    const without = [...skipped, step.slot];
    setSkipped(without);
    goTo(nextIndex(index, without), null);
  };

  // Al acabar la cuenta: tras el descanso toca la serie; tras un aguante, la serie queda hecha.
  onEnd.current = () => {
    if (phase === 'descanso') setPhase('serie');
    else if (phase === 'serie' && target) {
      if (ex?.perArm && !secondSide) {
        setSecondSide(true);
        start(target.reps, 'hold');
      } else finishSet(amount || target.reps);
    }
  };

  const side = ex?.perArm ? (ex.side === 'lado' ? ' por cada lado' : ` con cada ${ex.side ?? 'brazo'}`) : '';
  const holding = phase === 'serie' && timer?.kind === 'hold';

  // Bloques para el resumen del principio: ejercicios sueltos y superseries.
  const blocks: { slots: Slot[] }[] = [];
  const seen = new Set<number>();
  for (const s of steps) {
    if (seen.has(s.slot)) continue;
    seen.add(s.slot);
    const group = [slots[s.slot]];
    if (s.partner !== undefined && !seen.has(s.partner)) {
      seen.add(s.partner);
      group.push(slots[s.partner]);
    }
    blocks.push({ slots: group });
  }

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: bottomInset + space.xxl }}>
      {phase !== 'inicio' && phase !== 'fin' && (
        <View style={{ gap: 6 }}>
          <Text style={type.caption} accessibilityLiveRegion="polite">
            {doneSets} de {total} series hechas
          </Text>
          <ProgressBar value={total ? doneSets / total : 0} />
        </View>
      )}

      {phase === 'inicio' && (
        <>
          {intro}
          <SectionTitle>Lo que vas a hacer</SectionTitle>
          <Card style={{ gap: space.md }}>
            {blocks.map((b, k) => (
              <View key={b.slots[0].key} style={styles.item}>
                <Text style={styles.number}>{k + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  {b.slots.length > 1 && (
                    <Text style={[type.overline, { color: colors.accent }]}>
                      <Ionicons name="swap-vertical" size={12} color={colors.accent} /> Superserie: alterna una serie de cada
                    </Text>
                  )}
                  {b.slots.map((s) => (
                    <View key={s.key}>
                      <Text style={type.subtitle}>{exerciseFor(s).name}</Text>
                      <Text style={type.caption}>
                        {prescriptionText(targetOf(s.key), exerciseFor(s))}
                        {b.slots.length === 1 ? ` · descanso de ${restText(restSeconds(s, light))}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Card>
          <Text style={type.caption}>
            Te llevo serie a serie, con el dibujo de cada ejercicio. El descanso arranca solo y avisa con una vibración.
            {pairs.length > 0 ? ' En las superseries el descanso es corto porque, mientras haces un ejercicio, descansan los músculos del otro.' : ''}
          </Text>
          <Button
            label="Empezar"
            icon="play"
            onPress={() => {
              if (steps.length === 0) return;
              setIndex(0);
              setAmount(targetOf(slots[steps[0].slot].key).reps);
              setPhase('serie');
              top();
            }}
          />
          <Button label="Prefiero la lista completa" variant="ghost" onPress={onList} />
        </>
      )}

      {phase === 'serie' && step && slot && target && ex && (
        <>
          <Card style={{ gap: space.md, alignItems: 'center' }}>
            {partner && (
              <Text style={[type.overline, { color: colors.accent, textAlign: 'center' }]}>
                <Ionicons name="swap-vertical" size={12} color={colors.accent} /> Superserie con {exerciseFor(partner).name.toLowerCase()}
              </Text>
            )}
            <Text style={[type.title, { textAlign: 'center' }]}>{ex.name}</Text>
            <ExerciseFigure exerciseId={ex.id} size={190} />
            <Text style={type.subtitle}>
              Serie {step.set + 1} de {target.sets}
            </Text>
            {holding ? (
              <>
                <Text style={styles.clock} accessibilityLabel={`Quedan ${left} segundos`}>
                  {mmss(left)}
                </Text>
                <Text style={[type.caption, { textAlign: 'center' }]}>
                  {ex.perArm ? (secondSide ? 'Ahora el otro lado. ' : 'Primer lado: al acabar, cambia sin parar. ') : ''}Aguanta. Respira sin soltar la postura.
                </Text>
                <View style={{ alignSelf: 'stretch' }}>
                  <Button
                    label="He parado antes"
                    variant="secondary"
                    onPress={() => {
                      const held = Math.max(0, amount - left);
                      setSecondSide(false);
                      stop();
                      finishSet(Math.floor(held / 5) * 5);
                    }}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.clock}>{amountText(target.reps, ex)}</Text>
                {side !== '' && <Text style={type.caption}>{side.trim()}</Text>}
                {slot.note && <Text style={[type.caption, { textAlign: 'center' }]}>{slot.note}</Text>}
                {ex.measure === 'time' ? (
                  <View style={{ alignSelf: 'stretch', gap: space.sm }}>
                    <Button
                      label={`Empezar la cuenta de ${target.reps} s${ex.perArm ? ' por lado' : ''}`}
                      icon="play"
                      onPress={() => {
                        setAmount(target.reps);
                        setSecondSide(false);
                        start(target.reps, 'hold');
                      }}
                    />
                    <Button label="Ya la he hecho" variant="secondary" onPress={() => finishSet(target.reps)} />
                  </View>
                ) : (
                  <View style={{ alignSelf: 'stretch', gap: space.sm }}>
                    <Text style={[type.caption, { textAlign: 'center' }]}>Si han salido otras, corrígelo antes de seguir</Text>
                    <Stepper label="repeticiones" value={amount} onChange={setAmount} min={0} suffix=" reps" />
                    <Button label="Serie hecha" icon="checkmark-circle" onPress={() => finishSet(amount)} />
                  </View>
                )}
              </>
            )}
          </Card>
          <Card style={{ gap: space.sm }}>
            {ex.cues.slice(0, 3).map((c) => (
              <View key={c} style={styles.item}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 2 }} />
                <Text style={[type.body, { flex: 1, fontSize: 14 }]}>{c}</Text>
              </View>
            ))}
            {ex.mistakes.slice(0, 1).map((m) => (
              <View key={m} style={styles.item}>
                <Ionicons name="close-circle" size={16} color={colors.danger} style={{ marginTop: 2 }} />
                <Text style={[type.caption, { flex: 1 }]}>Evita: {m.toLowerCase()}</Text>
              </View>
            ))}
          </Card>
          {!holding && <Button label="Saltar este ejercicio" variant="ghost" onPress={skip} />}
        </>
      )}

      {phase === 'descanso' && step && slot && target && ex && (
        <>
          <Card style={{ gap: space.md, alignItems: 'center' }}>
            <Text style={type.subtitle}>{partner ? 'Cambia de ejercicio' : 'Descansa'}</Text>
            <Text style={styles.clock} accessibilityLabel={`Quedan ${left} segundos de descanso`}>
              {mmss(left)}
            </Text>
            <View style={styles.buttons}>
              <View style={{ flex: 1 }}>
                <Button label="+15 s" variant="secondary" onPress={() => start(left + 15, 'rest')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Ya estoy listo"
                  variant="secondary"
                  onPress={() => {
                    stop();
                    setPhase('serie');
                  }}
                />
              </View>
            </View>
          </Card>
          <SectionTitle>Ahora viene</SectionTitle>
          <Card style={{ gap: space.sm, alignItems: 'center' }}>
            <Text style={[type.subtitle, { textAlign: 'center' }]}>{ex.name}</Text>
            {(step.set === 0 || partner) && <ExerciseFigure exerciseId={ex.id} size={150} />}
            <Text style={type.caption}>
              Serie {step.set + 1} de {target.sets} · {amountText(target.reps, ex)}
              {side}
            </Text>
          </Card>
        </>
      )}

      {phase === 'fin' && (
        <>
          <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.md }}>
            <Ionicons name="checkmark-done-circle" size={52} color={colors.accent} />
            <Text style={type.hero}>¡Series hechas!</Text>
            <Text style={[type.caption, { textAlign: 'center' }]}>Ya está todo apuntado. Dime cómo ha ido y guarda.</Text>
          </View>
          {outro}
          <Button label="Repasar o corregir las series" variant="ghost" onPress={onList} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: space.md },
  number: { width: 22, fontSize: 15, ...font.w800, color: colors.accent, textAlign: 'center' },
  clock: { fontSize: 44, ...font.display, color: colors.text, fontVariant: ['tabular-nums'], textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
});
