import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { amountText, prescriptionText } from '@/domain/format';
import { TEMPO_LABEL, type Prescription } from '@/domain/progression';
import { exerciseFor, type Slot } from '@/domain/templates';
import { ExerciseFigure } from '@/illustrations/ExerciseFigure';
import { Card } from './components';
import { colors, radius, space, type } from './theme';

interface Props {
  slot: Slot;
  target: Prescription;
  values: number[];
  onChange: (values: number[]) => void;
}

export function ExerciseCard({ slot, target, values, onChange }: Props) {
  const ex = exerciseFor(slot);
  const step = ex.measure === 'time' ? 5 : 1;
  const [showHow, setShowHow] = useState(false);

  const setValue = (i: number, v: number) => {
    Haptics.selectionAsync();
    onChange(values.map((x, j) => (j === i ? Math.max(0, v) : x)));
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: 4 }}>
        <Text style={type.title}>{ex.name}</Text>
        <Text style={[type.body, { color: colors.accent, fontWeight: '700' }]}>{prescriptionText(target, ex)}</Text>
        <Text style={type.caption}>{ex.muscles.join(' · ')}</Text>
      </View>

      {target.tempo > 0 && (
        <View style={styles.tempo}>
          <Ionicons name="timer-outline" size={18} color={colors.info} />
          <Text style={[type.caption, { color: colors.info, flex: 1 }]}>
            {TEMPO_LABEL[target.tempo]}: haz cada repetición más despacio, es la forma de progresar con el mismo peso.
          </Text>
        </View>
      )}
      {slot.note && <Text style={type.caption}>{slot.note}</Text>}

      <Pressable onPress={() => setShowHow((s) => !s)} style={styles.howBtn} accessibilityRole="button">
        <Ionicons name={showHow ? 'chevron-up' : 'body-outline'} size={18} color={colors.text} />
        <Text style={[type.subtitle, { fontSize: 14 }]}>{showHow ? 'Ocultar' : 'Cómo se hace'}</Text>
      </Pressable>

      {showHow && (
        <View style={styles.how}>
          <ExerciseFigure exerciseId={ex.id} size={190} />
          {ex.cues.map((c) => (
            <View key={c} style={styles.bullet}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 1 }} />
              <Text style={[type.body, { flex: 1, fontSize: 14 }]}>{c}</Text>
            </View>
          ))}
          {ex.mistakes.map((m) => (
            <View key={m} style={styles.bullet}>
              <Ionicons name="close-circle" size={16} color={colors.danger} style={{ marginTop: 1 }} />
              <Text style={[type.caption, { flex: 1 }]}>Evita: {m.toLowerCase()}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.table}>
        <Text style={type.overline}>Lo que has hecho</Text>
        {values.map((v, i) => {
          const hit = v >= target.reps;
          const extra = i >= target.sets;
          return (
            <View key={i} style={styles.setRow}>
              <Ionicons
                name={hit ? 'checkmark-circle' : 'alert-circle'}
                size={22}
                color={hit ? colors.success : colors.danger}
              />
              <Text style={styles.setLabel}>
                Serie {i + 1}
                {extra ? ' (extra)' : ''}
              </Text>
              <Pressable accessibilityLabel={`Restar en serie ${i + 1}`} onPress={() => setValue(i, v - step)} style={styles.stepBtn} hitSlop={6}>
                <Ionicons name="remove" size={20} color={colors.text} />
              </Pressable>
              <Text style={[styles.setValue, { color: hit ? colors.text : colors.danger }]}>{amountText(v, ex, true)}</Text>
              <Pressable accessibilityLabel={`Sumar en serie ${i + 1}`} onPress={() => setValue(i, v + step)} style={styles.stepBtn} hitSlop={6}>
                <Ionicons name="add" size={20} color={colors.text} />
              </Pressable>
              {extra ? (
                <Pressable accessibilityLabel="Quitar serie" onPress={() => onChange(values.filter((_, j) => j !== i))} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.faint} />
                </Pressable>
              ) : (
                <View style={{ width: 18 }} />
              )}
            </View>
          );
        })}
        <Pressable onPress={() => onChange([...values, target.reps])} style={styles.addSet}>
          <Ionicons name="add-circle-outline" size={18} color={colors.muted} />
          <Text style={type.caption}>Añadir una serie</Text>
        </Pressable>
      </View>
      {values.slice(0, target.sets).some((v) => v < target.reps) && (
        <Text style={[type.caption, { color: colors.danger }]}>
          Alguna serie se quedó corta: la próxima vez este ejercicio se mantiene igual.
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tempo: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
  },
  howBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.cardHigh,
  },
  how: { gap: space.sm, padding: space.md, backgroundColor: colors.cardHigh, borderRadius: radius.md },
  bullet: { flexDirection: 'row', gap: space.sm },
  table: { gap: space.sm },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  setLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setValue: { width: 70, textAlign: 'center', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
});
