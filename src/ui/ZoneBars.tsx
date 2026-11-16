import { StyleSheet, Text, View } from 'react-native';

import { WEEKLY_MINUTES, ZONE_LABEL, ZONE_ORDER, zoneVerdict, type Zone } from '@/domain/stretches';
import { Card } from './components';
import { colors, space, type } from './theme';

const SCALE_MAX = 12;
const TONE = { low: colors.info, good: colors.success, warn: colors.warn } as const;
const pct = (v: number) => `${Math.min(100, (v / SCALE_MAX) * 100)}%` as const;
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

/** Minutos de estiramiento de la semana por zona, frente a la franja útil de 5 a 10 minutos. */
export function ZoneBars({ minutes }: { minutes: Record<Zone, number> }) {
  return (
    <Card style={{ gap: space.md }}>
      {ZONE_ORDER.map((z) => {
        const v = minutes[z];
        const verdict = zoneVerdict(v);
        return (
          <View key={z} style={{ gap: 4 }} accessibilityLabel={`${ZONE_LABEL[z]}: ${fmt(v)} minutos esta semana, ${verdict.label}`}>
            <View style={styles.row}>
              <Text style={[type.subtitle, { flex: 1 }]} numberOfLines={1}>
                {ZONE_LABEL[z]}
              </Text>
              <Text style={[type.caption, { color: TONE[verdict.tone] }]}>{verdict.label}</Text>
              <Text style={styles.value}>{fmt(v)}′</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.zone, { left: pct(WEEKLY_MINUTES.min), width: pct(WEEKLY_MINUTES.max - WEEKLY_MINUTES.min) }]} />
              <View style={[styles.fill, { width: pct(v), backgroundColor: TONE[verdict.tone] }]} />
            </View>
          </View>
        );
      })}
      <Text style={type.caption}>
        Minutos de esta semana por zona. La franja marca de {WEEKLY_MINUTES.min} a {WEEKLY_MINUTES.max} minutos: por debajo se nota poco y por
        encima no se gana más flexibilidad.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  value: { width: 44, textAlign: 'right', fontSize: 16, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.cardHigh, overflow: 'hidden' },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.successSoft },
  fill: { height: '100%', borderRadius: 5 },
});
