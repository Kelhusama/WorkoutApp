import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getBodyLog } from '@/db/body';
import { deleteLog, getDoneSessions, getPrescriptions, markMissed } from '@/db/repo';
import { getBlocks, getSlotVariants } from '@/db/coach';
import { applyVariant, testsDue, type TestDue } from '@/domain/bandit';
import { WEEK_LOAD_INFO, extraKind, readiness, type Readiness, type WeekLoad } from '@/domain/coach';
import { getTrialActive, getWeekLoad, saveWeekLoad } from '@/db/settings';
import { getPhotos, getRecentFeelings } from '@/db/stats';
import { monthlyCheck } from '@/domain/physique';
import { stretchedOn } from '@/db/stretch';
import { addDays, formatLong, formatShort, today as getToday, weekStart, weekdayIndex } from '@/domain/dates';
import { getTrialLogs } from '@/db/event';
import { EVENT_NAME, LIFTS, doneThisWeek, doseText, isPullupDay, withoutTrialWork, prescription as trialDose, todayPlan as trialToday, type TrialLog } from '@/domain/event';
import { prescriptionShort } from '@/domain/format';
import { needsDeload } from '@/domain/gymTools';
import { WALK_LABEL } from '@/domain/march';
import { FEELING_LABEL, TEMPO_LABEL, type Prescription } from '@/domain/progression';
import { SESSION_INFO, infoFor, isHomeKind, type SessionKind } from '@/domain/schedule';
import { ROUTINES, routineAfter, routineMinutes } from '@/domain/stretches';
import { exerciseFor } from '@/domain/templates';
import { gearSummary, sessionSlots } from '@/domain/travel';
import { useMarch } from '@/hooks/useMarch';
import { useStreak } from '@/hooks/useStreak';
import { useWeek } from '@/hooks/useWeek';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, Pill, SectionTitle, Segmented, type IconName } from '@/ui/components';
import { GoalsSummary } from '@/ui/goals';
import { openDay } from '@/ui/navigation';
import { colors, space, type } from '@/ui/theme';
import { STATUS_STYLE, WeekStrip } from '@/ui/week';

const LOADS: readonly { id: WeekLoad; label: string }[] = (['menos', 'normal', 'mas'] as const).map((id) => ({ id, label: WEEK_LOAD_INFO[id].label }));

