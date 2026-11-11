import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAY_SHORT, fromISODate, today, type ISODate } from '@/domain/dates';
import type { DayType } from '@/domain/schedule';
import type { PlannedDay } from '@/hooks/useWeek';
import { colors, radius, space } from './theme';
import { STATUS_STYLE } from './week';

const TYPE_LABEL: Record<DayType, string> = { gym: 'Gym', A: 'A', B: 'B', C: 'C', rest: '' };

/** Cuadrícula mensual: `days` debe empezar en lunes y cubrir semanas completas. */
export function MonthGrid({
  days,
  month,
  selected,
  onSelect,
}: {
  days: PlannedDay[];
  month: ISODate;
  selected: ISODate | null;
  onSelect: (d: ISODate) => void;
}) {
  const todayDate = today();
  const weeks: PlannedDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const ym = month.slice(0, 7);

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        {DAY_SHORT.map((d) => (
          <Text key={d} style={styles.head}>
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0].date} style={styles.row}>
          {w.map((d) => {
            const inMonth = d.date.startsWith(ym);
            const s = STATUS_STYLE[d.status];
            const isSel = selected === d.date;
            const isToday = d.date === todayDate;
            return (
              <Pressable
                key={d.date}
                onPress={() => onSelect(d.date)}
                accessibilityLabel={`${d.date}: ${s.label}`}
                style={[
                  styles.cell,
                  { backgroundColor: d.type === 'rest' ? 'transparent' : s.bg, opacity: inMonth ? 1 : 0.3 },
                  isToday && { borderColor: colors.accent },
                  isSel && { borderColor: colors.text },
                ]}>
                <Text style={[styles.num, isToday && { color: colors.accent }]}>{fromISODate(d.date).getDate()}</Text>
                {d.status === 'done' ? (
                  <Ionicons name="checkmark" size={14} color={colors.success} />
                ) : d.status === 'missed' ? (
                  <Ionicons name="close" size={14} color={colors.danger} />
                ) : (
                  <Text style={[styles.type, { color: s.color }]}>{TYPE_LABEL[d.type]}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  head: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.muted },
  cell: {
    flex: 1,
    aspectRatio: 0.85,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  num: { fontSize: 14, fontWeight: '700', color: colors.text },
  type: { fontSize: 10, fontWeight: '800', minHeight: 14 },
});

export const MONTH_LEGEND = [
  { label: 'Hecho', color: colors.success },
  { label: 'Fallado', color: colors.danger },
  { label: 'Pendiente', color: colors.muted },
];

export function Legend() {
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, justifyContent: 'center' }}>
      {MONTH_LEGEND.map((l) => (
        <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />
          <Text style={{ fontSize: 12, color: colors.muted }}>{l.label}</Text>
        </View>
      ))}
    </View>
  );
}
