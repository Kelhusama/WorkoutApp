import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { getTemplate, loadDays, setOverride, type PlannedDay } from '@/db/repo';
import { addDays, formatLong, today, weekStart, weekdayIndex } from '@/domain/dates';
import { ROLE_INFO, SESSION_INFO, roleOf, type Role } from '@/domain/schedule';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, SectionTitle } from '@/ui/components';
import { RolePicker } from '@/ui/RolePicker';
import { colors, space, type } from '@/ui/theme';
import { DayRow } from '@/ui/week';

/** Cambia lo que se hace un día concreto, solo esa semana. */
export default function DayScreen() {
  const db = useSQLiteContext();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? today();
  const [day, setDay] = useState<PlannedDay | null>(null);
  const [week, setWeek] = useState<PlannedDay[]>([]);
  const [templateRole, setTemplateRole] = useState<Role>('rest');
  const [role, setRole] = useState<Role>('rest');

  useEffect(() => {
    (async () => {
      const monday = weekStart(date);
      const { days } = await loadDays(db, monday, addDays(monday, 6));
      const d = days.find((x) => x.date === date)!;
      setDay(d);
      setWeek(days);
      setRole(roleOf(d.type));
      setTemplateRole((await getTemplate(db))[weekdayIndex(date)]);
    })();
  }, [db, date]);

  if (!day) return null;

  if (day.log) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Text style={type.overline}>{formatLong(date)}</Text>
        <Card>
          <Text style={type.body}>
            Este día ya está registrado como {SESSION_INFO[day.type].title.toLowerCase()}. Para cambiarlo, primero deshaz el
            registro.
          </Text>
        </Card>
      </ScrollView>
    );
  }

  const apply = async (r: Role | null) => {
    await setOverride(db, date, r === templateRole ? null : r);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    router.back();
  };

  const changed = role !== roleOf(day.type);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Text style={type.overline}>{formatLong(date)}</Text>
      <Text style={type.caption}>
        Solo cambia este día. Las sesiones de casa de la semana se reparten de nuevo para respetar el descanso tras el gimnasio.
      </Text>

      <RolePicker value={role} onChange={setRole} />

      <Card style={{ gap: space.sm }}>
        <Text style={type.caption}>En tu semana tipo, este día es: {ROLE_INFO[templateRole].label.toLowerCase()}.</Text>
        {day.overridden && <Text style={[type.caption, { color: colors.info }]}>Ya lo habías cambiado.</Text>}
      </Card>

      <Button label={changed ? `Cambiar a ${ROLE_INFO[role].label.toLowerCase()}` : 'Sin cambios'} icon="swap-horizontal" onPress={() => apply(role)} disabled={!changed} />
      {day.overridden && <Button label="Volver a la semana tipo" variant="secondary" icon="refresh" onPress={() => apply(null)} />}

      <SectionTitle>Esta semana ahora</SectionTitle>
      <View style={{ gap: space.sm }}>
        {week.map((d) => (
          <DayRow key={d.date} day={d} />
        ))}
      </View>
    </ScrollView>
  );
}
