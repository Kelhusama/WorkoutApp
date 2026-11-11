import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { INDICATORS, formatValue, rangeFor, seriesFor, targets, type BodyEntry } from '@/domain/body';
import { formatShort } from '@/domain/dates';
import { useBody } from '@/hooks/useBody';
import { Button, Card, Pill, SectionTitle } from '@/ui/components';
import { LineChart, TONE_COLOR } from '@/ui/LineChart';
import { colors, space, type } from '@/ui/theme';

const fmt = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

function Delta({ now, before, unit, lowerIsBetter = true }: { now?: number | null; before?: number | null; unit: string; lowerIsBetter?: boolean }) {
  if (now == null || before == null) return null;
  const d = now - before;
  if (Math.abs(d) < 0.05) return <Text style={type.caption}>=</Text>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <Text style={[type.caption, { color: good ? colors.success : colors.danger, fontWeight: '700' }]}>
      {d > 0 ? '+' : ''}
      {fmt(d)}
      {unit}
    </Text>
  );
}

const MEASURES: { key: keyof BodyEntry; label: string; lowerIsBetter: boolean }[] = [
  { key: 'waist', label: 'Cintura', lowerIsBetter: true },
  { key: 'neck', label: 'Cuello', lowerIsBetter: true },
  { key: 'arm', label: 'Brazo', lowerIsBetter: false },
  { key: 'chest', label: 'Pecho', lowerIsBetter: false },
];

export default function BodyScreen() {
  const insets = useSafeAreaInsets();
  const { profile, entries, last, loaded } = useBody();
  const prev = entries.length > 1 ? entries[entries.length - 2] : null;
  const t = profile && last ? targets(last, profile) : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: space.xxl }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Cuerpo</Text>
          <Text style={[type.hero, { marginTop: 2 }]}>Peso e indicadores</Text>
        </View>
        <Pressable accessibilityLabel="Perfil" onPress={() => router.push('/perfil')} style={styles.iconBtn}>
          <Ionicons name="person-circle-outline" size={26} color={colors.text} />
        </Pressable>
      </View>

      {loaded && !profile && (
        <Card style={{ marginTop: space.lg, gap: space.md }}>
          <Text style={type.subtitle}>Completa tu perfil</Text>
          <Text style={type.caption}>Con tu altura, edad y sexo se calculan los indicadores.</Text>
          <Button label="Completar perfil" icon="person-add-outline" onPress={() => router.push('/perfil')} />
        </Card>
      )}

      <Card style={{ marginTop: space.lg, gap: space.md }}>
        {last ? (
          <>
            <View style={styles.weightRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.caption}>Peso · {formatShort(last.date)}</Text>
                <Text style={styles.weight}>
                  {fmt(last.weight)}
                  <Text style={styles.weightUnit}> kg</Text>
                </Text>
              </View>
              <Delta now={last.weight} before={prev?.weight} unit=" kg" />
            </View>
            <View style={styles.measures}>
              {MEASURES.map((m) => (
                <View key={m.key} style={styles.measure}>
                  <Text style={type.caption}>{m.label}</Text>
                  <Text style={type.subtitle}>{last[m.key] != null ? `${fmt(last[m.key] as number)} cm` : '—'}</Text>
                  <Delta now={last[m.key] as number} before={prev?.[m.key] as number} unit="" lowerIsBetter={m.lowerIsBetter} />
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={type.caption}>Aún no hay mediciones. Pésate una vez por semana, por la mañana y en ayunas.</Text>
        )}
        <Button label="Registrar medición" icon="scale-outline" onPress={() => router.push('/medicion')} />
      </Card>

      {entries.length > 1 && (
        <>
          <SectionTitle>Evolución del peso</SectionTitle>
          <Card>
            <LineChart points={entries.map((e) => ({ date: e.date, value: e.weight }))} format={(v) => fmt(v)} />
          </Card>
        </>
      )}

      {t && (
        <>
          <SectionTitle>Para perder grasa sin perder músculo</SectionTitle>
          <Card style={{ gap: space.md }}>
            <View style={styles.targetRow}>
              <Ionicons name="flame-outline" size={22} color={colors.accent} />
              <Text style={[type.body, { flex: 1 }]}>Calorías al día</Text>
              <Text style={type.subtitle}>
                {t.kcalMin}–{t.kcalMax} kcal
              </Text>
            </View>
            <View style={styles.targetRow}>
              <Ionicons name="nutrition-outline" size={22} color={colors.accent} />
              <Text style={[type.body, { flex: 1 }]}>Proteína al día</Text>
              <Text style={type.subtitle}>
                {t.proteinMin}–{t.proteinMax} g
              </Text>
            </View>
            <Text style={type.caption}>Orientativo: 300–500 kcal por debajo de tu gasto diario y 1,6–2,2 g de proteína por kilo.</Text>
          </Card>
        </>
      )}

      {profile && last && (
        <>
          {(
            [
              ['Indicadores calculados', INDICATORS.filter((d) => !d.group)],
              ['De la báscula', INDICATORS.filter((d) => d.group === 'bascula')],
            ] as const
          ).map(([title, defs]) => {
            const rows = defs
              .map((def) => ({ def, series: seriesFor(def, entries, profile) }))
              // Los de la báscula solo aparecen si alguna vez se han apuntado.
              .filter((r) => !r.def.group || r.series.length > 0);
            if (rows.length === 0) return null;
            return (
              <View key={title}>
                <SectionTitle>{title}</SectionTitle>
                <View style={{ gap: space.sm }}>
                  {rows.map(({ def, series }) => {
                    const current = series.length && series[series.length - 1].date === last.date ? series[series.length - 1] : null;
                    const range = current ? rangeFor(def, profile, current.value) : null;
                    return (
                      <Pressable
                        key={def.id}
                        onPress={() => router.push({ pathname: '/indicador/[id]', params: { id: def.id } })}
                        style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                        <Card style={styles.indicator}>
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={type.caption}>{def.name}</Text>
                            {current ? (
                              <Text style={styles.indValue}>{formatValue(def, current.value)}</Text>
                            ) : (
                              <Text style={type.caption}>
                                {def.group ? 'Sin dato en la última medición' : `Falta: ${def.needs}`}
                              </Text>
                            )}
                            {range && <Pill label={range.label} color={TONE_COLOR[range.tone]} bg={colors.cardHigh} />}
                          </View>
                          <View style={{ width: 90 }}>
                            {series.length > 1 && <LineChart points={series} height={44} compact ranges={def.ranges?.(profile)} />}
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  weightRow: { flexDirection: 'row', alignItems: 'flex-end' },
  weight: { fontSize: 40, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  weightUnit: { fontSize: 18, fontWeight: '600', color: colors.muted },
  measures: { flexDirection: 'row', justifyContent: 'space-between' },
  measure: { alignItems: 'flex-start', gap: 2 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  indicator: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  indValue: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
});
