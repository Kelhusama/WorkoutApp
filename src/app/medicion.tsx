import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { getBodyLog, getProfile, saveBodyEntry } from '@/db/body';
import type { BodyEntry, Sex } from '@/domain/body';
import { formatLong, today } from '@/domain/dates';
import { Button, Card, SectionTitle } from '@/ui/components';
import { NumberField, numberToText, parseNumber } from '@/ui/NumberField';
import { colors, space, type } from '@/ui/theme';

type Field = Exclude<keyof BodyEntry, 'date'>;

/** Medidas con cinta: se precargan con la última medición porque cambian poco. */
const TAPE: { key: Field; label: string; hint: string; women?: boolean }[] = [
  { key: 'waist', label: 'Cintura', hint: 'A la altura del ombligo, sin apretar' },
  { key: 'neck', label: 'Cuello', hint: 'Justo debajo de la nuez' },
  { key: 'hip', label: 'Cadera', hint: 'En la parte más ancha', women: true },
  { key: 'arm', label: 'Brazo', hint: 'Bíceps contraído, parte más ancha' },
  { key: 'chest', label: 'Pecho', hint: 'A la altura de los pezones' },
];

/** Valores de la Huawei Scale 3 tal como aparecen en Huawei Salud. No se precargan: son de cada pesada. */
const SCALE: { key: Field; label: string; unit: string; decimal?: boolean }[] = [
  { key: 'bodyFat', label: '% de grasa', unit: '%' },
  { key: 'skeletalMuscle', label: 'Músculo esquelético', unit: 'kg' },
  { key: 'fatFreeMass', label: 'Masa libre de grasa', unit: 'kg' },
  { key: 'water', label: '% de agua', unit: '%' },
  { key: 'protein', label: '% de proteína', unit: '%' },
  { key: 'boneMass', label: 'Masa ósea', unit: 'kg' },
  { key: 'visceralFat', label: 'Grasa visceral', unit: 'nivel', decimal: false },
  { key: 'scaleBmr', label: 'Metabolismo basal', unit: 'kcal', decimal: false },
  { key: 'bodyAge', label: 'Edad corporal', unit: 'años', decimal: false },
  { key: 'bodyScore', label: 'Puntuación', unit: 'pts', decimal: false },
];

export default function MeasurementScreen() {
  const db = useSQLiteContext();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? today();
  const [sex, setSex] = useState<Sex>('H');
  const [f, setF] = useState<Partial<Record<Field, string>>>({});
  const [showScale, setShowScale] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await getProfile(db);
      if (p) setSex(p.sex);
      const log = await getBodyLog(db);
      const same = log.find((e) => e.date === date);
      const last = log[log.length - 1];
      const next: Partial<Record<Field, string>> = {};
      // Si ya hay medición ese día se edita entera; si no, se precargan peso y cinta de la última.
      const base = same ?? last;
      if (base) {
        next.weight = numberToText(base.weight);
        for (const t of TAPE) next[t.key] = numberToText(base[t.key] as number | null);
      }
      if (same) for (const s of SCALE) next[s.key] = numberToText(same[s.key] as number | null);
      setF(next);
    })();
  }, [db, date]);

  const set = (k: Field) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const weight = parseNumber(f.weight ?? '');
  const valid = weight != null && weight > 30 && weight < 300;

  const save = async () => {
    if (!valid) return;
    const entry: BodyEntry = { date, weight: weight! };
    for (const k of [...TAPE.map((t) => t.key), ...SCALE.map((s) => s.key)]) {
      (entry as unknown as Record<string, number | null>)[k] = parseNumber(f[k] ?? '');
    }
    await saveBodyEntry(db, entry);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Text style={type.overline}>{formatLong(date)}</Text>
      <Text style={type.caption}>Por la mañana, en ayunas y después de ir al baño. Usa siempre la misma cinta y el mismo sitio.</Text>

      <Card style={{ gap: space.lg }}>
        <NumberField label="Peso" unit="kg" value={f.weight ?? ''} onChange={set('weight')} placeholder="80,0" />
      </Card>

      <Pressable onPress={() => setShowScale((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <SectionTitle>Báscula Huawei (opcional)</SectionTitle>
        <Ionicons name={showScale ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} style={{ marginTop: space.lg }} />
      </Pressable>
      {showScale && (
        <Card style={{ gap: space.lg }}>
          <Text style={type.caption}>Cópialos de Huawei Salud → Peso → la medición de hoy. Deja vacío lo que no tengas.</Text>
          {SCALE.map((s) => (
            <NumberField
              key={s.key}
              label={s.label}
              unit={s.unit}
              value={f[s.key] ?? ''}
              onChange={set(s.key)}
              decimal={s.decimal ?? true}
            />
          ))}
          <Text style={[type.caption, { color: colors.faint }]}>
            Si apuntas el % de grasa y la masa libre de grasa, se usan en vez de las fórmulas.
          </Text>
        </Card>
      )}

      <SectionTitle>Medidas con cinta (opcionales)</SectionTitle>
      <Card style={{ gap: space.lg }}>
        {TAPE.filter((t) => !t.women || sex === 'M').map((t) => (
          <NumberField key={t.key} label={t.label} hint={t.hint} unit="cm" value={f[t.key] ?? ''} onChange={set(t.key)} />
        ))}
      </Card>
      <Text style={type.caption}>Con cintura y cuello se calcula el % de grasa aunque no tengas báscula.</Text>

      <Button label="Guardar medición" icon="checkmark-circle" onPress={save} disabled={!valid} />
    </ScrollView>
  );
}
