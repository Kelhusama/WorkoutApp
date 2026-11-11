import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Feeling } from '@/domain/progression';
import { colors, radius, space, type } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
}) {
  const fg = variant === 'primary' ? '#fff' : variant === 'secondary' ? colors.text : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'secondary' && { backgroundColor: colors.cardHigh },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
      ]}>
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, color = colors.muted, bg = colors.cardHigh }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.accent }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix = '',
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  format?: (v: number) => string;
}) {
  const set = (v: number) => {
    Haptics.selectionAsync();
    onChange(Math.max(min, Math.round(v * 100) / 100));
  };
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityLabel="Restar" onPress={() => set(value - step)} style={styles.stepBtn} hitSlop={8}>
        <Ionicons name="remove" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.stepValue}>
        {format(value)}
        <Text style={styles.stepSuffix}>{suffix}</Text>
      </Text>
      <Pressable accessibilityLabel="Sumar" onPress={() => set(value + step)} style={styles.stepBtn} hitSlop={8}>
        <Ionicons name="add" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const FEELINGS: { id: Feeling; label: string; icon: IconName; color: string; bg: string }[] = [
  { id: 'facil', label: 'Fácil', icon: 'happy-outline', color: colors.success, bg: colors.successSoft },
  { id: 'normal', label: 'Normal', icon: 'remove-circle-outline', color: colors.info, bg: colors.infoSoft },
  { id: 'dura', label: 'Dura', icon: 'flame-outline', color: colors.danger, bg: colors.dangerSoft },
];

export function FeelingPicker({ value, onChange }: { value: Feeling | null; onChange: (f: Feeling) => void }) {
  return (
    <View style={styles.feelings}>
      {FEELINGS.map((f) => {
        const active = value === f.id;
        return (
          <Pressable
            key={f.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(f.id);
            }}
            style={[
              styles.feeling,
              { borderColor: active ? f.color : colors.border, backgroundColor: active ? f.bg : colors.card },
            ]}>
            <Ionicons name={f.icon} size={24} color={active ? f.color : colors.muted} />
            <Text style={[styles.feelingLabel, { color: active ? f.color : colors.muted }]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={[type.overline, { marginTop: space.xl, marginBottom: space.sm }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 15,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillLabel: { fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cardHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardHigh,
    borderRadius: radius.md,
    padding: space.xs,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 26, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  stepSuffix: { fontSize: 15, fontWeight: '600', color: colors.muted },
  feelings: { flexDirection: 'row', gap: space.sm },
  feeling: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  feelingLabel: { fontSize: 14, fontWeight: '700' },
});
