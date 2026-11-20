import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { addTrialLog, deleteTrialLog, getLastBodyWeight, getTrialLogs, type SavedTrialLog } from '@/db/event';
import { getReminderSettings, getTrialActive, saveTrialActive } from '@/db/settings';
import { ensurePermission, syncReminders } from '@/notifications/reminders';
import { RESERVE_OPTIONS, type Reserve } from '@/domain/coach';
import { formatLong, formatShort, today as getToday } from '@/domain/dates';
import {
  ASSUMED_BODY_KG,
  EVENT_DATE,
  EVENT_REPS,
  LIFTS,
  LIFT_INFO,
  buildPlan,
  currentLevel,
  doneThisWeek,
  doseText,
  GRIP_INFO,
  TEST_GRIP,
  estimate3RM,
  gripFor,
  gripsText,
  isPullupDay,
  prescription,
  pullupDaysText,
  todayPlan,
  type Lift,
} from '@/domain/event';
import { Button, Card, Pill, ProgressBar, SectionTitle, Segmented, Stepper, ToggleRow } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, radius, space, type } from '@/ui/theme';

const kg = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

interface Draft {
  lift: Lift;
  weight: number;
  reps: number;
  sets: number;
  reserve: Reserve | null;
}

export default function TrialScreen() {
  const db = useSQLiteContext();
  const today = getToday();
  const [logs, setLogs] = useState<SavedTrialLog[]>([]);
  const [body, setBody] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  // Plan activo: avisos los días de dominadas, a las horas de Perfil y avisos.
  const [active, setActive] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLogs(await getTrialLogs(db));
    setBody((await getLastBodyWeight(db))?.weight ?? null);
    setActive(await getTrialActive(db));
    setTimes((await getReminderSettings(db)).times);
  }, [db]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const now = todayPlan(today);
  const plan = buildPlan();
  const bodyKg = body ?? ASSUMED_BODY_KG;

  const toggle = async (on: boolean) => {
    // Sin permiso de notificaciones no hay avisos: se dice, en vez de dejar el interruptor encendido en falso.
    const ok = on ? await ensurePermission() : true;
    setDenied(on && !ok);
    setActive(on && ok);
    await saveTrialActive(db, on && ok);
    syncReminders(db);
  };

  const save = async () => {
    if (!draft) return;
    await addTrialLog(db, { date: today, ...draft, grip: draft.lift === 'dominada' ? (gripFor(today) ?? TEST_GRIP) : null });
    syncReminders(db);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDraft(null);
    load();
  };

  const remove = (l: SavedTrialLog) =>
    Alert.alert('¿Borrar esta sesión?', `${LIFT_INFO[l.lift].label}, ${formatLong(l.date).toLowerCase()}. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteTrialLog(db, l.id);
          syncReminders(db);
          load();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: space.sm }}>
        <Text style={type.caption}>{formatLong(EVENT_DATE)}</Text>
        <Text style={type.hero}>
          {now.phase === 'dia' ? 'Hoy es el día' : now.phase === 'pasado' ? 'Prueba hecha' : `Faltan ${now.daysLeft} días`}
        </Text>
        {now.week && (
          <Text style={type.body}>
            Semana {9 - now.week.weeksLeft} de 8 · <Text style={{ fontWeight: '700' }}>{now.week.title}</Text>
          </Text>
        )}
        {now.phase === 'dia' && (
          <Text style={type.body}>
            Calienta largo, empieza con un peso que sabes que sale y no intentes nada que no hayas hecho ya entrenando, o como mucho 2,5–5 kg más.
          </Text>
        )}
        {now.phase === 'pasado' && <Text style={type.body}>Una semana suave y vuelta al plan normal.</Text>}
      </Card>

      {now.week && (
        <Card style={{ gap: space.sm }}>
          <ToggleRow title="Plan activo" detail="Avisos los días de dominadas y sin dominadas repetidas en casa" value={active} onChange={toggle} />
          <Text style={type.caption}>
            {active
              ? `Esta semana tocan dominadas el ${pullupDaysText(now.week)}. Avisos a las ${times.join(', ')}; las horas se cambian en Perfil y avisos. Mientras esté activo, tus sesiones de casa no traen dominadas: ya las haces aquí.`
              : `Al activarlo, te avisaré el ${pullupDaysText(now.week)}, hasta tres veces al día mientras no las hayas apuntado, y quitaré las dominadas de tus sesiones de casa para no cargar los codos por los dos lados.`}
          </Text>
          {denied && (
            <Text style={[type.caption, { color: colors.danger }]}>No hay permiso para mostrar avisos. Actívalo en los ajustes del móvil y vuelve a encenderlo.</Text>
          )}
        </Card>
      )}

      {LIFTS.map((lift) => {
        const info = LIFT_INFO[lift];
        const level = currentLevel(lift, logs, today, bodyKg);
        const dose = now.week ? prescription(lift, now.week, logs) : null;
        const done = now.week ? doneThisWeek(lift, now.week, logs) : 0;
        const series = logs
          .filter((l) => l.lift === lift && l.reps > 0)
          .map((l) => ({ date: l.date, value: lift === 'dominada' ? estimate3RM(bodyKg + l.weight, l.reps) - bodyKg : estimate3RM(l.weight, l.reps) }));
        const reached = level >= info.target;
        const editing = draft?.lift === lift;
        return (
          <View key={lift} style={{ gap: space.md }}>
            <SectionTitle>{info.label}</SectionTitle>
            <Card style={{ gap: space.sm }}>
              <View style={styles.row}>
                <Text style={[type.caption, { flex: 1 }]}>
                  Objetivo: {EVENT_REPS} repeticiones con {kg(info.target)} {info.unit}
                </Text>
                {reached && <Pill label="A tu alcance" color={colors.success} bg={colors.successSoft} />}
              </View>
              <Text style={styles.level}>
                {level <= 0 && lift === 'dominada' ? 'Sin lastre' : `${kg(level)} ${info.unit}`}
                <Text style={type.caption}> · donde estás hoy, a {EVENT_REPS}</Text>
              </Text>
              <ProgressBar value={Math.max(0, Math.min(1, level / info.target))} color={reached ? colors.success : colors.accent} />
              <Text style={type.caption}>
                Estimado a partir de tu mejor sesión de las últimas tres semanas
                {lift === 'dominada' ? ` y de tu peso (${body ? `${kg(body)} kg` : `${ASSUMED_BODY_KG} kg supuestos: apunta tu peso en Cuerpo`})` : ''}. No es una medida.
              </Text>
            </Card>

            {dose && now.week && (
              <Card style={{ gap: space.sm, borderColor: colors.accent }}>
                <View style={styles.row}>
                  <Text style={[type.subtitle, { flex: 1 }]}>Esta semana</Text>
                  <Pill
                    label={`${Math.min(done, dose.days)} de ${dose.days} ${dose.days === 1 ? 'día' : 'días'}`}
                    color={done >= dose.days ? colors.success : colors.accent}
                    bg={done >= dose.days ? colors.successSoft : colors.accentSoft}
                  />
                </View>
                <Text style={styles.dose}>{doseText(lift, dose)}</Text>
                <Text style={type.caption}>{dose.note}</Text>
                {lift === 'dominada' && (
                  <Text style={type.caption}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>Agarres de la semana:</Text> {gripsText(now.week)}. El prono se repite más porque
                    es el que doy por hecho para la prueba ({GRIP_INFO[TEST_GRIP].how.split('.')[0].toLowerCase()}).
                  </Text>
                )}
                {lift === 'dominada' && !editing && (
                  <Button
                    label={isPullupDay(today) ? 'Empezar la sesión guiada' : 'Hacer una sesión guiada hoy'}
                    icon="play"
                    variant={isPullupDay(today) && !logs.some((l) => l.lift === 'dominada' && l.date === today) ? 'primary' : 'secondary'}
                    onPress={() => router.push('/dominadas')}
                  />
                )}
                {!editing ? (
                  <Button
                    label={lift === 'dominada' ? 'Apuntar a mano' : done >= dose.days ? 'Apuntar otra sesión' : 'Apuntar la sesión de hoy'}
                    variant={lift === 'dominada' || done >= dose.days ? 'secondary' : 'primary'}
                    icon="create-outline"
                    onPress={() => setDraft({ lift, weight: dose.weight, reps: dose.reps, sets: dose.sets, reserve: null })}
                  />
                ) : (
                  <View style={styles.form}>
                    <Text style={type.caption}>Lo que has hecho de verdad (si alguna serie salió peor, apunta la peor)</Text>
                    <Stepper
                      label={lift === 'dominada' ? 'lastre' : 'peso'}
                      value={draft.weight}
                      onChange={(v) => setDraft({ ...draft, weight: v })}
                      step={info.step}
                      min={0}
                      suffix={lift === 'dominada' ? ' kg de lastre' : ' kg'}
                      format={kg}
                    />
                    <Stepper label="repeticiones" value={draft.reps} onChange={(v) => setDraft({ ...draft, reps: v })} min={1} suffix=" reps" />
                    <Stepper label="series" value={draft.sets} onChange={(v) => setDraft({ ...draft, sets: v })} min={1} suffix=" series" />
                    <Text style={type.overline}>En la última serie, ¿cuántas más habrías podido hacer?</Text>
                    <Segmented
                      label="Lo que te quedaba en la última serie"
                      options={RESERVE_OPTIONS}
                      value={draft.reserve === null ? null : (String(draft.reserve) as `${Reserve}`)}
                      onChange={(v) => setDraft({ ...draft, reserve: Number(v) as Reserve })}
                    />
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button label="Cancelar" variant="secondary" onPress={() => setDraft(null)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button label="Guardar" icon="checkmark-circle" onPress={save} />
                      </View>
                    </View>
                  </View>
                )}
              </Card>
            )}

            <Card style={{ flexDirection: 'row', gap: space.md }}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} style={{ marginTop: 2 }} />
              <Text style={[type.caption, { flex: 1 }]}>{info.rules}</Text>
            </Card>

            {series.length >= 2 && (
              <Card style={{ gap: space.sm }}>
                <Text style={type.caption}>Evolución, expresada como en la prueba ({info.unit} a {EVENT_REPS} repeticiones)</Text>
                <LineChart points={series} height={150} format={kg} />
              </Card>
            )}
          </View>
        );
      })}

      <SectionTitle>El plan entero</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPlan }} onPress={() => setShowPlan((s) => !s)} style={[styles.row, { minHeight: 48 }]}>
          <Text style={[type.subtitle, { flex: 1 }]}>Las 8 semanas, una a una</Text>
          <Ionicons name={showPlan ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {showPlan &&
          plan.map((w) => {
            const current = now.week?.weeksLeft === w.weeksLeft;
            return (
              <View key={w.weeksLeft} style={[styles.week, current && { borderColor: colors.accent }]}>
                <Text style={type.subtitle}>
                  Semana {9 - w.weeksLeft} · {w.title}
                  {current ? '  ·  ahora' : ''}
                </Text>
                <Text style={type.caption}>
                  {formatShort(w.from)} – {formatShort(w.to)}
                </Text>
                {LIFTS.map((lift) => (
                  <Text key={lift} style={type.body}>
                    <Text style={{ fontWeight: '700' }}>{lift === 'dominada' ? 'Dominadas' : 'Peso muerto'}:</Text> {w.doses[lift].days}{' '}
                    {w.doses[lift].days === 1 ? 'día' : 'días'}, {doseText(lift, w.doses[lift])}
                  </Text>
                ))}
              </View>
            );
          })}
        <Text style={type.caption}>
          Los kilos del plan son el camino previsto; lo que te pide cada semana se ajusta a lo que vayas apuntando. Además: cada kilo de peso
          corporal que pierdas es un kilo menos que subir en la dominada.
        </Text>
      </Card>

      <Card style={{ flexDirection: 'row', gap: space.md }}>
        <Ionicons name="alert-circle-outline" size={20} color={colors.warn} style={{ marginTop: 2 }} />
        <Text style={[type.caption, { flex: 1 }]}>
          Para o afloja si notas dolor punzante en codo, hombro o espalda, si el dolor sigue al día siguiente en el mismo punto, o si una
          repetición solo sale deformando la técnica. Mientras dure el plan, recorta remos y jalones pesados en el gimnasio.
        </Text>
      </Card>

      {logs.length > 0 && (
        <>
          <SectionTitle>Sesiones apuntadas</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {[...logs]
              .reverse()
              .slice(0, 12)
              .map((l) => (
                <View key={l.id} style={[styles.row, { minHeight: 56 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.subtitle}>
                      {l.lift === 'dominada' ? 'Dominadas' : 'Peso muerto'} · {l.sets} × {l.reps}
                      {l.lift === 'dominada' ? (l.weight > 0 ? ` con ${kg(l.weight)} kg` : ' sin lastre') : ` con ${kg(l.weight)} kg`}
                      {l.grip ? ` · ${GRIP_INFO[l.grip].label.toLowerCase()}` : ''}
                    </Text>
                    <Text style={type.caption}>{formatLong(l.date)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Borrar la sesión de ${LIFT_INFO[l.lift].label.toLowerCase()} del ${formatLong(l.date).toLowerCase()}`}
                    onPress={() => remove(l)}
                    style={styles.delete}>
                    <Ionicons name="trash-outline" size={20} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  level: { fontSize: 24, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  dose: { fontSize: 18, fontWeight: '800', color: colors.accent },
  form: { gap: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  week: { gap: 2, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  delete: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
