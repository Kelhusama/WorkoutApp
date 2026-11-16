import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearWeekOverrides } from '@/db/repo';
import {
  addDays,
  addMonths,
  formatLong,
  formatShort,
  monthEnd,
  monthStart,
  monthTitle,
  today as getToday,
  weekStart,
  type ISODate,
} from '@/domain/dates';
import { gearSummary } from '@/domain/travel';
import { useDays, type PlannedDay } from '@/hooks/useWeek';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, Segmented } from '@/ui/components';
import { Legend, MonthGrid } from '@/ui/MonthGrid';
import { openDay } from '@/ui/navigation';
import { colors, space, type } from '@/ui/theme';
import { DayRow } from '@/ui/week';

type Mode = 'semana' | 'mes';

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const todayDate = getToday();
  const [mode, setMode] = useState<Mode>('semana');
  const [anchor, setAnchor] = useState(todayDate);
  const [selected, setSelected] = useState<ISODate | null>(todayDate);

  const from = mode === 'semana' ? weekStart(anchor) : weekStart(monthStart(anchor));
  const to = mode === 'semana' ? addDays(from, 6) : addDays(weekStart(monthEnd(anchor)), 6);
  const { days, reload } = useDays(from, to);
  const db = useSQLiteContext();
  const changeDay = (d: PlannedDay) =>
    d.log ? undefined : () => router.push({ pathname: '/dia', params: { date: d.date } });
  const weekHasChanges = mode === 'semana' && days.some((d) => d.overridden);
  const resetWeek = () =>
    Alert.alert('¿Volver a la semana tipo?', 'Se quitan los cambios de esta semana.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restablecer',
        onPress: async () => {
          await clearWeekOverrides(db, from);
          await reload();
          syncReminders(db);
        },
      },
    ]);

  const shift = (n: number) => setAnchor(mode === 'semana' ? addDays(anchor, 7 * n) : addMonths(anchor, n));
  const title =
    mode === 'semana' ? `${formatShort(from)} – ${formatShort(to)}` : monthTitle(monthStart(anchor));

  const inRange = mode === 'semana' ? days : days.filter((d) => d.date.startsWith(anchor.slice(0, 7)));
  const done = inRange.filter((d) => d.status === 'done').length;
  const planned = inRange.filter((d) => d.type !== 'rest' && d.status !== 'excused' && d.date <= todayDate).length;
  const trips = [...new Map(days.filter((d) => d.trip).map((d) => [d.trip!.id, d.trip!])).values()];
  const newTrip = (date: ISODate) => router.push({ pathname: '/viaje', params: { date } });

  const selectedDay = days.find((d) => d.date === selected);
  const showsToday = mode === 'semana' ? todayDate >= from && todayDate <= to : anchor.slice(0, 7) === todayDate.slice(0, 7);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}>
      <Segmented
        label="Vista del calendario"
        options={[
          { id: 'semana', label: 'Semana' },
          { id: 'mes', label: 'Mes' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'semana' ? 'Semana anterior' : 'Mes anterior'} onPress={() => shift(-1)} style={styles.arrow}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={type.title}>{title}</Text>
          <Text style={type.caption}>
            {done} de {planned} sesiones hechas
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'semana' ? 'Semana siguiente' : 'Mes siguiente'} onPress={() => shift(1)} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
      </View>

      {!showsToday && (
        <Button
          label={mode === 'semana' ? 'Volver a esta semana' : 'Volver a este mes'}
          variant="secondary"
          icon="today-outline"
          onPress={() => {
            setAnchor(todayDate);
            setSelected(todayDate);
          }}
        />
      )}

      {mode === 'mes' ? (
        <Card style={{ gap: space.md }}>
          <MonthGrid days={days} month={monthStart(anchor)} selected={selected} onSelect={setSelected} />
          <Legend />
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          {days.map((d) => (
            <DayRow
              key={d.date}
              day={d}
              onPress={d.type !== 'rest' && d.date <= todayDate ? () => openDay(d.type, d.date) : undefined}
              onChange={changeDay(d)}
            />
          ))}
        </View>
      )}

      {mode === 'mes' && selectedDay && (
        <View style={{ gap: space.sm }}>
          <Text style={type.overline}>{formatLong(selectedDay.date)}</Text>
          <DayRow
            day={selectedDay}
            onPress={
              selectedDay.type !== 'rest' && selectedDay.date <= todayDate
                ? () => openDay(selectedDay.type, selectedDay.date)
                : undefined
            }
            onChange={changeDay(selectedDay)}
          />
        </View>
      )}

      {weekHasChanges && (
        <Button label="Volver a la semana tipo" variant="secondary" icon="refresh" onPress={resetWeek} />
      )}

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Ionicons name="airplane-outline" size={22} color={colors.info} />
          <Text style={[type.subtitle, { flex: 1 }]}>Viajes</Text>
        </View>
        {trips.length === 0 && <Text style={type.caption}>Sin viajes en estas fechas. De viaje, las sesiones se adaptan a lo que tengas a mano y los días sin entrenar no cuentan como fallo.</Text>}
        {trips.map((t) => (
          <Pressable key={t.id} onPress={() => router.push({ pathname: '/viaje', params: { id: String(t.id) } })} style={styles.tripRow}>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>
                {formatShort(t.from)} – {formatShort(t.to)}
              </Text>
              <Text style={type.caption}>{gearSummary(t.gear)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ))}
        <Button label="Añadir viaje" variant="secondary" icon="add" onPress={() => newTrip(mode === 'mes' && selected ? selected : todayDate)} />
      </Card>

      <Pressable onPress={() => router.push('/semana-tipo')} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <Card style={styles.templateCard}>
          <Ionicons name="options-outline" size={22} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={type.subtitle}>Semana tipo</Text>
            <Text style={type.caption}>Elige qué días vas al gimnasio, a casa o descansas</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Card>
      </Pressable>

      <Text style={[type.caption, { textAlign: 'center' }]}>
        {mode === 'mes' ? 'Toca un día para ver el detalle. ' : ''}Con ⇄ cambias un día solo para esa semana.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
