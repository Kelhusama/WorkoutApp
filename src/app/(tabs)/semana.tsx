import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, formatShort, today as getToday } from '@/domain/dates';
import type { SecondGymDay } from '@/domain/schedule';
import { useWeek } from '@/hooks/useWeek';
import { Card } from '@/ui/components';
import { openDay } from '@/ui/navigation';
import { colors, radius, space, type } from '@/ui/theme';
import { DayRow } from '@/ui/week';

export default function WeekScreen() {
  const insets = useSafeAreaInsets();
  const todayDate = getToday();
  const [anchor, setAnchor] = useState(todayDate);
  const { monday, days, secondGym, changeSecondGym } = useWeek(anchor);
  const isCurrentWeek = days.some((d) => d.date === todayDate);

  const done = days.filter((d) => d.status === 'done').length;
  const planned = days.filter((d) => d.type !== 'rest').length;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl }}>
      <View style={styles.nav}>
        <Pressable accessibilityLabel="Semana anterior" onPress={() => setAnchor(addDays(monday, -7))} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setAnchor(todayDate)} style={{ alignItems: 'center' }}>
          <Text style={type.overline}>{isCurrentWeek ? 'Esta semana' : 'Semana'}</Text>
          <Text style={type.title}>
            {formatShort(monday)} – {formatShort(addDays(monday, 6))}
          </Text>
        </Pressable>
        <Pressable accessibilityLabel="Semana siguiente" onPress={() => setAnchor(addDays(monday, 7))} hitSlop={12}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
      </View>

      <Card style={{ marginTop: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={type.subtitle}>Segundo día de gimnasio</Text>
          <Text style={type.caption}>
            {done}/{planned} hechos
          </Text>
        </View>
        <View style={styles.segment}>
          {(['X', 'J'] as SecondGymDay[]).map((d) => {
            const active = secondGym === d;
            return (
              <Pressable
                key={d}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => changeSecondGym(d)}
                style={[styles.segmentItem, active && { backgroundColor: colors.accent }]}>
                <Text style={[styles.segmentLabel, active && { color: '#fff' }]}>{d === 'X' ? 'Miércoles' : 'Jueves'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={type.caption}>Las sesiones de casa se reordenan para no hacer tirón el día después del gimnasio.</Text>
      </Card>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {days.map((d) => (
          <DayRow
            key={d.date}
            day={d}
            onPress={d.type !== 'rest' && d.date <= todayDate ? () => openDay(d.type, d.date) : undefined}
          />
        ))}
      </View>
      <Text style={[type.caption, { marginTop: space.md, textAlign: 'center' }]}>
        Toca un día pasado para registrarlo o corregirlo.
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
