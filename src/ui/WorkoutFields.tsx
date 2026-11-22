import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LOAD_INFO, LOAD_OPTIONS, STATE_INFO, STATE_OPTIONS, type Load, type State } from '@/domain/workouts';
import { Segmented, type IconName } from './components';
import { colors, space, type } from './theme';

/** «¿Cómo estabas?»: cuatro opciones que caben en dos filas en un móvil estrecho. */
export function StatePicker({ value, onChange }: { value: State | null; onChange: (s: State) => void }) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Cómo estabas">
      {STATE_OPTIONS.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.id)}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}>
            <Ionicons name={STATE_INFO[o.id].icon as IconName} size={16} color={on ? colors.onAccent : colors.muted} />
            <Text style={[type.caption, { color: on ? colors.onAccent : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Carga de la sesión, en tres niveles. */
export function LoadPicker({ value, onChange }: { value: Load | null; onChange: (l: Load) => void }) {
  return (
    <View style={{ gap: 4 }}>
      <Segmented label="Carga de la sesión" options={LOAD_OPTIONS} value={value === null ? null : (String(value) as `${Load}`)} onChange={(v) => onChange(Number(v) as Load)} />
      {value !== null && <Text style={type.caption}>{LOAD_INFO[value].detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: 22,
    backgroundColor: colors.cardHigh,
    flexBasis: '47%',
    flexGrow: 1,
  },
  chipOn: { backgroundColor: colors.accent },
});
