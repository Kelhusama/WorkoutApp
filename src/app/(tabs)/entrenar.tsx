import Ionicons from '@expo/vector-icons/Ionicons';
import { EVENT_NAME, todayPlan } from '@/domain/event';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LONG, addDays, formatLong, today as getToday, weekStart, weekdayIndex } from '@/domain/dates';
import { WALK_LABEL } from '@/domain/march';
import { GOAL_KM, KIND_LABEL, LAST_STEP, stepAt } from '@/domain/marchPlan';
import { SESSION_INFO } from '@/domain/schedule';
import { getStretching } from '@/db/stretch';
import { useFlex } from '@/hooks/useFlex';
import { useMarch } from '@/hooks/useMarch';
import { useWeek } from '@/hooks/useWeek';
import { Card, Pill, type IconName } from '@/ui/components';
import { openDay } from '@/ui/navigation';
import { colors, space, type } from '@/ui/theme';

function Area({
  icon,
  title,
  status,
  children,
  onPress,
  soon,
}: {
  icon: IconName;
  title: string;
  status?: string;
  children: ReactNode;
  onPress?: () => void;
  soon?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}${soon ? ', próximamente' : ''}`}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card style={[styles.area, soon && { opacity: 0.6 }]}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <Ionicons name={icon} size={24} color={colors.accent} />
          </View>
          <Text style={[type.title, { flex: 1 }]}>{title}</Text>
          {status && <Pill label={status} />}
          {onPress && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
        </View>
        {children}
      </Card>
    </Pressable>
  );
}

export default function TrainScreen() {
  const insets = useSafeAreaInsets();
  const todayDate = getToday();
  const { days } = useWeek(todayDate);
  const { view, dayOf } = useMarch();
  const db = useSQLiteContext();
  const [stretchMinutes, setStretchMinutes] = useState(0);
  const [stretchDays, setStretchDays] = useState(0);
  const { view: flex } = useFlex();

  useFocusEffect(
    useCallback(() => {
      const monday = weekStart(getToday());
      getStretching(db, monday, addDays(monday, 6)).then((e) => {
        setStretchMinutes(Math.round(e.reduce((a, x) => a + x.seconds, 0) / 60));
        setStretchDays(new Set(e.map((x) => x.date)).size);
      });
    }, [db]),
  );

  const todayDay = days.find((d) => d.date === todayDate);
  const next = days.find((d) => d.date >= todayDate && d.type !== 'rest' && d.type !== 'movilidad' && (d.status === 'pending' || d.status === 'future'));
  const state = view?.state ?? null;
  const trial = todayPlan(todayDate);
  const step = state ? stepAt(state.step) : null;
  const pendingWalks = view?.planned.filter((p) => !p.done) ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.md }}>
      <View>
        <Text style={type.overline}>Entrenar</Text>
        <Text style={[type.hero, { marginTop: 2 }]}>Tus programas</Text>
      </View>

      <Area
        icon="barbell"
        title="Fuerza"
        onPress={next && next.date === todayDate ? () => openDay(next.type, next.date) : () => router.push('/semana-tipo')}>
        {next ? (
          <Text style={type.body}>
            {next.date === todayDate ? 'Hoy' : formatLong(next.date)}: <Text style={styles.strong}>{SESSION_INFO[next.type].title}</Text>
          </Text>
        ) : (
          <Text style={type.body}>{todayDay?.status === 'done' ? 'Sesión de hoy hecha.' : 'No quedan sesiones esta semana.'}</Text>
        )}
        <Text style={type.caption}>
          {next && next.date === todayDate ? 'Toca para registrar la sesión.' : 'Gimnasio y sesiones en casa con pierna. Toca para ver tu semana tipo.'}
        </Text>
      </Area>

      {trial.phase !== 'pasado' && (
        <Area icon="trophy" title={EVENT_NAME} status={trial.phase === 'dia' ? 'Hoy' : `${trial.daysLeft} días`} onPress={() => router.push('/prueba')}>
          <Text style={type.body}>
            {trial.week ? (
              <>
                Semana {9 - trial.week.weeksLeft} de 8: <Text style={styles.strong}>{trial.week.title}</Text>
              </>
            ) : (
              'Calienta largo y a por ello.'
            )}
          </Text>
          <Text style={type.caption}>Dominadas con lastre y peso muerto, a tres repeticiones. Toca para ver qué hacer esta semana y apuntarlo.</Text>
        </Area>
      )}

      <Area icon="walk" title={`Marcha de ${GOAL_KM} km`} status={state && !state.completed ? `${state.step}/${LAST_STEP}` : undefined} onPress={() => router.push('/marcha')}>
        {!state ? (
          <>
            <Text style={type.body}>Un plan por escalones para caminar {GOAL_KM} km en un día.</Text>
            <Text style={type.caption}>Empiezas cuando quieras, desde lo que ya caminas.</Text>
          </>
        ) : state.completed ? (
          <Text style={type.body}>Reto completado. Toca para empezar otro ciclo.</Text>
        ) : (
          <>
            <Text style={type.body}>
              <Text style={styles.strong}>{KIND_LABEL[step!.kind]}</Text> · tirada larga de {step!.long} km
            </Text>
            <Text style={type.caption}>
              {pendingWalks.length === 0
                ? 'Todo hecho en este escalón.'
                : `Te quedan: ${pendingWalks
                    .map((p) => {
                      const d = dayOf(p.kind);
                      return `${WALK_LABEL[p.kind].toLowerCase()} de ${p.km} km${d !== null ? ` (${DAY_LONG[d].toLowerCase()})` : ''}`;
                    })
                    .join(' · ')}`}
            </Text>
            {view?.dueToday && weekdayIndex(todayDate) >= 0 && (
              <Text style={[type.caption, { color: colors.accent }]}>Hoy toca: {WALK_LABEL[view.dueToday.kind].toLowerCase()}.</Text>
            )}
          </>
        )}
      </Area>

      <Area icon="body" title="Estiramientos" status={stretchDays > 0 ? `${stretchDays} ${stretchDays === 1 ? 'día' : 'días'}` : undefined} onPress={() => router.push('/estiramientos')}>
        <Text style={type.body}>
          {stretchMinutes > 0 ? (
            <>
              Esta semana: <Text style={styles.strong}>{stretchMinutes} min</Text>
            </>
          ) : (
            'Aún no has estirado esta semana.'
          )}
        </Text>
        <Text style={type.caption}>Rutina guiada de 5 minutos tras cada sesión y otra de 10 para el tren inferior.</Text>
      </Area>

      <Area icon="resize" title="Flexibilidad" status={flex ? `Nivel ${flex.progress.level}` : undefined} onPress={() => router.push('/flexibilidad')}>
        <Text style={type.body}>
          {flex && flex.sessions.length > 0 ? (
            <>
              Sesiones: <Text style={styles.strong}>{flex.week.label}</Text>
            </>
          ) : (
            'Programa de 10–15 minutos, 3 días por semana.'
          )}
        </Text>
        {flex?.testDue ? (
          <Text style={[type.caption, { color: colors.accent }]}>Test pendiente: toca para medir tu progreso.</Text>
        ) : (
          <Text style={type.caption}>Tres niveles y seis tests mensuales para medir tu progreso.</Text>
        )}
      </Area>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  area: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  strong: { color: colors.text, fontWeight: '700' },
});
