import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDoneSessions, getPrescriptions, getSessionLog, getSlotStages, getSessionReserves, getSessionSets, getTripOn, saveHomeSession, type SlotChange } from '@/db/repo';
import { getSlotVariants } from '@/db/coach';
import { getTrialActive, getWeekLoad } from '@/db/settings';
import { isPullupDay, pullFatigue, withoutTrialWork } from '@/domain/event';
import { getTrialLogs } from '@/db/event';
import { setWorkoutMeta } from '@/db/workouts';
import type { State } from '@/domain/workouts';
import { StatePicker } from '@/ui/WorkoutFields';
import { VARIANT_INFO, applyVariant, type Variant } from '@/domain/bandit';
import { lightSets, readiness, type Readiness, type Reserve } from '@/domain/coach';
import { getBests } from '@/db/stats';
import { addDays, formatLong, today as getToday, weekNumber, weekStart } from '@/domain/dates';
import { EXERCISES } from '@/domain/exercises';
import { detectRecords, type NewRecord } from '@/domain/stats';
import { ROUTINES, routineAfter, routineMinutes } from '@/domain/stretches';
import { amountText, describeChange, prescriptionText } from '@/domain/format';
import type { Feeling, Prescription } from '@/domain/progression';
import { infoFor, type SessionKind } from '@/domain/schedule';
import { ROUTINE_INFO, buildRoutines, rankKeys, versionCount, type RoutineSize } from '@/domain/routines';
import { PRIORITY, exerciseFor, routineItems, stageNote, type Slot } from '@/domain/templates';
import { sessionSlots } from '@/domain/travel';
import { Button, Card, FeelingPicker, SectionTitle } from '@/ui/components';
import { syncReminders } from '@/notifications/reminders';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { ExerciseCard } from '@/ui/ExerciseCard';
import { GuidedSession } from '@/ui/GuidedSession';
import { RestTimer } from '@/ui/RestTimer';
import { colors, space, type } from '@/ui/theme';

