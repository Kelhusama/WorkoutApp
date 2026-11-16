import { StyleSheet, Text, View } from 'react-native';

import { GROUP_LABEL, GROUP_ORDER, HYPERTROPHY_RANGE, volumeVerdict, type MuscleGroup } from '@/domain/volume';
import { Card } from './components';
import { colors, space, type } from './theme';

const SCALE_MAX = 24;
const TONE = { low: colors.info, good: colors.success, warn: '#F5B83D' } as const;
const pct = (v: number) => `${Math.min(100, (v / SCALE_MAX) * 100)}%` as const;
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

/** Series semanales por músculo frente a la zona orientativa de hipertrofia. */
export function VolumeBars({ volume }: { volume: Record<MuscleGroup, number> }) {
  return (
    <Card style={{ gap: space.md }}>
      {GROUP_ORDER.map((g) => {
        const v = volume[g];
        const verdict = volumeVerdict(v);
        return (
          <View key={g} style={{ gap: 4 }}>
            <View style={styles.row}>
              <Text style={[type.subtitle, { flex: 1 }]}>{GROUP_LABEL[g]}</Text>
              <Text style={[type.caption, { color: TONE[verdict.tone] }]}>{verdict.label}</Text>
              <Text style={styles.value}>{fmt(v)}</Text>
            </View>
            <View style={styles.track} accessibilityLabel={`${GROUP_LABEL[g]}: ${fmt(v)} series, ${verdict.label}`}>
              <View style={[styles.zone, { left: pct(HYPERTROPHY_RANGE.min), width: pct(HYPERTROPHY_RANGE.max - HYPERTROPHY_RANGE.min) }]} />
              <View style={[styles.fill, { width: pct(v), backgroundColor: TONE[verdict.tone] }]} />
            </View>
          </View>
        );
      })}
      <Text style={type.caption}>
        Series de esta semana en casa (la franja marca la zona de {HYPERTROPHY_RANGE.min}–{HYPERTROPHY_RANGE.max} series, orientativa para ganar
        músculo). Una serie cuenta 1 para el músculo principal y 0,5 para los que ayudan. No incluye el gimnasio, que no se registra por
        ejercicio.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  value: { width: 40, textAlign: 'right', fontSize: 16, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.cardHigh, overflow: 'hidden' },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.successSoft },
  fill: { height: '100%', borderRadius: 5 },
});
