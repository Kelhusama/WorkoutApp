import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getProfile, saveProfile } from '@/db/body';
import { ACTIVITY_LEVELS, ageOn, type Sex } from '@/domain/body';
import { fromISODate, today } from '@/domain/dates';
import { BackupCard } from '@/ui/BackupCard';
import { Button, Card, SectionTitle, Segmented } from '@/ui/components';
import { NumberField, numberToText, parseNumber } from '@/ui/NumberField';
import { DriveBackupCard } from '@/ui/DriveBackupCard';
import { RemindersSettings } from '@/ui/RemindersSettings';
import { colors, radius, space, type, font } from '@/ui/theme';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha válida de verdad (no admite el 31 de febrero). */
function birthDate(d: number | null, m: number | null, y: number | null): string | null {
  if (!d || !m || !y || y < 1900) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  const real = fromISODate(iso);
  return real.getFullYear() === y && real.getMonth() + 1 === m && real.getDate() === d ? iso : null;
}

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const [height, setHeight] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [activity, setActivity] = useState(1.55);
  const [saved, setSaved] = useState(false);
  const monthRef = useRef<ComponentRef<typeof TextInput>>(null);
  const yearRef = useRef<ComponentRef<typeof TextInput>>(null);

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
  const birth = birthDate(parseNumber(day), parseNumber(month), parseNumber(year));
  const age = birth ? ageOn(birth, today()) : null;
  const anyDate = day || month || year;

  const problem =
    h === null
      ? 'Escribe tu altura.'
      : h < 100 || h > 250
        ? 'La altura debe estar entre 100 y 250 cm.'
        : !birth
          ? anyDate
            ? 'Esa fecha de nacimiento no existe. Revisa día, mes y año.'
            : 'Escribe tu fecha de nacimiento.'
          : age === null || age < 10 || age > 100
            ? 'Revisa el año de nacimiento.'
            : sex === null
              ? 'Elige hombre o mujer: cambia las fórmulas.'
              : null;

  const save = async () => {
    if (problem || !birth || h === null || sex === null) return;
    await saveProfile(db, { heightCm: h, birthDate: birth, sex, activity });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
  };

  const touched = <T,>(setter: (v: T) => void) => (v: T) => {
    setSaved(false);
    setter(v);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <RemindersSettings />

      <SectionTitle>Datos personales</SectionTitle>
      <Card style={{ gap: space.lg }}>
        <NumberField label="Altura" unit="cm" value={height} onChange={touched(setHeight)} placeholder="175" decimal={false} />
        <View style={{ gap: space.sm }}>
          <Text style={type.subtitle}>Fecha de nacimiento</Text>
          <View style={styles.dateRow}>
            <TextInput
              value={day}
              onChangeText={(v) => {
                touched(setDay)(v);
                if (v.length === 2) monthRef.current?.focus();
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="DD"
              placeholderTextColor={colors.faint}
              style={[styles.dateInput, { flex: 1 }]}
              accessibilityLabel="Día de nacimiento"
              returnKeyType="next"
              onSubmitEditing={() => monthRef.current?.focus()}
            />
            <Text style={styles.slash}>/</Text>
            <TextInput
              ref={monthRef}
              value={month}
              onChangeText={(v) => {
                touched(setMonth)(v);
                if (v.length === 2) yearRef.current?.focus();
              }}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="MM"
              placeholderTextColor={colors.faint}
              style={[styles.dateInput, { flex: 1 }]}
              accessibilityLabel="Mes de nacimiento"
              returnKeyType="next"
              onSubmitEditing={() => yearRef.current?.focus()}
            />
            <Text style={styles.slash}>/</Text>
            <TextInput
              ref={yearRef}
              value={year}
              onChangeText={touched(setYear)}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="AAAA"
              placeholderTextColor={colors.faint}
              style={[styles.dateInput, { flex: 1.6 }]}
              accessibilityLabel="Año de nacimiento"
            />
          </View>
          {birth && age !== null && <Text style={type.caption}>{age} años</Text>}
        </View>

        <View style={{ gap: space.sm }}>
          <Text style={type.subtitle}>Sexo</Text>
          <Segmented
            label="Sexo"
            options={[
              { id: 'H', label: 'Hombre' },
              { id: 'M', label: 'Mujer' },
            ]}
            value={sex}
            onChange={touched(setSex)}
          />
          <Text style={type.caption}>Cambia las fórmulas de grasa y metabolismo y los rangos de referencia.</Text>
        </View>
      </Card>

      <SectionTitle>Nivel de actividad</SectionTitle>
      <View style={{ gap: space.sm }}>
        {ACTIVITY_LEVELS.map((a) => {
          const active = activity === a.factor;
          return (
            <Pressable
              key={a.factor}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${a.label}: ${a.detail}`}
              onPress={() => touched(setActivity)(a.factor)}
              style={[styles.option, active && { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
              <Text style={type.subtitle}>{a.label}</Text>
              <Text style={type.caption}>{a.detail}</Text>
            </Pressable>
          );
        })}
      </View>

      {problem && <Text style={[type.caption, { color: colors.danger }]}>{problem}</Text>}
      {saved && <Text style={[type.caption, { color: colors.success }]}>Perfil guardado.</Text>}
      <Button label="Guardar perfil" icon="checkmark-circle" onPress={save} disabled={problem !== null} />

      <SectionTitle>Tus datos</SectionTitle>
      <BackupCard onRestored={() => router.back()} />
      <DriveBackupCard onRestored={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dateInput: {
    minHeight: 48,
    backgroundColor: colors.cardHigh,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 20,
    ...font.w700,
    textAlign: 'center',
    paddingHorizontal: space.sm,
  },
  slash: { color: colors.muted, fontSize: 20, ...font.w700 },
  option: {
    minHeight: 56,
    justifyContent: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 2,
  },
});
