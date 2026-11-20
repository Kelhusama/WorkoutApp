import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteBodyEntry, getBodyLog, getProfile, saveBodyEntry } from '@/db/body';
import type { BodyEntry, Sex } from '@/domain/body';
import { formatLong, today } from '@/domain/dates';
import { SCALE_FIELD_LABEL, parseScaleText } from '@/domain/scaleText';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Button, Card, SectionTitle } from '@/ui/components';
import { NumberField, numberToText, parseNumber, useFieldChain } from '@/ui/NumberField';
import { colors, space, type } from '@/ui/theme';

type Field = Exclude<keyof BodyEntry, 'date'>;

interface FieldDef {
  key: Field;
  label: string;
  unit: string;
  hint?: string;
  decimal?: boolean;
  /** Valores creíbles: fuera de aquí se avisa en vez de guardar un error de dedo. */
  min: number;
  max: number;
  women?: boolean;
}

const WEIGHT: FieldDef = { key: 'weight', label: 'Peso', unit: 'kg', min: 30, max: 300 };

/** Medidas con cinta: se precargan con la última medición porque cambian poco. */
const TAPE: FieldDef[] = [
  { key: 'waist', label: 'Cintura', unit: 'cm', hint: 'A la altura del ombligo, sin apretar', min: 40, max: 200 },
  { key: 'neck', label: 'Cuello', unit: 'cm', hint: 'Justo debajo de la nuez', min: 20, max: 70 },
  { key: 'hip', label: 'Cadera', unit: 'cm', hint: 'En la parte más ancha', min: 50, max: 200, women: true },
  { key: 'arm', label: 'Brazo', unit: 'cm', hint: 'Bíceps contraído, parte más ancha', min: 15, max: 70 },
  { key: 'chest', label: 'Pecho', unit: 'cm', hint: 'A la altura de los pezones', min: 50, max: 200 },
];

/** Valores de la Huawei Scale 3 tal como aparecen en Huawei Salud. No se precargan: son de cada pesada. */
const SCALE: FieldDef[] = [
  { key: 'bodyFat', label: '% de grasa', unit: '%', min: 3, max: 60 },
  { key: 'skeletalMuscle', label: 'Músculo esquelético', unit: 'kg', min: 15, max: 70 },
  { key: 'fatFreeMass', label: 'Masa libre de grasa', unit: 'kg', min: 30, max: 120 },
  { key: 'water', label: '% de agua', unit: '%', min: 30, max: 75 },
  { key: 'protein', label: '% de proteína', unit: '%', min: 5, max: 30 },
  { key: 'boneMass', label: 'Masa ósea', unit: 'kg', min: 1, max: 6 },
  { key: 'visceralFat', label: 'Grasa visceral', unit: 'nivel', decimal: false, min: 1, max: 30 },
  { key: 'scaleBmr', label: 'Metabolismo basal', unit: 'kcal', decimal: false, min: 800, max: 3500 },
  { key: 'bodyAge', label: 'Edad corporal', unit: 'años', decimal: false, min: 10, max: 99 },
  { key: 'bodyScore', label: 'Puntuación', unit: 'pts', decimal: false, min: 1, max: 100 },
];

/** Mensaje de error de un campo, o `null` si está bien o vacío (los opcionales pueden ir vacíos). */
function problemOf(def: FieldDef, text: string | undefined, required = false): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return required ? `Escribe tu ${def.label.toLowerCase()}.` : null;
  const v = parseNumber(raw);
  if (v === null) return `${def.label}: no es un número.`;
  if (v < def.min || v > def.max) return `${def.label}: debe estar entre ${def.min} y ${def.max} ${def.unit}.`;
  return null;
}

