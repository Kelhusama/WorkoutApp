import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, space, type } from './theme';

/** Convierte "80,5" o "80.5" en número; vacío → null. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const numberToText = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

export function NumberField({
  label,
  hint,
  unit,
  value,
  onChange,
  placeholder,
  decimal = true,
}: {
  label: string;
  hint?: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  decimal?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={type.subtitle}>{label}</Text>
        {hint && <Text style={type.caption}>{hint}</Text>}
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          style={styles.input}
          selectTextOnFocus
          accessibilityLabel={label}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardHigh,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    minWidth: 120,
  },
  input: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700', paddingVertical: 10, textAlign: 'right' },
  unit: { color: colors.muted, fontSize: 14, fontWeight: '600', marginLeft: 6, minWidth: 26 },
});
