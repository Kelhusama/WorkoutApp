import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import type { SecondGymDay } from '@/domain/schedule';
import { useDays } from '@/hooks/useWeek';
import { Card } from '@/ui/components';
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
  const { days, changeSecondGym, secondGymOf } = useDays(from, to);

  const shift = (n: number) => setAnchor(mode === 'semana' ? addDays(anchor, 7 * n) : addMonths(anchor, n));
  const title =
    mode === 'semana' ? `${formatShort(from)} – ${formatShort(to)}` : monthTitle(monthStart(anchor));

  const inRange = mode === 'semana' ? days : days.filter((d) => d.date.startsWith(anchor.slice(0, 7)));
  const done = inRange.filter((d) => d.status === 'done').length;
  const planned = inRange.filter((d) => d.type !== 'rest' && d.date <= todayDate).length;

  const selectedDay = days.find((d) => d.date === selected);
  const gymWeek = mode === 'semana' ? from : selected ? weekStart(selected) : null;

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
          />
        </View>
      )}

      {gymWeek && (
        <Card style={{ gap: space.md }}>
          <Text style={type.subtitle}>
            Segundo gimnasio · semana del {formatShort(gymWeek)}
          </Text>
          <Segmented<SecondGymDay>
            options={[
              { id: 'X', label: 'Miércoles' },
              { id: 'J', label: 'Jueves' },
            ]}
            value={secondGymOf(gymWeek)}
            onChange={(d) => changeSecondGym(gymWeek, d)}
          />
          <Text style={type.caption}>Las sesiones de casa se reordenan para no hacer tirón el día después del gimnasio.</Text>
        </Card>
      )}

      <Text style={[type.caption, { textAlign: 'center' }]}>
        {mode === 'mes' ? 'Toca un día para ver el detalle. ' : ''}Los días pasados se pueden registrar o corregir.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segmentLabel: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
