import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getStretching } from '@/db/stretch';
import { addDays, today, weekStart } from '@/domain/dates';
import { ROUTINES, ROUTINE_ORDER, minutesByZone, routineMinutes, weeklyStretching, type StretchEntry } from '@/domain/stretches';
import { Card, SectionTitle } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, space, type, font } from '@/ui/theme';
import { ZoneBars } from '@/ui/ZoneBars';

export default function StretchingScreen() {
  const db = useSQLiteContext();
  const [entries, setEntries] = useState<StretchEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getStretching(db).then(setEntries);
    }, [db]),
  );

  const monday = weekStart(today());
  const thisWeek = entries.filter((e) => e.date >= monday && e.date <= addDays(monday, 6));
  const daysThisWeek = new Set(thisWeek.map((e) => e.date)).size;
  const weekly = weeklyStretching(entries);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Text style={type.body}>
        Estirar después de entrenar no quita las agujetas, pero es el mejor momento para ganar movilidad. Mantén cada postura con una tirantez
        suave, sin dolor y sin rebotes.
      </Text>

      <SectionTitle>Rutinas</SectionTitle>
      {ROUTINE_ORDER.map((id) => {
        const r = ROUTINES[id];
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}, ${routineMinutes(r)} minutos. Empezar`}
            onPress={() => router.push({ pathname: '/estirar/[rutina]', params: { rutina: id } })}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Card style={styles.routine}>
              <View style={styles.icon}>
                <Ionicons name={id === 'inferior' ? 'walk' : 'body'} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>{r.title}</Text>
                <Text style={type.caption}>
                  {routineMinutes(r)} min · {r.stretchIds.length} estiramientos · {r.subtitle}
                </Text>
              </View>
              <Ionicons name="play-circle" size={30} color={colors.accent} />
            </Card>
          </Pressable>
        );
      })}

      <SectionTitle>Esta semana</SectionTitle>
      <Card style={styles.week}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{daysThisWeek}</Text>
          <Text style={type.caption}>{daysThisWeek === 1 ? 'día' : 'días'} · objetivo 3–5</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(thisWeek.reduce((a, e) => a + e.seconds, 0) / 60)}</Text>
          <Text style={type.caption}>minutos en total</Text>
        </View>
      </Card>
      <ZoneBars minutes={minutesByZone(thisWeek)} />

      {weekly.minutes.length >= 2 && (
        <>
          <SectionTitle>Evolución</SectionTitle>
          <Card style={{ gap: space.sm }}>
            <Text style={type.subtitle}>Minutos por semana</Text>
            <LineChart points={weekly.minutes} height={150} format={(v) => String(Math.round(v))} />
          </Card>
          <Card style={{ gap: space.sm }}>
            <Text style={type.subtitle}>Días por semana</Text>
            <LineChart points={weekly.days} height={130} format={(v) => String(Math.round(v))} />
          </Card>
        </>
      )}
      {weekly.minutes.length < 2 && (
        <Text style={type.caption}>Cuando lleves dos semanas estirando verás aquí la evolución de minutos y días.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  routine: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 28, ...font.display, color: colors.text, fontVariant: ['tabular-nums'] },
});
