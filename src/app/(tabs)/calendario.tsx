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
import { useDays, type PlannedDay } from '@/hooks/useWeek';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card } from '@/ui/components';
import { Legend, MonthGrid } from '@/ui/MonthGrid';
import { openDay } from '@/ui/navigation';
import { colors, radius, space, type } from '@/ui/theme';
import { DayRow } from '@/ui/week';

type Mode = 'semana' | 'mes';

function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={[styles.segmentItem, active && { backgroundColor: colors.accent }]}>
            <Text style={[styles.segmentLabel, active && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
  const planned = inRange.filter((d) => d.type !== 'rest' && d.date <= todayDate).length;

  const selectedDay = days.find((d) => d.date === selected);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl, gap: space.lg }}>
      <Segmented
        options={[
          { id: 'semana', label: 'Semana' },
          { id: 'mes', label: 'Mes' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View style={styles.nav}>
        <Pressable accessibilityLabel="Anterior" onPress={() => shift(-1)} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setAnchor(todayDate)} style={{ alignItems: 'center' }}>
          <Text style={type.title}>{title}</Text>
          <Text style={type.caption}>
            {done} de {planned} sesiones hechas
          </Text>
        </Pressable>
        <Pressable accessibilityLabel="Siguiente" onPress={() => shift(1)} hitSlop={12}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
      </View>

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
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentLabel: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
