import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDoneSessions, getPrescriptions, getSessionLog, getSlotStages, getSessionReserves, getSessionSets, getTripOn, saveHomeSession, type SlotChange } from '@/db/repo';
import { getSlotVariants } from '@/db/coach';
import { getTrialActive, getWeekLoad } from '@/db/settings';
import { isPullupDay, withoutTrialWork } from '@/domain/event';
import { VARIANT_INFO, applyVariant, type Variant } from '@/domain/bandit';
import { lightSets, readiness, type Readiness, type Reserve } from '@/domain/coach';
import { getBests } from '@/db/stats';
import { addDays, formatLong, today as getToday, weekStart } from '@/domain/dates';
import { EXERCISES } from '@/domain/exercises';
import { detectRecords, type NewRecord } from '@/domain/stats';
import { ROUTINES, routineAfter, routineMinutes } from '@/domain/stretches';
import { amountText, describeChange, prescriptionText } from '@/domain/format';
import type { Feeling, Prescription } from '@/domain/progression';
import { infoFor, type SessionKind } from '@/domain/schedule';
import { LEG_KEYS, exerciseFor, stageNote, type Slot } from '@/domain/templates';
import { sessionSlots } from '@/domain/travel';
import { Button, Card, FeelingPicker, SectionTitle, Segmented } from '@/ui/components';
import { syncReminders } from '@/notifications/reminders';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { ExerciseCard } from '@/ui/ExerciseCard';
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
  // Sesión ligera: sin bloque de pierna y con menos series; no mueve el plan.
  const [light, setLight] = useState(false);
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
      const slots = withoutTrialWork(sessionSlots(kind, trip?.gear, isFocus), trialOn, date);
      setTrialOn(trialOn && slots.length < sessionSlots(kind, null, isFocus).length);
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
      const ready: Readiness =
        trialOn && isPullupDay(date)
          ? { light: true, reason: 'Hoy tocan dominadas del plan: hazlas primero y deja esta sesión en ligera.' }
          : readiness(await getDoneSessions(db, addDays(date, -30)), date, await getWeekLoad(db, weekStart(date)));
      // Al editar se respeta cómo se guardó; si no, el entrenador propone según la carga reciente.
      const startLight = log?.status === 'done' ? log.light === 1 : ready.light;
      const initial: Record<string, number[]> = {};
      for (const s of slots) initial[s.key] = saved[s.key] ?? Array(startLight ? lightSets(t[s.key].sets) : t[s.key].sets).fill(t[s.key].reps);
      setAdvice(ready);
      setLight(startLight);
      setSlots(slots);
      setTravelling(!!trip);
      setTargets(t);
      setValues(initial);
      setReserves(log?.status === 'done' ? await getSessionReserves(db, log.id) : {});
      if (log?.status === 'done') {
        setEditing(true);
        setFeeling(log.feeling);
      }
    })();
  }, [db, kind, date, params.focus]);

  const legs = LEG_KEYS[kind];
  const activeSlots = light ? slots.filter((s) => !legs.includes(s.key)) : slots;
  const targetOf = (key: string): Prescription => (light && targets ? { ...targets[key], sets: lightSets(targets[key].sets) } : targets![key]);

  const changeMode = (toLight: boolean) => {
    if (!targets || toLight === light) return;
    setLight(toLight);
    setDirty(true);
    // Las series precargadas se rehacen para el nuevo modo.
    const next: Record<string, number[]> = {};
    for (const s of slots) next[s.key] = Array(toLight ? lightSets(targets[s.key].sets) : targets[s.key].sets).fill(targets[s.key].reps);
    setValues(next);
  };

  const save = async () => {
    if (!feeling) return;
    setSaving(true);
    try {
      const results = activeSlots.map((s) => ({ slotKey: s.key, exerciseId: s.exerciseId, values: values[s.key] ?? [], reserve: reserves[s.key] ?? null }));
      // Marcas anteriores a hoy, para saber si esta sesión bate algún récord.
      const before = await getBests(db, date);
      const result = await saveHomeSession(db, date, kind, feeling, results, activeSlots, light, variants, focus);
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

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xl, gap: space.md }}>
      <Stack.Screen options={{ title: `${info.title}` }} />
      <View>
        <Text style={type.overline}>{formatLong(date)}</Text>
        <Text style={type.caption}>
          {editing
            ? 'Editando un registro guardado.'
            : 'Está precargado lo planificado: corrige solo las series que no salieron así.'}
        </Text>
        {trialOn && (
          <Text style={[type.caption, { color: colors.info, marginTop: 4 }]}>
            <Ionicons name="trophy" size={12} color={colors.info} /> Sin dominadas: ya las haces en el plan de la prueba del 16 de enero.
          </Text>
        )}
        {travelling && (
          <Text style={[type.caption, { color: colors.info, marginTop: 4 }]}>
            <Ionicons name="airplane" size={12} color={colors.info} /> Modo viaje: ejercicios adaptados a lo que tienes a mano.
          </Text>
        )}
      </View>

      <Card style={{ gap: space.sm }}>
        <Text style={type.subtitle}>¿Cómo llegas hoy?</Text>
        <Segmented
          label="Cómo llegas hoy"
          options={MODES}
          value={light ? 'ligera' : 'normal'}
          onChange={(m) => changeMode(m === 'ligera')}
        />
        <Text style={type.caption}>
          {light
            ? 'Sesión ligera: solo tren superior, un tercio menos de series y deja 2 o 3 repeticiones sin hacer en cada una. Hoy el plan no cambia.'
            : 'Sesión normal: según cómo salga, el entrenador sube, mantiene o baja cada ejercicio.'}
        </Text>
        {advice?.light && !editing && (
          <Text style={[type.caption, { color: colors.warn }]}>
            <Ionicons name="battery-half" size={12} color={colors.warn} /> {advice.reason}
          </Text>
        )}
      </Card>

      {activeSlots.map((s) => (
        <ExerciseCard
          key={s.key}
          slot={s}
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
});