/** Fila de «Plan de hoy»: una cosa, una acción. */
function PlanRow({
  icon,
  title,
  detail,
  onPress,
  tint = colors.accent,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onPress?: () => void;
  tint?: string;
}) {
  const body: ReactNode = (
    <Card style={styles.planRow}>
      <Ionicons name={icon} size={22} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={type.subtitle}>{title}</Text>
        <Text style={type.caption}>{detail}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Card>
  );
  if (!onPress) return <View accessible accessibilityLabel={`${title}. ${detail}`}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  );
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const todayDate = getToday();
  const { days, reload } = useWeek(todayDate);
  const streak = useStreak();
  const march = useMarch().view;
  const day = days.find((d) => d.date === todayDate);
  const [prescriptions, setPrescriptions] = useState<Record<string, Prescription> | null>(null);
  const [lastWeighIn, setLastWeighIn] = useState<string | null | undefined>(undefined);
  const [deload, setDeload] = useState(false);
  // Revisión mensual de cinta y fotos.
  const [monthly, setMonthly] = useState<{ due: boolean; detail: string } | null>(null);
  // Tests de máximo que tocan, para que el entrenador pueda comparar bloques.
  const [tests, setTests] = useState<TestDue[]>([]);
  // Lo que el usuario decide para esta semana: menos, normal o más.
  const [weekLoad, setWeekLoad] = useState<WeekLoad>('normal');
  // Sesiones apuntadas para la prueba del 16 de enero.
  const [trialLogs, setTrialLogs] = useState<TrialLog[]>([]);
  const [trialActive, setTrialActive] = useState(false);
  const [stretched, setStretched] = useState(true);
  const [showExercises, setShowExercises] = useState(false);
  // Sesión extra en día de descanso: cuál propone el entrenador y si conviene que sea ligera.
  const [extra, setExtra] = useState<{ kind: SessionKind; ready: Readiness } | null>(null);
  const [showMore, setShowMore] = useState(false);

  const kind: SessionKind | null = day && isHomeKind(day.type) ? day.type : null;
  const focus = day?.focus ?? false;
  const trip = day?.trip;
  const gear = trip?.gear;
  // De viaje los ejercicios se adaptan al material disponible.
  const slots = useMemo(
    () =>
      kind
        ? withoutTrialWork(sessionSlots(kind, gear ? { mochila: gear.mochila, mesa: gear.mesa, gimnasio: gear.gimnasio } : null, focus), trialActive && !gear, todayDate)
        : [],
    [kind, focus, trialActive, todayDate, gear?.mochila, gear?.mesa, gear?.gimnasio], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFocusEffect(
    useCallback(() => {
      if (slots.length) {
        // Lo que se verá en la sesión: el plan, pasado por el bloque de prueba del entrenador si lo hay.
        Promise.all([getPrescriptions(db, slots), gear ? Promise.resolve({} as Awaited<ReturnType<typeof getSlotVariants>>) : getSlotVariants(db)]).then(([p, v]) =>
          setPrescriptions(Object.fromEntries(slots.map((s) => [s.key, applyVariant(p[s.key], s, v[s.key] ?? 'base')]))),
        );
      }
      getBodyLog(db).then(async (log) => {
        setLastWeighIn(log.length ? log[log.length - 1].date : null);
        const photos = await getPhotos(db);
        setMonthly(monthlyCheck(log, photos.map((p) => p.date), todayDate));
      });
      getRecentFeelings(db).then((f) => setDeload(needsDeload(f)));
      if (kind) stretchedOn(db, todayDate, routineAfter(kind)).then(setStretched);
      getBlocks(db).then((b) => setTests(testsDue(b, todayDate)));
      getTrialLogs(db).then(setTrialLogs);
      getTrialActive(db).then(setTrialActive);
      (async () => {
        const load = await getWeekLoad(db, weekStart(todayDate));
        const done = await getDoneSessions(db, addDays(todayDate, -30));
        setWeekLoad(load);
        setExtra({ kind: extraKind(done), ready: readiness(done, todayDate, load) });
      })();
    }, [db, slots, kind, todayDate, gear]),
  );

  const needsWeighIn = lastWeighIn === null || (lastWeighIn != null && lastWeighIn <= addDays(todayDate, -7));

  const skipToday = () => {
    if (!day || day.type === 'rest' || day.type === 'movilidad') return;
    Alert.alert('¿Hoy no entrenas?', 'La sesión se marcará como fallada. Puedes deshacerlo después.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Marcar como fallada',
        style: 'destructive',
        onPress: async () => {
          await markMissed(db, todayDate, day.type as SessionKind | 'gym');
          setShowMore(false);
          reload();
          syncReminders(db);
        },
      },
    ]);
  };

  const undoMissed = async () => {
    if (!day || day.type === 'rest' || day.type === 'movilidad') return;
    await deleteLog(db, todayDate, day.type as SessionKind | 'gym');
    reload();
    syncReminders(db);
  };

  const info = day ? infoFor(day.type, focus) : null;
  const status = day ? STATUS_STYLE[day.status] : null;
  const routine = kind ? ROUTINES[routineAfter(kind)] : null;
  const trial = trialToday(todayDate);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.md }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Hoy</Text>
          <Text style={[type.hero, { marginTop: 2 }]}>{formatLong(todayDate)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Perfil y avisos" onPress={() => router.push('/perfil')} style={styles.round}>
          <Ionicons name="person-circle-outline" size={26} color={colors.text} />
        </Pressable>
      </View>

      {/* Lo de hoy, con la acción principal justo debajo del título */}
      {day && info && status && (
        <Card style={{ gap: space.md }}>
          <View style={styles.headerRow}>
            <View style={styles.icon}>
              <Ionicons name={info.icon as IconName} size={26} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>{info.title}</Text>
              <Text style={type.caption}>{info.subtitle}</Text>
            </View>
            {day.type !== 'rest' && <Pill label={status.label} color={status.color} bg={status.bg} />}
          </View>

          {day.type === 'rest' && <Text style={type.caption}>Hoy toca descansar. El músculo crece mientras te recuperas.</Text>}
          {(day.type === 'rest' || (day.type === 'movilidad' && weekLoad === 'mas')) && extra && weekLoad !== 'menos' && (
            <>
              <Text style={type.caption}>
                Si aun así quieres entrenar, te propongo la sesión «{SESSION_INFO[extra.kind].title}»
                {extra.ready.light ? `, en versión ligera. ${extra.ready.reason}` : '.'}
              </Text>
              <Button
                label="Hacer una sesión extra"
                variant="secondary"
                icon="add-circle-outline"
                onPress={() => openDay(extra.kind, todayDate)}
              />
            </>
          )}

          {day.type !== 'rest' && day.status === 'pending' && (
            <Button
              label={day.type === 'gym' ? 'Registrar gimnasio' : day.type === 'movilidad' ? 'Empezar movilidad' : 'Registrar sesión'}
              icon={day.type === 'movilidad' ? 'body' : 'checkmark-circle'}
              onPress={() => openDay(day.type, todayDate, focus)}
            />
          )}
          {day.status === 'done' && (
            <>
              <Text style={[type.body, { color: colors.success }]}>
                ¡Hecho!{day.log?.feeling ? ` Sensación: ${FEELING_LABEL[day.log.feeling].toLowerCase()}.` : ''}
              </Text>
              <Button
                label={day.type === 'movilidad' ? 'Ver flexibilidad' : 'Editar registro'}
                variant="secondary"
                icon={day.type === 'movilidad' ? 'body' : 'create-outline'}
                onPress={() => openDay(day.type, todayDate, focus)}
              />
            </>
          )}
          {day.status === 'missed' && <Button label="Deshacer el fallo" variant="secondary" icon="arrow-undo" onPress={undoMissed} />}

          {kind && prescriptions && day.status !== 'done' && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showExercises }}
                onPress={() => setShowExercises((v) => !v)}
                style={styles.linkRow}>
                <Text style={[type.subtitle, { flex: 1 }]}>
                  {slots.length} ejercicios{trip ? ' adaptados al viaje' : ''}
                </Text>
                <Ionicons name={showExercises ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {showExercises && (
                <View style={{ gap: space.sm }}>
                  {slots.map((s) => {
                    const ex = exerciseFor(s);
                    const p = prescriptions[s.key];
                    if (!p) return null;
                    return (
                      <View key={s.key} style={styles.exRow}>
                        <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        {p.tempo > 0 && <Ionicons name="timer-outline" size={14} color={colors.info} accessibilityLabel={TEMPO_LABEL[p.tempo] ?? ''} />}
                        <Text style={styles.exPresc}>{prescriptionShort(p, ex)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {!day.log && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showMore }}
                onPress={() => setShowMore((v) => !v)}
                style={styles.linkRow}>
                <Text style={[type.caption, { flex: 1 }]}>Más opciones</Text>
                <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              </Pressable>
              {showMore && (
                <View style={{ gap: space.sm }}>
                  <Button
                    label={day.overridden ? 'Cambiar otra vez lo que hago hoy' : 'Cambiar lo que hago hoy'}
                    variant="secondary"
                    icon="swap-horizontal"
                    onPress={() => router.push({ pathname: '/dia', params: { date: todayDate } })}
                  />
                  {!trip && (
                    <Button
                      label="Hoy estoy de viaje"
                      variant="secondary"
                      icon="airplane-outline"
                      onPress={() => router.push({ pathname: '/viaje', params: { date: todayDate } })}
                    />
                  )}
                  {day.type !== 'rest' && day.type !== 'movilidad' && day.status === 'pending' && <Button label="Hoy no entreno" variant="ghost" onPress={skipToday} />}
                </View>
              )}
            </>
          )}
        </Card>
      )}

      {/* Plan de hoy: una fila por cosa pendiente */}
      {trip && (
        <PlanRow
          icon="airplane"
          tint={colors.info}
          title={`De viaje hasta el ${formatShort(trip.to)}`}
          detail={`${gearSummary(trip.gear)} · sesiones adaptadas`}
          onPress={() => router.push({ pathname: '/viaje', params: { id: String(trip.id) } })}
        />
      )}
      {trial.week && isPullupDay(todayDate) && !trialLogs.some((l) => l.lift === 'dominada' && l.date === todayDate) && (
        <PlanRow
          icon="play-circle"
          title="Hoy tocan dominadas"
          detail={`${doseText('dominada', trialDose('dominada', trial.week, trialLogs))} · sesión guiada de unos 20 minutos`}
          onPress={() => router.push('/dominadas')}
        />
      )}
      {trial.week &&
        (() => {
          // Lo que falta esta semana para la prueba, en una línea.
          const left = LIFTS.map((lift) => ({ lift, dose: trialDose(lift, trial.week!, trialLogs), done: doneThisWeek(lift, trial.week!, trialLogs) })).filter(
            (x) => x.done < x.dose.days,
          );
          return (
            <PlanRow
              icon="trophy"
              title={`${EVENT_NAME} · faltan ${trial.daysLeft} días`}
              detail={
                left.length === 0
                  ? 'Todo lo de esta semana está hecho.'
                  : left.map((x) => `${x.lift === 'dominada' ? 'Dominadas' : 'Peso muerto'} (${x.done} de ${x.dose.days}): ${doseText(x.lift, x.dose)}`).join(' · ')
              }
              onPress={() => router.push('/prueba')}
            />
          );
        })()}
      {trial.phase === 'dia' && <PlanRow icon="trophy" title="Hoy es la prueba" detail="Calienta largo y empieza con un peso que sabes que sale." onPress={() => router.push('/prueba')} />}
      {tests
        .filter((t) => !(trialActive && trial.week && t.goal === 'dominadas'))
        .map((t) => (
        <PlanRow
          key={t.goal}
          icon="stopwatch"
          title={`Toca test de ${t.goal}`}
          detail={
            t.first
              ? 'Haz el primero cuando estés fresco: es el punto de partida del entrenador.'
              : `Llevas ${Math.round(t.days / 7)} semanas con este bloque: el test dirá cuánto te ha hecho mejorar.`
          }
          onPress={() => router.push({ pathname: '/test', params: { test: t.goal } })}
        />
      ))}
      {monthly?.due && (
        <PlanRow
          icon="body"
          title="Toca revisión mensual"
          detail={monthly.detail}
          onPress={() => router.push('/cuerpo')}
        />
      )}
      {march?.dueToday && (
        <PlanRow
          icon="walk"
          title={`${WALK_LABEL[march.dueToday.kind]} · ${march.dueToday.km} km`}
          detail="Plan de marcha · toca para registrarla"
          onPress={() => router.push({ pathname: '/caminata', params: { kind: march.dueToday!.kind, km: String(march.dueToday!.km) } })}
        />
      )}
      {day?.status === 'done' && routine && !stretched && (
        <PlanRow
          icon="body"
          title={`Estirar · ${routineMinutes(routine)} min`}
          detail={`${routine.title}: ${routine.subtitle.toLowerCase()}`}
          onPress={() => router.push({ pathname: '/estirar/[rutina]', params: { rutina: routine.id } })}
        />
      )}
      {deload && (
        <PlanRow
          icon="battery-half-outline"
          tint={colors.info}
          title="Baja una marcha esta semana"
          detail="Tres de tus últimas cuatro sesiones han sido duras: haz una serie menos por ejercicio."
        />
      )}
      {[0, 5, 6].includes(weekdayIndex(todayDate)) && (
        <PlanRow
          icon="clipboard-outline"
          title="Revisión de la semana"
          detail="Mira cómo ha ido y cuál es tu foco para la siguiente."
          onPress={() => router.push('/revision')}
        />
      )}
      {needsWeighIn && (
        <PlanRow
          icon="scale-outline"
          title="Pésate"
          detail={lastWeighIn ? 'Hace más de una semana de la última medición.' : 'Registra tu peso y medidas para seguir la pérdida de grasa.'}
          onPress={() => router.push('/medicion')}
        />
      )}

      <SectionTitle>Esta semana toca</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Segmented
          label="Cuánto toca esta semana"
          options={LOADS}
          value={weekLoad}
          onChange={async (l) => {
            setWeekLoad(l);
            await saveWeekLoad(db, weekStart(todayDate), l);
            const done = await getDoneSessions(db, addDays(todayDate, -30));
            setExtra({ kind: extraKind(done), ready: readiness(done, todayDate, l) });
          }}
        />
        <Text style={type.caption}>{WEEK_LOAD_INFO[weekLoad].detail}</Text>
      </Card>

      <SectionTitle>Esta semana</SectionTitle>
      <Card style={{ gap: space.md }}>
        <WeekStrip days={days} onPressDay={(d) => (d.type !== 'rest' && d.date <= todayDate ? openDay(d.type, d.date, d.focus) : router.push('/calendario'))} />
        {streak && (streak.weeks > 0 || streak.passUsed) && (
          <View style={styles.streak}>
            <Ionicons name="flame" size={16} color={colors.accent} />
            <Text style={type.caption}>
              {streak.weeks > 0 ? (
                <>
                  Racha: <Text style={{ color: colors.text, fontWeight: '800' }}>{streak.weeks}</Text>{' '}
                  {streak.weeks === 1 ? 'semana cumplida' : 'semanas cumplidas'}
                </>
              ) : (
                'Aún puedes cumplir la semana'
              )}
              {streak.passUsed ? ' · comodín usado' : ' · te queda un comodín'}
            </Text>
          </View>
        )}
      </Card>

      <SectionTitle>Objetivos</SectionTitle>
      <GoalsSummary compact />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 },
  streak: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  exPresc: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
