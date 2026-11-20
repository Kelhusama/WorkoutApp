import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAY_SHORT, formatLong, fromISODate, today, weekdayIndex } from '@/domain/dates';
import { FEELING_LABEL } from '@/domain/progression';
import { infoFor, type DayStatus, type DayType } from '@/domain/schedule';
import type { PlannedDay } from '@/hooks/useWeek';
import { Pill, type IconName } from './components';
import { colors, radius, space, type } from './theme';

export const STATUS_STYLE: Record<DayStatus, { label: string; color: string; bg: string }> = {
  done: { label: 'Hecho', color: colors.success, bg: colors.successSoft },
  missed: { label: 'Fallado', color: colors.danger, bg: colors.dangerSoft },
  pending: { label: 'Por hacer', color: colors.accent, bg: colors.accentSoft },
  future: { label: 'Pendiente', color: colors.muted, bg: colors.cardHigh },
  rest: { label: 'Descanso', color: colors.faint, bg: colors.cardHigh },
  excused: { label: 'Viaje', color: colors.info, bg: colors.infoSoft },
};

const TYPE_LETTER: Record<DayType, string> = { gym: 'G', A: 'A', B: 'B', C: 'C', movilidad: 'M', rest: '–' };

/** Tira compacta de 7 días para la pantalla Hoy. */
export function WeekStrip({ days, onPressDay }: { days: PlannedDay[]; onPressDay?: (d: PlannedDay) => void }) {
  const todayDate = today();
  return (
    <View style={styles.strip}>
      {days.map((d) => {
        const s = STATUS_STYLE[d.status];
        const isToday = d.date === todayDate;
        return (
          <Pressable
            key={d.date}
            disabled={!onPressDay}
            onPress={() => onPressDay?.(d)}
            accessibilityRole={onPressDay ? 'button' : undefined}
            accessibilityLabel={`${formatLong(d.date)}: ${infoFor(d.type, d.focus).title}, ${s.label.toLowerCase()}`}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            style={styles.stripDay}>
            <Text style={[styles.stripLetter, isToday && { color: colors.accent }]}>
              {DAY_SHORT[weekdayIndex(d.date)]}
            </Text>
            <View
              style={[
                styles.stripDot,
                { backgroundColor: s.bg },
                isToday && { borderColor: colors.accent, borderWidth: 2 },
              ]}>
              {d.status === 'done' ? (
                <Ionicons name="checkmark" size={16} color={colors.success} />
              ) : d.status === 'missed' ? (
                <Ionicons name="close" size={16} color={colors.danger} />
              ) : d.status === 'excused' ? (
                <Ionicons name="airplane" size={15} color={colors.info} />
              ) : (
                <Text style={[styles.stripType, { color: d.type === 'rest' ? colors.faint : colors.text }]}>
                  {d.focus ? 'S' : TYPE_LETTER[d.type]}
                </Text>
              )}
            </View>
            <View style={[styles.stripTrip, d.trip && { backgroundColor: colors.info }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fila de un día para la pantalla Semana. */
export function DayRow({ day, onPress, onChange }: { day: PlannedDay; onPress?: () => void; onChange?: () => void }) {
  const info = infoFor(day.type, day.focus);
  const s = STATUS_STYLE[day.status];
  const isToday = day.date === today();
  const detail =
    day.log?.feeling && day.status === 'done'
      ? `${FEELING_LABEL[day.log.feeling]}${day.log.bench_weight ? ` · Banca ${day.log.bench_weight} kg × ${day.log.bench_reps}` : ''}`
      : info.subtitle;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${formatLong(day.date)}: ${info.title}${day.type !== 'rest' ? `, ${s.label.toLowerCase()}` : ''}${onPress ? '. Abrir registro' : ''}`}
      style={({ pressed }) => [styles.row, isToday && styles.rowToday, pressed && { opacity: 0.7 }]}>
      <View style={styles.rowDate}>
        <Text style={[type.overline, isToday && { color: colors.accent }]}>{DAY_SHORT[weekdayIndex(day.date)]}</Text>
        <Text style={styles.rowDay}>{fromISODate(day.date).getDate()}</Text>
      </View>
      <View style={[styles.rowIcon, { backgroundColor: day.type === 'rest' ? colors.cardHigh : colors.accentSoft }]}>
        <Ionicons name={info.icon as IconName} size={20} color={day.type === 'rest' ? colors.faint : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.subtitle}>
          {info.title}
          {day.overridden ? <Text style={[type.caption, { color: colors.info }]}>  · cambiado</Text> : null}
        </Text>
        <Text style={type.caption} numberOfLines={1}>
          {day.trip ? <Ionicons name="airplane" size={12} color={colors.info} /> : null}
          {day.trip ? ' De viaje · ' : ''}
          {detail}
        </Text>
      </View>
      {day.type !== 'rest' && <Pill label={s.label} color={s.color} bg={s.bg} />}
      {onChange && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Cambiar lo que se hace el ${formatLong(day.date).toLowerCase()}`} onPress={onChange} style={styles.swap}>
          <Ionicons name="swap-horizontal" size={18} color={colors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripDay: { alignItems: 'center', gap: 6 },
  stripLetter: { fontSize: 12, fontWeight: '700', color: colors.muted },
  stripDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  stripType: { fontSize: 14, fontWeight: '800' },
  stripTrip: { width: 14, height: 3, borderRadius: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  swap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cardHigh, alignItems: 'center', justifyContent: 'center' },
  rowToday: { borderWidth: 1.5, borderColor: colors.accent },
  rowDate: { width: 34, alignItems: 'center' },
  rowDay: { fontSize: 18, fontWeight: '800', color: colors.text },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
