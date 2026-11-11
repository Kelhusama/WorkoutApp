import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getProfile, saveProfile } from '@/db/body';
import { ACTIVITY_LEVELS, ageOn, type Sex } from '@/domain/body';
import { today } from '@/domain/dates';
import { Button, Card, SectionTitle } from '@/ui/components';
import { NumberField, numberToText, parseNumber } from '@/ui/NumberField';
import { RemindersSettings } from '@/ui/RemindersSettings';
import { colors, radius, space, type } from '@/ui/theme';

const pad = (n: number) => String(n).padStart(2, '0');

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const [height, setHeight] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState(1.55);

  useEffect(() => {
    getProfile(db).then((p) => {
      if (!p) return;
      setHeight(numberToText(p.heightCm));
      const [y, m, d] = p.birthDate.split('-');
      setYear(y);
      setMonth(String(Number(m)));
      setDay(String(Number(d)));
      setSex(p.sex);
      setActivity(p.activity);
    });
  }, [db]);

  const h = parseNumber(height);
  const y = parseNumber(year);
  const m = parseNumber(month);
  const d = parseNumber(day);
  const birth = y && m && d && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;
  const age = birth ? ageOn(birth, today()) : null;
  const valid = h != null && h > 100 && h < 250 && birth != null && age != null && age > 10 && age < 100 && sex != null;

  const save = async () => {
    if (!valid) return;
    await saveProfile(db, { heightCm: h!, birthDate: birth!, sex: sex!, activity });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <RemindersSettings />

      <SectionTitle>Datos personales</SectionTitle>
      <Card style={{ gap: space.lg }}>
        <NumberField label="Altura" unit="cm" value={height} onChange={setHeight} placeholder="175" decimal={false} />
        <View style={{ gap: space.sm }}>
          <Text style={type.subtitle}>Fecha de nacimiento</Text>
          <NumberField label="Día" unit="" value={day} onChange={setDay} placeholder="20" decimal={false} />
          <NumberField label="Mes" unit="" value={month} onChange={setMonth} placeholder="5" decimal={false} />
          <NumberField label="Año" unit="" value={year} onChange={setYear} placeholder="1995" decimal={false} />
          {age != null && <Text style={type.caption}>{age} años</Text>}
        </View>
      </Card>

      <SectionTitle>Sexo</SectionTitle>
      <Text style={type.caption}>Cambia las fórmulas de grasa, metabolismo y los rangos de referencia.</Text>
      <View style={styles.segment}>
        {(
          [
            ['H', 'Hombre'],
            ['M', 'Mujer'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected: sex === id }}
            onPress={() => setSex(id)}
            style={[styles.segmentItem, sex === id && { backgroundColor: colors.accent }]}>
            <Text style={[styles.segmentLabel, sex === id && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>Nivel de actividad</SectionTitle>
      <View style={{ gap: space.sm }}>
        {ACTIVITY_LEVELS.map((a) => {
          const active = activity === a.factor;
          return (
            <Pressable
              key={a.factor}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setActivity(a.factor)}
              style={[styles.option, active && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
              <Text style={type.subtitle}>{a.label}</Text>
              <Text style={type.caption}>{a.detail}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: space.md }}>
        <Button label="Guardar perfil" icon="checkmark-circle" onPress={save} disabled={!valid} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.cardHigh, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center' },
  segmentLabel: { fontSize: 15, fontWeight: '700', color: colors.muted },
  option: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 2,
  },
});
