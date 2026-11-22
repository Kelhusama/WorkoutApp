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
import { LEG_KEYS } from '@/domain/templates';
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
      <Pressable accessibilityLabel={`${label}: un día antes`} onPress={() => onChange(addDays(value, -1))} style={styles.stepBtn}>
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <Pressable accessibilityLabel={`${label}: un día después`} onPress={() => onChange(addDays(value, 1))} style={styles.stepBtn}>
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

  const doSave = async () => {
    await saveTrip(db, { id, from, to, gear });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    router.back();
  };

  const save = async () => {
    // Guardar sustituye a los viajes que se solapen: mejor avisar antes de borrarlos.
    const clash = (await getTrips(db, from, to)).filter((t) => t.id !== id);
    if (clash.length === 0) return doSave();
    Alert.alert(
      'Ya hay un viaje en esas fechas',
      `Del ${formatLong(clash[0].from).toLowerCase()} al ${formatLong(clash[0].to).toLowerCase()}. Si guardas, este lo sustituye.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sustituir', style: 'destructive', onPress: doSave },
      ],
    );
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
          icon="fitness-outline"
          title="Hay una mancuerna"
          detail="Añade remo y curl a la sesión"
          value={gear.mancuerna}
          onChange={(v) => setGear({ ...gear, mancuerna: v })}
        />
        <ToggleRow
          icon="barbell-outline"
          title="Gimnasio en el hotel"
          detail="Mantiene tus días de gimnasio y las dominadas del plan"
          value={gear.gimnasio}
          onChange={(v) => setGear({ ...gear, gimnasio: v })}
        />
        <Text style={type.caption}>Sin nada marcado solo necesitas tu cuerpo. La sesión de viaje es corta y ligera: flexiones y abdomen. Las dominadas se retoman a la vuelta.</Text>
      </Card>

      <SectionTitle>Así queda tu sesión de viaje</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Text style={type.body}>
          {travelSlots('A', gear)
            .filter((s) => !LEG_KEYS.A.includes(s.key))
            .map((s) => exerciseFor(s).name)
            .join(' · ')}
        </Text>
        <Text style={type.caption}>
          Siempre la misma, unos 10–15 minutos. Empieza en modo ligero; si un día vas sobrado, pásala a normal y añade dos ejercicios de pierna.
        </Text>
      </Card>

      <Button label="Guardar viaje" icon="airplane" onPress={save} />
      {id !== undefined && <Button label="Eliminar viaje" variant="ghost" icon="trash-outline" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.cardHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
