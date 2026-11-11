import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { addTest } from '@/db/repo';
import { today } from '@/domain/dates';
import { GOALS } from '@/domain/strength';
import { Button, Card, Stepper } from '@/ui/components';
import { space, type } from '@/ui/theme';

const TIPS = {
  dominadas: 'Calienta con 2 series suaves. Luego, una sola serie al máximo con técnica estricta: desde brazos estirados hasta barbilla sobre la barra.',
  flexiones: 'Calienta y haz una sola serie al máximo. Solo cuentan las estrictas: cuerpo recto y pecho casi al suelo.',
} as const;

export default function TestScreen() {
  const db = useSQLiteContext();
  const { test: param } = useLocalSearchParams<{ test?: string }>();
  const test = param === 'flexiones' ? 'flexiones' : 'dominadas';
  const goal = GOALS.find((g) => g.id === test)!;
  const [value, setValue] = useState(goal.start);

  const save = async () => {
    await addTest(db, today(), test, value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      <Stack.Screen options={{ title: `Test: ${goal.title.toLowerCase()}` }} />
      <Card>
        <Text style={type.caption}>{TIPS[test]}</Text>
      </Card>
      <Text style={type.subtitle}>¿Cuántas has hecho seguidas?</Text>
      <Stepper value={value} onChange={setValue} min={0} suffix=" reps" />
      <Button label="Guardar test" icon="checkmark-circle" onPress={save} />
    </ScrollView>
  );
}