export default function MeasurementScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(dateParam ?? today());
  // Valores leídos de una captura, pendientes de volcar tras cambiar a la fecha de esa medición.
  const imported = useRef<Partial<Record<Field, string>> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex>('H');
  const [f, setF] = useState<Partial<Record<Field, string>>>({});
  const [showScale, setShowScale] = useState(true);
  const [existing, setExisting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const allowLeave = useUnsavedGuard(dirty, 'la medición que estabas apuntando');

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
      if (imported.current) Object.assign(next, imported.current);
      imported.current = null;
      setExisting(!!same);
      setF(next);
    })();
  }, [db, date]);

  const set = (k: Field) => (v: string) => {
    setDirty(true);
    setF((prev) => ({ ...prev, [k]: v }));
  };

  const tape = TAPE.filter((t) => !t.women || sex === 'M');
  const problems = [problemOf(WEIGHT, f.weight, true), ...[...SCALE, ...tape].map((d) => problemOf(d, f[d.key]))].filter(
    (p): p is string => p !== null,
  );
  const valid = problems.length === 0;
  // El teclado salta de un campo al siguiente en el orden en que se ven.
  const chain = useFieldChain<Field>(['weight', ...(showScale ? SCALE.map((s) => s.key) : []), ...tape.map((t) => t.key)]);

  const pasteCapture = async () => {
    const reading = parseScaleText(await Clipboard.getStringAsync(), today());
    if (reading.found.length === 0) {
      Alert.alert(
        'No encuentro datos de la báscula',
        'Abre la captura de Huawei Salud en Google Fotos o Google Lens, pulsa «Copiar texto» (selecciona todo) y vuelve a intentarlo.',
      );
      return;
    }
    const read: Partial<Record<Field, string>> = {};
    for (const k of reading.found) read[k] = numberToText(reading.values[k]);
    const moved = reading.date !== null && reading.date !== date;
    if (moved) {
      // La medición es de otro día: se cambia la fecha y los valores se vuelcan al cargarla.
      imported.current = read;
      setDate(reading.date!);
    } else {
      setF((prev) => ({ ...prev, ...read }));
    }
    setDirty(true);
    setShowScale(true);
    setNotice(
      `Leído: ${reading.found.map((k) => SCALE_FIELD_LABEL[k]).join(', ')}.${
        moved ? ` La fecha ha cambiado al ${formatLong(reading.date!).toLowerCase()}, que es la de la captura.` : ''
      } Revisa los números antes de guardar.`,
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const save = async () => {
    if (!valid) return;
    const entry: BodyEntry = { date, weight: parseNumber(f.weight ?? '')! };
    for (const d of [...TAPE, ...SCALE]) {
      (entry as unknown as Record<string, number | null>)[d.key] = parseNumber(f[d.key] ?? '');
    }
    await saveBodyEntry(db, entry);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    allowLeave();
    router.back();
  };

  const remove = () =>
    Alert.alert('¿Borrar esta medición?', `${formatLong(date)}. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await deleteBodyEntry(db, date);
          allowLeave();
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={type.title}>{formatLong(date)}</Text>
          <Text style={type.caption}>
            {existing ? 'Editando la medición de este día. ' : ''}Por la mañana, en ayunas y después de ir al baño. Usa siempre la misma cinta y el
            mismo sitio.
          </Text>
        </View>

        <Card style={{ gap: space.sm }}>
          <Button label="Pegar datos de la captura" variant="secondary" icon="clipboard-outline" onPress={pasteCapture} />
          <Text style={type.caption}>
            Haz una captura de la medición en Huawei Salud, ábrela en Google Fotos o Lens, pulsa «Copiar texto» y luego este botón.
          </Text>
          {notice && (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 1 }} />
              <Text style={[type.caption, { color: colors.success, flex: 1 }]}>{notice}</Text>
            </View>
          )}
        </Card>

        <Card style={{ gap: space.lg }}>
          <NumberField label={WEIGHT.label} unit={WEIGHT.unit} value={f.weight ?? ''} onChange={set('weight')} placeholder="80,0" {...chain('weight')} />
        </Card>

        <Pressable
          onPress={() => setShowScale((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showScale }}
          accessibilityLabel="Valores de la báscula Huawei, opcionales"
          style={styles.sectionToggle}>
          <Text style={[type.overline, { flex: 1 }]}>Báscula Huawei (opcional)</Text>
          <Ionicons name={showScale ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {showScale && (
          <Card style={{ gap: space.lg }}>
            <Text style={type.caption}>Cópialos de Huawei Salud → Peso → la medición de ese día. Deja vacío lo que no tengas.</Text>
            {SCALE.map((s) => (
              <NumberField key={s.key} label={s.label} unit={s.unit} value={f[s.key] ?? ''} onChange={set(s.key)} decimal={s.decimal ?? true} {...chain(s.key)} />
            ))}
            <Text style={type.caption}>Si apuntas el % de grasa y la masa libre de grasa, se usan en vez de las fórmulas.</Text>
          </Card>
        )}

        <SectionTitle>Medidas con cinta (opcionales)</SectionTitle>
        <Card style={{ gap: space.lg }}>
          {tape.map((t) => (
            <NumberField key={t.key} label={t.label} hint={t.hint} unit={t.unit} value={f[t.key] ?? ''} onChange={set(t.key)} {...chain(t.key)} />
          ))}
        </Card>
        <Text style={type.caption}>Con cintura y cuello se calcula el % de grasa aunque no tengas báscula.</Text>

        {existing && <Button label="Borrar esta medición" variant="ghost" icon="trash-outline" onPress={remove} />}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: space.sm + insets.bottom }]}>
        {problems.length > 0 && (
          <Text style={[type.caption, { color: colors.danger }]} accessibilityLiveRegion="polite">
            {problems[0]}
            {problems.length > 1 ? ` (y ${problems.length - 1} más)` : ''}
          </Text>
        )}
        <Button label="Guardar medición" icon="checkmark-circle" onPress={save} disabled={!valid} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionToggle: { flexDirection: 'row', alignItems: 'center', minHeight: 48, marginTop: space.sm },
  bar: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
