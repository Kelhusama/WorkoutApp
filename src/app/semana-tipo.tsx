import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getTemplate, saveTemplate } from '@/db/repo';
import { DAY_LONG } from '@/domain/dates';
import {
  MAX_GYM_DAYS,
  MIN_GYM_DAYS,
  SESSION_INFO,
  assignKinds,
  countGym,
  isValidTemplate,
  type Role,
} from '@/domain/schedule';
import { syncReminders } from '@/notifications/reminders';
import { Button, Card } from '@/ui/components';
import { RolePicker } from '@/ui/RolePicker';
import { colors, space, type } from '@/ui/theme';

export default function WeekTemplateScreen() {
  const db = useSQLiteContext();
  const [roles, setRoles] = useState<Role[] | null>(null);

  useEffect(() => {
    getTemplate(db).then((t) => setRoles([...t]));
  }, [db]);

  if (!roles) return null;

  const kinds = assignKinds(roles, roles[6]);
  const gym = countGym(roles);
  const casa = roles.filter((r) => r === 'casa').length;
  const valid = isValidTemplate(roles);

  const save = async () => {
    await saveTemplate(db, roles);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    syncReminders(db);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      <Text style={type.caption}>
        Elige qué haces cada día. Las sesiones de casa (tirón, empuje, mixta) se reparten solas, sin poner tirón el día después
        del gimnasio. Se aplica desde esta semana; los días que ya cambiaste a mano se respetan.
      </Text>

      <Card style={{ gap: space.md }}>
        {roles.map((r, i) => (
          <View key={i} style={styles.row}>
            <View style={{ width: 92 }}>
              <Text style={type.subtitle}>{DAY_LONG[i]}</Text>
              <Text style={[type.caption, { color: kinds[i] === 'rest' ? colors.faint : colors.accent }]} numberOfLines={1}>
                {SESSION_INFO[kinds[i]].title}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <RolePicker compact value={r} onChange={(nr) => setRoles(roles.map((x, j) => (j === i ? nr : x)))} />
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 4 }}>
        <Text style={type.body}>
          {gym} {gym === 1 ? 'día' : 'días'} de gimnasio · {casa} en casa · {7 - gym - casa} de descanso
        </Text>
        {!valid && (
          <Text style={[type.caption, { color: colors.danger }]}>
            Elige entre {MIN_GYM_DAYS} y {MAX_GYM_DAYS} días de gimnasio.
          </Text>
        )}
        {valid && casa > 4 && (
          <Text style={[type.caption, { color: colors.muted }]}>Con tantos días en casa se repiten sesiones: deja al menos un día de descanso.</Text>
        )}
        {valid && gym + casa === 7 && (
          <Text style={[type.caption, { color: colors.danger }]}>Sin días de descanso: el músculo crece cuando descansa.</Text>
        )}
      </Card>

      <Button label="Guardar semana tipo" icon="checkmark-circle" onPress={save} disabled={!valid} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
