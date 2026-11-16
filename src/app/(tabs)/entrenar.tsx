import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DAY_LONG, formatLong, today as getToday, weekdayIndex } from '@/domain/dates';
import { WALK_LABEL } from '@/domain/march';
import { GOAL_KM, KIND_LABEL, LAST_STEP, stepAt } from '@/domain/marchPlan';
import { SESSION_INFO } from '@/domain/schedule';
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

  const todayPlan = days.find((d) => d.date === todayDate);
  const next = days.find((d) => d.date >= todayDate && d.type !== 'rest' && (d.status === 'pending' || d.status === 'future'));
  const state = view?.state ?? null;
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
          <Text style={type.body}>{todayPlan?.status === 'done' ? 'Sesión de hoy hecha.' : 'No quedan sesiones esta semana.'}</Text>
        )}
        <Text style={type.caption}>
          {next && next.date === todayDate ? 'Toca para registrar la sesión.' : 'Gimnasio y sesiones en casa con pierna. Toca para ver tu semana tipo.'}
        </Text>
      </Area>

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

      <Area icon="body" title="Estiramientos" status="Pronto" soon>
        <Text style={type.caption}>Rutina de 5 minutos tras cada sesión y otra de tren inferior, con cuenta atrás y gráficas por zona.</Text>
      </Area>

      <Area icon="resize" title="Flexibilidad" status="Pronto" soon>
        <Text style={type.caption}>Programa por niveles y seis tests mensuales para medir tu progreso.</Text>
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
