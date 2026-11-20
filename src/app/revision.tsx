import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { loadWeekReview, type WeekReviewData } from '@/db/review';
import { addDays, formatShort, today as getToday, weekStart } from '@/domain/dates';
import { Card, SectionTitle, type IconName } from '@/ui/components';
import { colors, space, type, font } from '@/ui/theme';
import { VolumeBars } from '@/ui/VolumeBars';

const num = (v: number, d = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(d).replace('.', ','));

function Tile({ icon, value, label, tone }: { icon: IconName; value: string; label: string; tone?: string }) {
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Card style={styles.tile}>
        <Ionicons name={icon} size={20} color={tone ?? colors.accent} />
        <Text style={styles.tileValue}>{value}</Text>
        <Text style={type.caption}>{label}</Text>
      </Card>
    </View>
  );
}

export default function WeeklyReviewScreen() {
  const db = useSQLiteContext();
  const todayDate = getToday();
  const thisMonday = weekStart(todayDate);
  // Hasta el jueves interesa la semana pasada, que ya está completa; después, la que está en curso.
  const [monday, setMonday] = useState(() => (addDays(thisMonday, 3) > todayDate ? addDays(thisMonday, -7) : thisMonday));
  const [r, setR] = useState<WeekReviewData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadWeekReview(db, monday, todayDate).then((data) => alive && setR(data));
      return () => {
        alive = false;
      };
    }, [db, monday, todayDate]),
  );

  const isCurrent = monday === thisMonday;
  const title = isCurrent ? 'Esta semana' : monday === addDays(thisMonday, -7) ? 'La semana pasada' : 'Semana';

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Semana anterior" onPress={() => setMonday(addDays(monday, -7))} style={styles.arrow}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={type.title}>{title}</Text>
          <Text style={type.caption}>
            {formatShort(monday)} – {formatShort(addDays(monday, 6))}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          accessibilityState={{ disabled: isCurrent }}
          disabled={isCurrent}
          onPress={() => setMonday(addDays(monday, 7))}
          style={[styles.arrow, isCurrent && { opacity: 0.3 }]}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
      </View>

      {r && (
        <>
          <Card style={styles.focus}>
            <Text style={type.caption}>{isCurrent ? 'Tu foco ahora' : 'Tu foco para la semana siguiente'}</Text>
            <Text style={type.title}>{r.focus.title}</Text>
            <Text style={type.body}>{r.focus.detail}</Text>
          </Card>
          {isCurrent && <Text style={type.caption}>La semana aún no ha terminado: los números pueden cambiar.</Text>}

          <View style={styles.tiles}>
            <Tile
              icon="checkmark-done"
              value={`${r.done} de ${r.planned}`}
              label="Sesiones hechas"
              tone={r.missed === 0 ? colors.success : r.missed >= 2 ? colors.danger : colors.warn}
            />
            <Tile icon="trophy" value={String(r.records)} label={r.records === 1 ? 'Récord' : 'Récords'} />
          </View>
          <View style={styles.tiles}>
            <Tile icon="body" value={`${r.stretchDays} ${r.stretchDays === 1 ? 'día' : 'días'}`} label={`Estirando · ${r.stretchMinutes} min`} />
            <Tile icon="walk" value={`${num(r.walkedKm)} km`} label={r.walks === 1 ? '1 caminata' : `${r.walks} caminatas`} />
          </View>

          <SectionTitle>Peso</SectionTitle>
          <Card style={{ gap: 4 }}>
            {r.trend === null ? (
              <Text style={type.caption}>Sin mediciones todavía. Pésate una vez por semana para ver tu tendencia.</Text>
            ) : (
              <>
                <Text style={type.subtitle}>Tendencia: {num(r.trend)} kg</Text>
                <Text style={type.caption}>
                  {r.weightRate === null
                    ? 'Aún no hay datos suficientes para saber el ritmo.'
                    : `${r.weightRate > 0 ? '+' : ''}${num(r.weightRate, 2)} kg por semana.`}{' '}
                  {r.weighedIn ? 'Te has pesado esta semana.' : 'No te has pesado esta semana.'}
                </Text>
              </>
            )}
          </Card>

          <SectionTitle>Series por músculo</SectionTitle>
          <VolumeBars volume={r.volume} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  focus: { gap: space.sm, borderColor: colors.accent, borderWidth: 1.5 },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: 2, padding: space.md },
  tileValue: { fontSize: 22, ...font.display, color: colors.text, fontVariant: ['tabular-nums'], marginTop: 4 },
});
