import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { deleteTrip, getTrips, saveTrip } from '@/db/repo';
import { addDays, formatLong, fromISODate, today, type ISODate } from '@/domain/dates';
import { SESSION_INFO, type SessionKind } from '@/domain/schedule';
import { exerciseFor } from '@/domain/templates';
import { NO_GEAR, travelSlots, type TravelGear } from '@/domain/travel';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, SectionTitle, ToggleRow } from '@/ui/components';
import { colors, radius, space, type } from '@/ui/theme';

function DateStepper({ label, value, onChange }: { label: string; value: ISODate; onChange: (d: ISODate) => void }) {
  return (
    <View style={styles.dateRow}>
      <View style={{ flex: 1 }}>
        <Text style={type.caption}>{label}</Text>
        <Text style={type.subtitle}>{formatLong(value)}</Text>
      </View>
      <Pressable accessibilityLabel={`${label}: un día antes`} onPress={() => onChange(addDays(value, -1))} style={styles.stepBtn} hitSlop={6}>
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <Pressable accessibilityLabel={`${label}: un día después`} onPress={() => onChange(addDays(value, 1))} style={styles.stepBtn} hitSlop={6}>
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const KINDS: SessionKind[] = ['A', 'B', 'C'];

export default function TripScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const id = params.id ? Number(params.id) : undefined;
  const [from, setFrom] = useState<ISODate>(params.date ?? today());
  const [to, setTo] = useState<ISODate>(params.date ?? today());
  const [gear, setGear] = useState<TravelGear>(NO_GEAR);

  useEffect(() => {
    if (id === undefined) return;
    getTrips(db).then((trips) => {
      const t = trips.find((x) => x.id === id);
      if (!t) return;
      setFrom(t.from);
      setTo(t.to);
      setGear(t.gear);
    });
  }, [db, id]);

  const changeFrom = (d: ISODate) => {
    setFrom(d);
    if (d > to) setTo(d);
  };
  const changeTo = (d: ISODate) => {
    setTo(d);
    if (d < from) setFrom(d);
  };
  const days = Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000) + 1;

  const save = async () => {
    await saveTrip(db, { id, from, to, gear });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    router.back();
  };

  const remove = () =>
    Alert.alert('¿Eliminar el viaje?', 'Esos días vuelven a tu plan normal.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (id !== undefined) await deleteTrip(db, id);
          syncReminders(db);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Stack.Screen options={{ title: id === undefined ? 'Nuevo viaje' : 'Viaje' }} />

      <Card style={{ gap: space.lg }}>
        <DateStepper label="Desde" value={from} onChange={changeFrom} />
        <DateStepper label="Hasta" value={to} onChange={changeTo} />
        <Text style={type.caption}>
          {days} {days === 1 ? 'día' : 'días'}. Si no entrenas un día de viaje, no cuenta como fallo ni rompe la racha.
        </Text>
      </Card>

      <SectionTitle>¿Qué tendrás a mano?</SectionTitle>
      <Card style={{ gap: space.lg }}>
        <ToggleRow
          icon="bag-handle-outline"
          title="Mochila con peso"
          detail="Con libros o botellas: sustituye a la mancuerna"
          value={gear.mochila}
          onChange={(v) => setGear({ ...gear, mochila: v })}
        />
        <ToggleRow
          icon="tablet-landscape-outline"
          title="Mesa robusta"
          detail="Para remo invertido: sustituye a la barra"
          value={gear.mesa}
          onChange={(v) => setGear({ ...gear, mesa: v })}
        />
        <ToggleRow
          icon="barbell-outline"
          title="Gimnasio en el hotel"
          detail="Mantiene tus días de gimnasio; si no, pasan a sesión en casa"
          value={gear.gimnasio}
          onChange={(v) => setGear({ ...gear, gimnasio: v })}
        />
        <Text style={type.caption}>Sin nada marcado solo necesitas tu cuerpo, una toalla y una puerta.</Text>
      </Card>

      <SectionTitle>Así quedan tus sesiones</SectionTitle>
      <Card style={{ gap: space.md }}>
        {KINDS.map((k) => (
          <View key={k} style={{ gap: 2 }}>
            <Text style={type.subtitle}>{SESSION_INFO[k].title}</Text>
            <Text style={type.caption}>
              {travelSlots(k, gear)
                .map((s) => exerciseFor(s).name)
                .join(' · ')}
            </Text>
          </View>
        ))}
      </Card>

      <Button label="Guardar viaje" icon="airplane" onPress={save} />
      {id !== undefined && <Button label="Eliminar viaje" variant="ghost" icon="trash-outline" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
