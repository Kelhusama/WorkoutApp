import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { getBodyLog } from '@/db/body';
import { deleteLog, getPrescriptions, markMissed } from '@/db/repo';
import { syncReminders } from '@/notifications/reminders';
import { addDays, formatLong, today as getToday } from '@/domain/dates';
import { FEELING_LABEL, TEMPO_LABEL, type Prescription } from '@/domain/progression';
import { SESSION_INFO, type SessionKind } from '@/domain/schedule';
import { prescriptionShort } from '@/domain/format';
import { TEMPLATES, exerciseFor } from '@/domain/templates';
import { useWeek } from '@/hooks/useWeek';
import { Button, Card, Pill, SectionTitle, type IconName } from '@/ui/components';
import { GoalsSummary } from '@/ui/goals';
import { openDay } from '@/ui/navigation';
import { colors, space, type } from '@/ui/theme';
import { STATUS_STYLE, WeekStrip } from '@/ui/week';

export default function TodayScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const todayDate = getToday();
  const { days, reload } = useWeek(todayDate);
  const day = days.find((d) => d.date === todayDate);
  const [prescriptions, setPrescriptions] = useState<Record<string, Prescription> | null>(null);

  const kind = day && day.type !== 'gym' && day.type !== 'rest' ? (day.type as SessionKind) : null;

  const [lastWeighIn, setLastWeighIn] = useState<string | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (kind) getPrescriptions(db, kind).then(setPrescriptions);
      getBodyLog(db).then((log) => setLastWeighIn(log.length ? log[log.length - 1].date : null));
    }, [db, kind]),
  );

  const needsWeighIn = lastWeighIn === null || (lastWeighIn != null && lastWeighIn <= addDays(todayDate, -7));

  const skipToday = () => {
    if (!day || day.type === 'rest') return;
    Alert.alert('¿Hoy no?', 'La sesión se marcará como fallada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Marcar fallada',
        style: 'destructive',
        onPress: async () => {
          await markMissed(db, todayDate, day.type as SessionKind | 'gym');
          reload();
          syncReminders(db);
        },
      },
    ]);
  };

  const undoMissed = async () => {
    if (!day || day.type === 'rest') return;
    await deleteLog(db, todayDate, day.type as SessionKind | 'gym');
    reload();
    syncReminders(db);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Hoy</Text>
          <Text style={[type.hero, { marginTop: 2 }]}>{formatLong(todayDate)}</Text>
        </View>
        <Pressable accessibilityLabel="Perfil y avisos" onPress={() => router.push('/perfil')} style={styles.bell} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <Card style={{ marginTop: space.lg }}>
        <WeekStrip days={days} />
      </Card>

      {day && (
        <Card style={{ marginTop: space.lg, gap: space.md }}>
          <View style={styles.headerRow}>
            <View style={styles.icon}>
              <Ionicons name={SESSION_INFO[day.type].icon as IconName} size={26} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>{SESSION_INFO[day.type].title}</Text>
              <Text style={type.caption}>{SESSION_INFO[day.type].subtitle}</Text>
            </View>
            {day.type !== 'rest' && (
              <Pill label={STATUS_STYLE[day.status].label} color={STATUS_STYLE[day.status].color} bg={STATUS_STYLE[day.status].bg} />
            )}
          </View>

          {kind && prescriptions && day.status !== 'done' && (
            <View style={{ gap: space.sm }}>
              {TEMPLATES[kind].map((s) => {
                const ex = exerciseFor(s);
                const p = prescriptions[s.key];
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

          {day.status === 'done' && (
            <Text style={[type.body, { color: colors.success }]}>
              ¡Hecho! {day.log?.feeling ? `Sensación: ${FEELING_LABEL[day.log.feeling]}.` : ''}
            </Text>
          )}

          {day.type === 'rest' && (
            <Text style={type.caption}>Hoy toca descansar. El músculo crece mientras te recuperas.</Text>
          )}

          {day.type !== 'rest' && day.status === 'pending' && (
            <View style={{ gap: space.sm }}>
              <Button
                label={day.type === 'gym' ? 'Registrar gimnasio' : 'Registrar sesión'}
                icon="checkmark-circle"
                onPress={() => openDay(day.type, todayDate)}
              />
              <Button label="Hoy no" variant="ghost" onPress={skipToday} />
            </View>
          )}
          {day.status === 'done' && (
            <Button label="Editar registro" variant="secondary" icon="create-outline" onPress={() => openDay(day.type, todayDate)} />
          )}
          {day.status === 'missed' && <Button label="Deshacer fallo" variant="secondary" icon="arrow-undo" onPress={undoMissed} />}
          {!day.log && (
            <Pressable onPress={() => router.push({ pathname: '/dia', params: { date: todayDate } })} style={styles.changeDay}>
              <Ionicons name="swap-horizontal" size={16} color={colors.muted} />
              <Text style={type.caption}>
                {day.overridden ? 'Día cambiado · cambiar otra vez' : 'Cambiar lo que hago hoy'}
              </Text>
            </Pressable>
          )}
        </Card>
      )}

      {needsWeighIn && (
        <Card style={{ marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="scale-outline" size={22} color={colors.accent} />
          <Text style={[type.caption, { flex: 1 }]}>
            {lastWeighIn ? 'Hace más de una semana que no te pesas.' : 'Registra tu peso y medidas para seguir la pérdida de grasa.'}
          </Text>
          <Button label="Pesarme" variant="secondary" onPress={() => router.push('/medicion')} />
        </Card>
      )}

      <SectionTitle>Objetivos</SectionTitle>
      <GoalsSummary compact />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeDay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  exPresc: { fontSize: 15, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
