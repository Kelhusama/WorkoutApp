import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { youtubeSearchUrl } from '@/domain/exercises';
import { TEMPO_LABEL, type Prescription } from '@/domain/progression';
import { exerciseFor, unitFor, type Slot } from '@/domain/templates';
import { Card, Pill, Stepper } from './components';
import { colors, radius, space, type } from './theme';

interface Props {
  slot: Slot;
  target: Prescription;
  values: number[];
  onChange: (values: number[]) => void;
}

export function ExerciseCard({ slot, target, values, onChange }: Props) {
  const ex = exerciseFor(slot);
  const unit = unitFor(ex);
  const [selected, setSelected] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const allHit = values.length >= target.sets && values.slice(0, target.sets).every((v) => v >= target.reps);

  const setValue = (i: number, v: number) => onChange(values.map((x, j) => (j === i ? v : x)));

  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={type.subtitle}>{ex.name}</Text>
          <Text style={type.caption}>
            {target.sets} × {target.reps}
            {unit}
            {ex.perArm ? ' por brazo' : ''} · {ex.muscles.join(', ')}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Cómo se hace"
          onPress={() => setShowInfo((s) => !s)}
          hitSlop={10}
          style={[styles.infoBtn, showInfo && { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="information" size={18} color={showInfo ? colors.accent : colors.muted} />
        </Pressable>
      </View>

      {(target.tempo > 0 || slot.note) && (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {target.tempo > 0 && <Pill label={TEMPO_LABEL[target.tempo]!} color={colors.info} bg={colors.infoSoft} />}
          {slot.note && <Text style={[type.caption, { flexShrink: 1 }]}>{slot.note}</Text>}
        </View>
      )}

      {showInfo && (
        <View style={styles.info}>
          {ex.cues.map((c) => (
            <View key={c} style={styles.bullet}>
              <Ionicons name="checkmark" size={14} color={colors.success} style={{ marginTop: 2 }} />
              <Text style={[type.body, { flex: 1, fontSize: 14 }]}>{c}</Text>
            </View>
          ))}
          {ex.mistakes.map((m) => (
            <View key={m} style={styles.bullet}>
              <Ionicons name="close" size={14} color={colors.danger} style={{ marginTop: 2 }} />
              <Text style={[type.caption, { flex: 1 }]}>{m}</Text>
            </View>
          ))}
          <Pressable onPress={() => Linking.openURL(youtubeSearchUrl(ex))} style={styles.video}>
            <Ionicons name="logo-youtube" size={18} color={colors.danger} />
            <Text style={[type.subtitle, { fontSize: 14 }]}>Ver vídeo</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.chips}>
        {values.map((v, i) => {
          const hit = v >= target.reps;
          const active = selected === i;
          return (
            <Pressable
              key={i}
              accessibilityLabel={`Serie ${i + 1}: ${v}${unit}`}
              onPress={() => {
                Haptics.selectionAsync();
                setSelected(active ? null : i);
              }}
              style={[
                styles.chip,
                { backgroundColor: hit ? colors.successSoft : colors.dangerSoft },
                active && { borderColor: colors.accent },
              ]}>
              <Text style={styles.chipSet}>S{i + 1}</Text>
              <Text style={[styles.chipValue, { color: hit ? colors.success : colors.danger }]}>
                {v}
                {unit}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="Añadir serie"
          onPress={() => onChange([...values, target.reps])}
          style={[styles.chip, styles.chipAdd]}>
          <Ionicons name="add" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {selected !== null && selected < values.length && (
        <View style={{ gap: space.sm }}>
          <Text style={type.caption}>Serie {selected + 1}: ajusta lo que hiciste de verdad</Text>
          <Stepper
            value={values[selected]}
            onChange={(v) => setValue(selected, v)}
            step={ex.measure === 'time' ? 5 : 1}
            suffix={ex.measure === 'time' ? ' s' : ' reps'}
          />
          {values.length > target.sets && selected >= target.sets && (
            <Pressable
              onPress={() => {
                onChange(values.filter((_, j) => j !== selected));
                setSelected(null);
              }}>
              <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>Quitar esta serie</Text>
            </Pressable>
          )}
        </View>
      )}

      {selected === null && (
        <Text style={[type.caption, { color: allHit ? colors.success : colors.muted }]}>
          {allHit ? 'Objetivo cumplido' : 'Toca una serie para corregirla'}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { gap: space.sm, padding: space.md, backgroundColor: colors.cardHigh, borderRadius: radius.md },
  bullet: { flexDirection: 'row', gap: space.sm },
  video: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipAdd: { backgroundColor: colors.cardHigh, justifyContent: 'center' },
  chipSet: { fontSize: 11, fontWeight: '700', color: colors.muted },
  chipValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