export default function SessionScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind: string; date?: string; focus?: string }>();
  const kind = (['A', 'B', 'C'].includes(params.kind) ? params.kind : 'A') as SessionKind;
  const date = params.date ?? getToday();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [travelling, setTravelling] = useState(false);
  // Sesión enfocada: solo los ejercicios de los objetivos (semanas con uno o dos días de casa).
  const [focus, setFocus] = useState(false);
  // El plan de la prueba ha quitado las dominadas de esta sesión.
  const [trialOn, setTrialOn] = useState(false);

  const [targets, setTargets] = useState<Record<string, Prescription> | null>(null);
  const [values, setValues] = useState<Record<string, number[]>>({});
  const [reserves, setReserves] = useState<Record<string, Reserve>>({});
  // Rutina elegida: corta (ligera, no mueve el plan), media (lo esencial en 20 minutos) o larga (todo).
  const [size, setSize] = useState<RoutineSize>('media');
  const light = size === 'corta';
  // Al editar una sesión guardada se enseñan los ejercicios que se hicieron, no una rutina.
  const [savedKeys, setSavedKeys] = useState<string[] | null>(null);
  // Versión de la rutina media: cambia sola cada semana y se puede pedir otra.
  const [turn, setTurn] = useState(0);
  const [advice, setAdvice] = useState<Readiness | null>(null);
  // Bloque de prueba del entrenador: cambia lo que se pide en dominadas o flexiones.
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  // Versión más dura de cada ejercicio, si ya se completó su escalera.
  const [stages, setStages] = useState<Record<string, number>>({});
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<SlotChange[] | null>(null);
  const [records, setRecords] = useState<NewRecord[]>([]);
  const [dirty, setDirty] = useState(false);
  // Paso a paso, con dibujo y descanso automático. Una sesión ya guardada se abre como lista, para corregirla.
  const [guided, setGuided] = useState(false);
  // Cómo estabas hoy, aparte de lo dura que fuera la sesión.
  const [mood, setMood] = useState<State | null>(null);
  // Cuándo empezó la sesión guiada, para apuntar lo que dura de verdad.
  const startedAt = useRef<number | null>(null);
  useUnsavedGuard(dirty, 'las series que has apuntado');

  useEffect(() => {
    (async () => {
      // De viaje, los ejercicios se adaptan al material disponible ese día.
      const trip = await getTripOn(db, date);
      const log = await getSessionLog(db, date, kind);
      // Al editar se respeta cómo se guardó; de viaje mandan los ejercicios adaptados.
      const isFocus = !trip && (log?.status === 'done' ? log.focus === 1 : params.focus === '1');
      // Con el plan de la prueba activo, las dominadas ya se hacen allí. Una sesión ya guardada se abre como se hizo.
      const trialOn = log?.status !== 'done' && !trip && (await getTrialActive(db));
      const slots = withoutTrialWork(sessionSlots(kind, trip?.gear, isFocus, trialOn), trialOn, date);
      // Se avisa siempre que el plan haya cambiado la sesión: sin dominadas, o enfocada en flexiones y mancuerna.
      setTrialOn(trialOn && (isFocus || slots.length < sessionSlots(kind, null, false).length));
      setFocus(isFocus);
      const base = await getPrescriptions(db, slots);
      // De viaje los ejercicios son otros y el bloque no se aplica.
      const blockVariants = trip ? {} : await getSlotVariants(db);
      const t: Record<string, Prescription> = {};
      for (const s of slots) t[s.key] = applyVariant(base[s.key], s, blockVariants[s.key] ?? 'base');
      setVariants(blockVariants);
      setStages(trip ? {} : await getSlotStages(db));
      const saved = log?.status === 'done' ? await getSessionSets(db, log.id) : {};
      // El día que tocan dominadas del plan, la sesión de casa pasa a segundo plano: ligera.
      const ready: Readiness = trip
        ? { light: true, reason: 'De viaje: sesión corta y ligera. Lo importante es no perder el hilo.' }
        : trialOn && isPullupDay(date) && kind !== 'B'
          ? { light: true, reason: 'Hoy tocan dominadas del plan: hazlas primero y deja esta sesión en corta, que también tira de brazos.' }
          : readiness(await getDoneSessions(db, addDays(date, -30)), date, await getWeekLoad(db, weekStart(date)));
      // Las dominadas del plan también cansan: si los brazos van cargados, las sesiones que tiran (no la de empuje) salen cortas.
      const tired = !trip && kind !== 'B' && !ready.light ? pullFatigue(await getTrialLogs(db), date) : null;
      if (tired) {
        ready.light = true;
        ready.reason = tired;
      }
      // Al editar se respeta cómo se guardó; si no, el entrenador propone según la carga reciente.
      const startLight = log?.status === 'done' ? log.light === 1 : ready.light;
      const initial: Record<string, number[]> = {};
      for (const s of slots) initial[s.key] = saved[s.key] ?? Array(startLight ? lightSets(t[s.key].sets) : t[s.key].sets).fill(t[s.key].reps);
      setAdvice(ready);
      setSize(log?.status === 'done' ? (startLight ? 'corta' : 'larga') : startLight ? 'corta' : 'media');
      setSavedKeys(log?.status === 'done' && Object.keys(saved).length > 0 ? Object.keys(saved) : null);
      setSlots(slots);
      setTravelling(!!trip);
      setGuided(log?.status !== 'done' && date === getToday());
      setTargets(t);
      setValues(initial);
      setReserves(log?.status === 'done' ? await getSessionReserves(db, log.id) : {});
      if (log?.status === 'done') {
        setEditing(true);
        setFeeling(log.feeling);
      }
    })();
  }, [db, kind, date, params.focus]);

  // De viaje y en la sesión enfocada manda el orden de la lista; en casa, las prioridades de la sesión.
  // Lo principal es fijo y el resto rota: cada giro es una versión distinta de la rutina media.
  const present = PRIORITY[kind].filter((k) => slots.some((s) => s.key === k));
  const versions = travelling || focus ? 1 : versionCount(present);
  const order = travelling || focus ? slots.map((s) => s.key) : rankKeys(present, weekNumber(date) + turn);
  const routines = targets ? buildRoutines(routineItems(slots, targets, order)) : [];
  // Si todo cabe en 20 minutos no hay rutina larga: vale la media.
  const routine = routines.find((r) => r.size === size) ?? routines.find((r) => r.size === 'media');
  const savedSlots = savedKeys ? slots.filter((s) => savedKeys.includes(s.key)) : [];
  const activeSlots = savedSlots.length > 0 ? savedSlots : routine ? slots.filter((s) => routine.keys.includes(s.key)) : slots;
  const targetOf = (key: string): Prescription => (light && targets ? { ...targets[key], sets: lightSets(targets[key].sets) } : targets![key]);

  const changeSize = (next: RoutineSize) => {
    if (!targets || next === size) return;
    const toLight = next === 'corta';
    setSize(next);
    setDirty(true);
    // Las series precargadas se rehacen para la rutina elegida.
    const fresh: Record<string, number[]> = {};
    for (const s of slots) fresh[s.key] = Array(toLight ? lightSets(targets[s.key].sets) : targets[s.key].sets).fill(targets[s.key].reps);
    setValues(fresh);
  };

  const save = async () => {
    if (!feeling) return;
    setSaving(true);
    try {
      // Un ejercicio saltado (todas sus series a cero) no se apunta: no es lo mismo que intentarlo y no poder.
      const doneSlots = activeSlots.filter((s) => (values[s.key] ?? []).some((v) => v > 0));
      const results = doneSlots.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: values[s.key] ?? [], reserve: reserves[s.key] ?? null }));
      // Marcas anteriores a hoy, para saber si esta sesión bate algún récord.
      const before = await getBests(db, date);
      const result = await saveHomeSession(db, date, kind, feeling, results, doneSlots, light, variants, focus);
      // Lo común a cualquier entrenamiento: cómo estabas y, si se hizo guiada, lo que duró de verdad.
      const saved = await getSessionLog(db, date, kind);
      const minutes = startedAt.current ? (Date.now() - startedAt.current) / 60_000 : null;
      if (saved) await setWorkoutMeta(db, 'session_log', saved.id, { state: mood, minutes: minutes && minutes >= 2 && minutes <= 180 ? minutes : null });
      setRecords(detectRecords(before, results));
      setDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setChanges(result);
      syncReminders(db);
    } finally {
      setSaving(false);
    }
  };

  const info = infoFor(kind, focus);

  if (!targets) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (changes) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xl }}>
        <Stack.Screen options={{ title: 'Sesión guardada' }} />
        <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.xl }}>
          <Ionicons name="trophy" size={56} color={colors.accent} />
          <Text style={type.hero}>¡Sesión hecha!</Text>
          <Text style={type.caption}>{formatLong(date)}</Text>
        </View>
        {records.length > 0 && (
          <Card style={{ gap: space.md, borderColor: colors.accent, marginBottom: space.md }}>
            <Text style={[type.subtitle, { color: colors.accent }]}>
              {records.length === 1 ? '¡Nuevo récord!' : `¡${records.length} récords nuevos!`}
            </Text>
            {records.map((r) => {
              const ex = EXERCISES[r.exerciseId];
              return (
                <View key={r.exerciseId + r.kind} style={styles.changeRow}>
                  <Ionicons name="trophy" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.subtitle}>{ex.name}</Text>
                    <Text style={type.caption}>
                      {r.kind === 'serie'
                        ? `${amountText(r.value, ex)} en una serie (antes ${r.previous})`
                        : `${amountText(r.value, ex)} en toda la sesión (antes ${r.previous})`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}
        {changes.length > 0 ? (
          <>
            <SectionTitle>Para la próxima vez</SectionTitle>
            <Card style={{ gap: space.md }}>
              {changes.map((c) => {
                const ex = exerciseFor(slots.find((s) => s.key === c.slotKey)!);
                const up = c.change !== 'none';
                return (
                  <View key={c.slotKey} style={styles.changeRow}>
                    <Ionicons
                      name={up ? 'arrow-up-circle' : 'pause-circle'}
                      size={22}
                      color={up ? colors.success : colors.muted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={type.subtitle}>{ex.name}</Text>
                      <Text style={type.caption}>
                        {c.stageNote ? `Nueva versión: ${c.stageNote.toLowerCase()}. Empiezas con ${prescriptionText(c.next, ex)}.` : describeChange(c.change, c.next, ex)}
                      </Text>
                      <Text style={[type.caption, { color: colors.faint }]}>{c.reason}</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        ) : (
          <Card>
            <Text style={type.caption}>Registro actualizado. La progresión ya se aplicó la primera vez que guardaste este día.</Text>
          </Card>
        )}
        <View style={{ marginTop: space.xl, gap: space.sm }}>
          <Button
            label={`Estirar ahora (${routineMinutes(ROUTINES[routineAfter(kind)])} min)`}
            icon="body"
            onPress={() => router.replace({ pathname: '/estirar/[rutina]', params: { rutina: routineAfter(kind) } })}
          />
          <Button label="Volver" variant="secondary" onPress={() => router.back()} />
        </View>
      </ScrollView>
    );
  }

  const header = (
      <View>
        <Text style={type.overline}>{formatLong(date)}</Text>
        <Text style={type.caption}>
          {editing
            ? 'Editando un registro guardado.'
            : 'Está precargado lo planificado: corrige solo las series que no salieron así.'}
        </Text>
        {trialOn && (
          <Text style={[type.caption, { color: colors.info, marginTop: 4 }]}>
            <Ionicons name="trophy" size={12} color={colors.info} /> Sin dominadas: ya las haces en el plan de la prueba. Aquí, flexiones y mancuerna.
          </Text>
        )}
        {travelling && (
          <Text style={[type.caption, { color: colors.info, marginTop: 4 }]}>
            <Ionicons name="airplane" size={12} color={colors.info} /> Modo viaje: una sesión corta y sin material. Solo hace falta una silla firme.
          </Text>
        )}
      </View>

  );

  const modeCard = savedSlots.length > 0 ? null : (
    <Card style={{ gap: space.md }}>
      <Text style={type.subtitle}>Elige la rutina de hoy</Text>
      {advice?.light && !editing && (
        <Text style={[type.caption, { color: colors.warn }]}>
          <Ionicons name="battery-half" size={12} color={colors.warn} /> {advice.reason}
        </Text>
      )}
      {routines.map((r) => {
        const on = r.size === routine?.size;
        const names = slots.filter((s) => r.keys.includes(s.key)).map((s) => exerciseFor(s).name);
        return (
          <Pressable
            key={r.size}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Rutina ${ROUTINE_INFO[r.size].title.toLowerCase()}, unos ${r.minutes} minutos, ${names.length} ejercicios`}
            onPress={() => changeSize(r.size)}
            style={({ pressed }) => [styles.routine, on && styles.routineOn, pressed && { opacity: 0.8 }]}>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.accent : colors.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.subtitle}>
                {ROUTINE_INFO[r.size].title} · {r.minutes} min
              </Text>
              <Text style={type.caption}>{ROUTINE_INFO[r.size].detail}</Text>
              <Text style={[type.caption, { color: colors.text }]}>{names.join(' · ')}</Text>
              {on && r.size === 'media' && versions > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver otra versión de la rutina media"
                  onPress={() => {
                    setTurn((t) => (t + 1) % versions);
                    setDirty(true);
                  }}
                  style={styles.version}>
                  <Ionicons name="shuffle" size={16} color={colors.accent} />
                  <Text style={[type.caption, { color: colors.accent }]}>
                    Versión {(((weekNumber(date) + turn) % versions) + versions) % versions + 1} de {versions} · ver otra
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        );
      })}
      <Text style={type.caption}>El tiempo cuenta las series y los descansos. Hagas la que hagas, queda apuntada y el entrenador la tiene en cuenta. Lo que ayuda a las dominadas va siempre.</Text>
    </Card>
  );

  const outro = (
    <>
      <SectionTitle>¿Cómo estabas hoy?</SectionTitle>
      <StatePicker
        value={mood}
        onChange={(v) => {
          setDirty(true);
          setMood(v);
        }}
      />
      <SectionTitle>¿Cómo ha ido la sesión?</SectionTitle>
      <FeelingPicker
        value={feeling}
        onChange={(v) => {
          setDirty(true);
          setFeeling(v);
        }}
      />
      <Text style={type.caption}>
        {feeling ? '«Fácil» sube la próxima vez y «Dura» mantiene, salvo donde hayas contestado lo que te quedaba.' : 'Elige cómo ha ido para poder guardar.'}
      </Text>
      <View style={{ marginTop: space.md }}>
        <Button label={saving ? 'Guardando…' : 'Guardar sesión'} icon="checkmark-circle" onPress={save} disabled={!feeling || saving} />
      </View>
    </>
  );

  if (guided) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: `${info.title}` }} />
        <GuidedSession
          slots={activeSlots}
          targetOf={targetOf}
          values={values}
          onSets={(key, v) => {
            setDirty(true);
            setValues((prev) => ({ ...prev, [key]: v }));
          }}
          intro={
            <>
              {header}
              {modeCard}
            </>
          }
          outro={outro}
          onList={() => setGuided(false)}
          light={light}
          pairs={routine?.pairs ?? []}
          onStart={() => {
            startedAt.current = Date.now();
          }}
          bottomInset={insets.bottom}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.md }}>
      <Stack.Screen options={{ title: `${info.title}` }} />
      {header}
      {modeCard}
      {!editing && <Button label="Hacerla guiada, paso a paso" variant="secondary" icon="play" onPress={() => setGuided(true)} />}

      {activeSlots.map((s) => (
        <ExerciseCard
          key={s.key}
          slot={s}
          openFigure={travelling}
          light={light}
          target={targetOf(s.key)}
          stageNote={stageNote(s.key, stages[s.key] ?? 0) ?? undefined}
          blockNote={variants[s.key] && variants[s.key] !== 'base' ? `Bloque de prueba · ${VARIANT_INFO[variants[s.key]].label}. ${VARIANT_INFO[variants[s.key]].detail} Hasta tu próximo test.` : undefined}
          values={values[s.key] ?? []}
          onChange={(v) => {
            setDirty(true);
            setValues((prev) => ({ ...prev, [s.key]: v }));
          }}
          reserve={reserves[s.key] ?? null}
          onReserve={(r) => {
            setDirty(true);
            setReserves((prev) => ({ ...prev, [s.key]: r }));
          }}
        />
      ))}

      <SectionTitle>¿Cómo ha ido?</SectionTitle>
      <FeelingPicker
        value={feeling}
        onChange={(v) => {
          setDirty(true);
          setFeeling(v);
        }}
      />
      {activeSlots.some((s) => reserves[s.key] === undefined) && (
        <Text style={type.caption}>
          Si contestas lo que te quedaba en cada ejercicio, el entrenador afina mejor. Puedes guardar sin hacerlo.
        </Text>
      )}
      <Text style={type.caption}>
        {feeling ? 'Donde no hayas contestado lo que te quedaba, decide esta sensación: «Fácil» sube y «Dura» mantiene.' : 'Elige cómo ha ido para poder guardar.'}
      </Text>

      <View style={{ marginTop: space.md }}>
        <Button
          label={saving ? 'Guardando…' : 'Guardar sesión'}
          icon="checkmark-circle"
          onPress={save}
          disabled={!feeling || saving}
        />
      </View>
    </ScrollView>
    <RestTimer bottomInset={insets.bottom} />
    </View>
  );
}

const MODES = [
  { id: 'normal', label: 'Bien' },
  { id: 'ligera', label: 'Cansado' },
] as const;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  routine: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, minHeight: 56 },
  routineOn: { borderColor: colors.accent, backgroundColor: colors.cardHigh },
  version: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
});
