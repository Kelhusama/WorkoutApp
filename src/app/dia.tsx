import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { deleteLog, getOverrideKinds, getTemplate, loadDays, setOverride, type PlannedDay } from '@/db/repo';
import { addDays, formatLong, today, weekStart, weekdayIndex } from '@/domain/dates';
import { ROLE_INFO, SESSION_INFO, roleOf, type Role, type SessionKind } from '@/domain/schedule';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card, SectionTitle, Segmented } from '@/ui/components';
import { RolePicker } from '@/ui/RolePicker';
import { colors, space, type } from '@/ui/theme';
import { DayRow } from '@/ui/week';

const KIND_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'A', label: 'Tirón' },
  { id: 'B', label: 'Empuje' },
  { id: 'C', label: 'Mixta' },
] as const;

/** Cambia lo que se hace un día concreto, solo esa semana. */
export default function DayScreen() {
  const db = useSQLiteContext();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? today();
  const [day, setDay] = useState<PlannedDay | null>(null);
  const [week, setWeek] = useState<PlannedDay[]>([]);
  const [templateRole, setTemplateRole] = useState<Role>('rest');
  const [role, setRole] = useState<Role>('rest');
  // Qué sesión de casa: la que reparta la app, o una elegida a mano.
  const [kind, setKind] = useState<'auto' | SessionKind>('auto');
  const [savedKind, setSavedKind] = useState<'auto' | SessionKind>('auto');

  useEffect(() => {
    (async () => {
      const monday = weekStart(date);
      const { days } = await loadDays(db, monday, addDays(monday, 6));
      const d = days.find((x) => x.date === date)!;
      setDay(d);
      setWeek(days);
      setRole(roleOf(d.type));
      setTemplateRole((await getTemplate(db))[weekdayIndex(date)]);
      const chosen = (await getOverrideKinds(db, date, date)).get(date) ?? 'auto';
      setKind(chosen);
      setSavedKind(chosen);
    })();
  }, [db, date]);

  if (!day) return null;

  if (day.log) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Text style={type.overline}>{formatLong(date)}</Text>
        <Card>
          <Text style={type.body}>
            Este día ya está registrado como {SESSION_INFO[day.type].title.toLowerCase()}. Para cambiar lo que se hace, primero hay que borrar ese
            registro.
          </Text>
        </Card>
        <Button
          label="Borrar el registro de este día"
          variant="secondary"
          icon="trash-outline"
          onPress={() =>
            Alert.alert('¿Borrar el registro?', 'Se pierden las series apuntadas ese día. No se puede deshacer.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Borrar',
                style: 'destructive',
                onPress: async () => {
                  if (day.type !== 'rest' && day.type !== 'movilidad') await deleteLog(db, date, day.type);
                  syncReminders(db);
                  router.back();
                },
              },
            ])
          }
        />
      </ScrollView>
    );
  }

  const apply = async (r: Role | null) => {
    const chosen = r === 'casa' && kind !== 'auto' ? kind : null;
    // Si queda como en la semana tipo y sin sesión elegida, no hace falta guardar ningún cambio.
    await setOverride(db, date, r === null || (r === templateRole && !chosen) ? null : r, chosen);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    router.back();
  };

  const changed = role !== roleOf(day.type) || (role === 'casa' && kind !== savedKind);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Text style={type.overline}>{formatLong(date)}</Text>
      <Text style={type.caption}>
        Solo cambia este día. Las sesiones de casa de la semana se reparten de nuevo para respetar el descanso tras el gimnasio.
      </Text>

      <RolePicker value={role} onChange={setRole} />

      {role === 'casa' && (
        <Card style={{ gap: space.sm }}>
          <Text style={type.subtitle}>¿Qué sesión de casa?</Text>
          <Segmented label="Sesión de casa" options={KIND_OPTIONS} value={kind} onChange={setKind} />
          <Text style={type.caption}>
            {kind === 'auto'
              ? 'La app elige la que toque para repartir bien la semana y respetar el descanso tras el gimnasio.'
              : `${SESSION_INFO[kind].title}: ${SESSION_INFO[kind].subtitle.toLowerCase()}.`}
          </Text>
        </Card>
      )}

      <Card style={{ gap: space.sm }}>
        <Text style={type.caption}>En tu semana tipo, este día es: {ROLE_INFO[templateRole].label.toLowerCase()}.</Text>
        {day.overridden && <Text style={[type.caption, { color: colors.info }]}>Ya lo habías cambiado.</Text>}
      </Card>

      <Button label={changed ? `Cambiar a ${ROLE_INFO[role].label.toLowerCase()}` : 'Sin cambios'} icon="swap-horizontal" onPress={() => apply(role)} disabled={!changed} />
      {day.overridden && <Button label="Volver a la semana tipo" variant="secondary" icon="refresh" onPress={() => apply(null)} />}

      <Card style={{ gap: space.sm }}>
        <Text style={type.subtitle}>¿Vas a hacer otra cosa?</Text>
        <Text style={type.caption}>
          Dominadas, una caminata, otro deporte… No hace falta cambiar el día: apúntalo y el día cuenta como hecho igual.
        </Text>
        {date <= today() ? (
          <>
            <Button label="Hacer dominadas (sesión guiada)" variant="secondary" icon="trophy" onPress={() => router.replace('/dominadas')} />
            <Button label="Apuntar otra cosa" variant="secondary" icon="add-circle-outline" onPress={() => router.replace({ pathname: '/apuntar', params: { date } })} />
          </>
        ) : (
          <Text style={type.caption}>Cuando llegue ese día podrás apuntarlo desde Hoy o desde el calendario.</Text>
        )}
      </Card>

      <SectionTitle>Esta semana ahora</SectionTitle>
      <View style={{ gap: space.sm }}>
        {week.map((d) => (
          <DayRow key={d.date} day={d} />
        ))}
      </View>
    </ScrollView>
  );
}
