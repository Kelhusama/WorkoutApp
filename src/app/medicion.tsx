import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { getBodyLog, getProfile, saveBodyEntry } from '@/db/body';
import type { Sex } from '@/domain/body';
import { formatLong, today } from '@/domain/dates';
import { Button, Card, SectionTitle } from '@/ui/components';
import { NumberField, numberToText, parseNumber } from '@/ui/NumberField';
import { colors, space, type } from '@/ui/theme';

type Field = 'weight' | 'waist' | 'neck' | 'hip' | 'arm' | 'chest' | 'bodyFat';

export default function MeasurementScreen() {
  const db = useSQLiteContext();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? today();
  const [sex, setSex] = useState<Sex>('H');
  const [f, setF] = useState<Record<Field, string>>({ weight: '', waist: '', neck: '', hip: '', arm: '', chest: '', bodyFat: '' });

  useEffect(() => {
    (async () => {
      const p = await getProfile(db);
      if (p) setSex(p.sex);
      const log = await getBodyLog(db);
      // Si ya hay medición ese día se edita; si no, se precarga la última para tocar solo lo que cambie.
      const base = log.find((e) => e.date === date) ?? log[log.length - 1];
      if (base) {
        setF({
          weight: numberToText(base.weight),
          waist: numberToText(base.waist),
          neck: numberToText(base.neck),
          hip: numberToText(base.hip),
          arm: numberToText(base.arm),
          chest: numberToText(base.chest),
          bodyFat: base.date === date ? numberToText(base.bodyFat) : '',
        });
      }
    })();
  }, [db, date]);

  const set = (k: Field) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const weight = parseNumber(f.weight);
  const valid = weight != null && weight > 30 && weight < 300;

  const save = async () => {
    if (!valid) return;
    await saveBodyEntry(db, {
      date,
      weight: weight!,
      waist: parseNumber(f.waist),
      neck: parseNumber(f.neck),
      hip: parseNumber(f.hip),
      arm: parseNumber(f.arm),
      chest: parseNumber(f.chest),
      bodyFat: parseNumber(f.bodyFat),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Text style={type.overline}>{formatLong(date)}</Text>
      <Text style={type.caption}>Por la mañana, en ayunas y después de ir al baño. Usa siempre la misma cinta y el mismo sitio.</Text>

      <Card style={{ gap: space.lg }}>
        <NumberField label="Peso" unit="kg" value={f.weight} onChange={set('weight')} placeholder="80,0" />
      </Card>

      <SectionTitle>Medidas (opcionales)</SectionTitle>
      <Card style={{ gap: space.lg }}>
        <NumberField label="Cintura" hint="A la altura del ombligo, sin apretar" unit="cm" value={f.waist} onChange={set('waist')} />
        <NumberField label="Cuello" hint="Justo debajo de la nuez" unit="cm" value={f.neck} onChange={set('neck')} />
        {sex === 'M' && <NumberField label="Cadera" hint="En la parte más ancha" unit="cm" value={f.hip} onChange={set('hip')} />}
        <NumberField label="Brazo" hint="Bíceps contraído, parte más ancha" unit="cm" value={f.arm} onChange={set('arm')} />
        <NumberField label="Pecho" hint="A la altura de los pezones" unit="cm" value={f.chest} onChange={set('chest')} />
      </Card>
      <Text style={type.caption}>Con cintura y cuello se calcula tu % de grasa, masa magra y FFMI.</Text>

      <SectionTitle>Báscula (opcional)</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <NumberField label="% de grasa" hint="Si tu báscula lo da" unit="%" value={f.bodyFat} onChange={set('bodyFat')} />
        <Text style={[type.caption, { color: colors.faint }]}>Si lo rellenas, se usa en vez de la fórmula.</Text>
      </Card>

      <Button label="Guardar medición" icon="checkmark-circle" onPress={save} disabled={!valid} />
    </ScrollView>
  );
}
