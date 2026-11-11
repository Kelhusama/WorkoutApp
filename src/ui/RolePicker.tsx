import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROLE_INFO, type Role } from '@/domain/schedule';
import type { IconName } from './components';
import { colors, radius } from './theme';

const ROLES: Role[] = ['gym', 'casa', 'rest'];

/** Selector Gimnasio / Casa / Descanso. */
export function RolePicker({ value, onChange, compact = false }: { value: Role; onChange: (r: Role) => void; compact?: boolean }) {
  return (
    <View style={styles.wrap}>
      {ROLES.map((r) => {
        const active = r === value;
        return (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={ROLE_INFO[r].label}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(r);
            }}
            style={[styles.item, compact && { paddingVertical: 8 }, active && { backgroundColor: r === 'rest' ? colors.border : colors.accent }]}>
            <Ionicons name={ROLE_INFO[r].icon as IconName} size={compact ? 16 : 20} color={active ? '#fff' : colors.muted} />
            {!compact && <Text style={[styles.label, active && { color: '#fff' }]}>{ROLE_INFO[r].label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: 3, gap: 3 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderRadius: radius.sm },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
});
