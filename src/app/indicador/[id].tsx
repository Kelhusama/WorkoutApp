import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { INDICATORS, formatValue, rangeFor, seriesFor, type Range } from '@/domain/body';
import { formatShort } from '@/domain/dates';
import { useBody } from '@/hooks/useBody';
import { Card, Pill, SectionTitle } from '@/ui/components';
import { LineChart, TONE_COLOR } from '@/ui/LineChart';
import { colors, space, type } from '@/ui/theme';

function rangeText(ranges: Range[], i: number, fmt: (v: number) => string) {
  const r = ranges[i];
  const from = i === 0 ? null : ranges[i - 1].max;
  if (from == null) return `menos de ${fmt(r.max)}`;
  if (r.max === Infinity) return `${fmt(from)} o más`;
  return `${fmt(from)} – ${fmt(r.max)}`;
}

export default function IndicatorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const def = INDICATORS.find((d) => d.id === id);
  const { profile, entries } = useBody();

  if (!def) return null;
  const series = profile ? seriesFor(def, entries, profile) : [];
  const current = series[series.length - 1];
  const ranges = profile ? def.ranges?.(profile) : undefined;
  const range = current && profile ? rangeFor(def, profile, current.value) : null;
  const fmt = (v: number) => formatValue(def, v);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}>
      <Stack.Screen options={{ title: def.name }} />

      <Card style={{ gap: space.sm }}>
        {current ? (
          <>
            <Text style={type.caption}>Último valor · {formatShort(current.date)}</Text>
            <Text style={styles.value}>{fmt(current.value)}</Text>
            {range && <Pill label={range.label} color={TONE_COLOR[range.tone]} bg={colors.cardHigh} />}
          </>
        ) : (
          <Text style={type.caption}>Sin datos todavía. Necesita: {def.needs}.</Text>
        )}
        <Text style={[type.body, { marginTop: space.sm }]}>{def.what}</Text>
      </Card>

      {series.length > 0 && (
        <>
          <SectionTitle>Evolución</SectionTitle>
          <Card>
            <LineChart points={series} ranges={ranges} height={200} format={(v) => v.toFixed(def.decimals).replace('.', ',')} />
          </Card>
        </>
      )}

      {ranges && (
        <>
          <SectionTitle>Rangos de referencia</SectionTitle>
          <Card style={{ gap: space.sm }}>
            {ranges.map((r, i) => {
              const active = range?.label === r.label && range.max === r.max;
              return (
                <View key={r.label + r.max} style={[styles.rangeRow, active && { backgroundColor: colors.cardHigh }]}>
                  <View style={[styles.dot, { backgroundColor: TONE_COLOR[r.tone] }]} />
                  <Text style={[type.body, { flex: 1, fontWeight: active ? '800' : '400' }]}>{r.label}</Text>
                  <Text style={type.caption}>{rangeText(ranges, i, fmt)}</Text>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <SectionTitle>Cómo se calcula</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Text style={type.body}>{def.formula}</Text>
        {def.note && <Text style={type.caption}>{def.note}</Text>}
      </Card>

      {series.length > 0 && (
        <>
          <SectionTitle>Historial</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {[...series].reverse().map((p, i) => {
              const r = profile ? rangeFor(def, profile, p.value) : null;
              return (
                <View key={p.date} style={[styles.histRow, i > 0 && styles.divider]}>
                  <Text style={[type.caption, { width: 60 }]}>{formatShort(p.date)}</Text>
                  <Text style={[type.subtitle, { flex: 1 }]}>{fmt(p.value)}</Text>
                  {r && <Text style={[type.caption, { color: TONE_COLOR[r.tone] }]}>{r.label}</Text>}
                </View>
              );
            })}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 36, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
