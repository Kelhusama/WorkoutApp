import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getMarchDate, saveMarchDate } from '@/db/settings';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { startMarch, stopMarch } from '@/db/march';
import { DAY_LONG, addDays, formatLong, formatShort, today } from '@/domain/dates';
import { WALK_LABEL, formatDuration, formatPace, pace, recentForm, weeklySeries } from '@/domain/march';
import {
  GOAL_KM,
  KIND_LABEL,
  LAST_STEP,
  MARCH_PLAN,
  entryStep,
  predictedMinutes,
  dateFit,
  readiness,
  stepAt,
  weeklyKm,
  weeksLeft,
  type Readiness,
} from '@/domain/marchPlan';
import { useMarch } from '@/hooks/useMarch';
import { Button, Card, Pill, ProgressBar, SectionTitle, Stepper } from '@/ui/components';
import { LineChart } from '@/ui/LineChart';
import { colors, space, type, font } from '@/ui/theme';

const LIGHT: Record<Readiness, { color: string; title: string; text: string }> = {
  verde: { color: colors.success, title: 'Listo para los 50 km', text: 'Has hecho una tirada de 35 km o más y un fin de semana doble en el último mes.' },
  ambar: { color: colors.warn, title: 'Vas bien, aún falta', text: 'Para estar listo: una tirada de 35 km o más y dos días seguidos sumando 30 km.' },
  rojo: { color: colors.danger, title: 'Todavía no', text: 'Tu tirada más larga del último mes está por debajo de 28 km. Sigue el plan.' },
};

const CHECKLIST: [string, string][] = [
  ['Pies', 'Calzado con más de 100 km de uso. Calcetín técnico y uno de recambio. Vaselina en los puntos de roce. Al primer aviso de rozadura, para y tápalo.'],
  ['Agua y sal', 'Entre 400 y 700 ml por hora según el calor. Sales o electrolitos a partir de la cuarta hora.'],
  ['Comida', '200–300 kcal por hora desde la primera, todo probado antes en las tiradas largas. Ese día no hay déficit calórico.'],
  ['Ritmo', 'Sal más lento de lo que te apetezca. Pausas de 5–10 minutos cada 10 km; evita paradas de más de 15.'],
  ['Mochila', 'Agua, comida, cortavientos, frontal, móvil con batería externa, botiquín de pies, gorra y crema solar.'],
  ['Ojo con', 'Estrenar calzado, comer o beber poco y el bajón entre los km 30 y 40: es normal y se pasa comiendo.'],
];

const km = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: space.md }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.sectionHead}>
        <Text style={[type.subtitle, { flex: 1 }]}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {open && children}
    </Card>
  );
}

/** Fecha de la marcha: opcional y rellenable cuando se sepa. Dice si da tiempo a terminar el plan. */
function MarchDate({ weeksNeeded }: { weeksNeeded: number }) {
  const db = useSQLiteContext();
  const now = today();
  const [date, setDate] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    getMarchDate(db).then(setDate);
  }, [db]);

  const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(now)) / 86_400_000);

  if (draft !== null) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text style={type.subtitle}>{formatLong(draft)}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {([-7, -1, 1, 7] as const).map((n) => (
            <View key={n} style={{ flex: 1 }}>
              <Button label={`${n > 0 ? '+' : '−'}${Math.abs(n) === 7 ? '1 sem' : '1 día'}`} variant="secondary" onPress={() => setDraft(addDays(draft, n))} />
            </View>
          ))}
        </View>
        <Text style={type.caption}>{dateFit(weeksNeeded, daysTo(draft)).text}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Cancelar" variant="secondary" onPress={() => setDraft(null)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Guardar"
              icon="checkmark-circle"
              disabled={daysTo(draft) < 0}
              onPress={async () => {
                await saveMarchDate(db, draft);
                setDate(draft);
                setDraft(null);
              }}
            />
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.sm }}>
      {date ? (
        <>
          <Text style={type.subtitle}>{formatLong(date)}</Text>
          <Text style={type.caption}>{dateFit(weeksNeeded, daysTo(date)).text}</Text>
          <Button label="Cambiar la fecha" variant="secondary" icon="calendar-outline" onPress={() => setDraft(date)} />
          <Button
            label="Quitar la fecha"
            variant="ghost"
            onPress={async () => {
              await saveMarchDate(db, null);
              setDate(null);
            }}
          />
        </>
      ) : (
        <>
          <Text style={type.caption}>
            Opcional. Cuando sepas la sede y el día de la marcha, ponlos aquí y te diré si da tiempo a terminar el plan. Mientras tanto, el plan
            avanza a tu ritmo.
          </Text>
          <Button label="Poner la fecha" variant="secondary" icon="calendar-outline" onPress={() => setDraft(addDays(now, weeksNeeded * 7 + 14))} />
        </>
      )}
    </Card>
  );
}

export default function MarchScreen() {
  const db = useSQLiteContext();
  const { view, reload, dayOf } = useMarch();
  const [comfortable, setComfortable] = useState(5);

  if (!view) return null;
  const { state, walks } = view;
  const now = today();

  const begin = async (n: number) => {
    await startMarch(db, n, now);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reload();
  };

  const history = (
    <>
      {walks.length > 0 && (
        <>
          <SectionTitle>Últimas caminatas</SectionTitle>
          <Card style={{ paddingVertical: space.sm }}>
            {[...walks]
              .reverse()
              .slice(0, 8)
              .map((w, i) => {
                const p = pace(w);
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => router.push({ pathname: '/caminata', params: { id: String(w.id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Caminata del ${formatShort(w.date)}, ${km(w.km)} kilómetros. Editar`}
                    style={[styles.row, i > 0 && styles.divider]}>
                    <Text style={[type.caption, { width: 52 }]}>{formatShort(w.date)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={type.subtitle}>
                        {km(w.km)} km · {WALK_LABEL[w.kind]}
                      </Text>
                      <Text style={type.caption}>
                        {w.minutes > 0 ? formatDuration(w.minutes) : 'Sin tiempo'}
                        {p ? ` · ${formatPace(p)}` : ''}
                        {w.elevation ? ` · +${w.elevation} m` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                  </Pressable>
                );
              })}
          </Card>
        </>
      )}
    </>
  );

  // ---------- Sin plan en marcha ----------
  if (!state) {
    const entry = stepAt(entryStep(comfortable));
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
        <Text style={type.hero}>Marcha de {GOAL_KM} km</Text>
        <Text style={type.body}>
          Un plan de {LAST_STEP} escalones para caminar {GOAL_KM} km en un día. Empiezas cuando quieras y avanzas al completar la tirada larga de
          cada escalón: si una semana no sale, se repite.
        </Text>

        <Card style={{ gap: space.md }}>
          <Text style={type.subtitle}>¿Cuántos kilómetros caminas ya de una vez sin molestias?</Text>
          <Stepper value={comfortable} onChange={(v) => setComfortable(Math.min(40, v))} min={0} suffix=" km" />
          <Text style={type.caption}>
            Empezarías en el escalón {entry.n}: tirada larga de {entry.long} km y dos paseos de {entry.easy} y {entry.hills} km. Quedarían unas{' '}
            {weeksLeft(entry.n)} semanas si todo sale a la primera.
          </Text>
          <Button label="Empezar el plan" icon="walk" onPress={() => begin(entry.n)} />
        </Card>

        <Button label="Registrar una caminata suelta" variant="secondary" icon="add" onPress={() => router.push('/caminata')} />
        {history}
      </ScrollView>
    );
  }

  // ---------- Reto completado ----------
  if (state.completed) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
        <View style={{ alignItems: 'center', gap: space.sm, marginVertical: space.xl }}>
          <Ionicons name="trophy" size={56} color={colors.accent} />
          <Text style={type.hero}>¡{GOAL_KM} km hechos!</Text>
          <Text style={[type.caption, { textAlign: 'center' }]}>Deja 5–7 días sin pierna pesada antes de volver a entrenar fuerte.</Text>
        </View>
        <Button label="Empezar otro ciclo" variant="secondary" icon="refresh" onPress={() => begin(7)} />
        {history}
      </ScrollView>
    );
  }

  // ---------- Plan en marcha ----------
  const s = stepAt(state.step);
  const form = recentForm(walks, now);
  const light = LIGHT[readiness(form.longestKm, form.double)];
  const series = weeklySeries(walks);
  const advance = view.events.find((e) => e.type === 'avance');
  const setback = view.events.find((e) => e.type === 'retroceso');

  const move = (n: number) =>
    Alert.alert(`¿Pasar al escalón ${n}?`, `Tirada larga de ${stepAt(n).long} km. El escalón empieza a contar desde hoy.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cambiar', onPress: () => begin(n) },
    ]);

  const quit = () =>
    Alert.alert('¿Dejar el plan de marcha?', 'Tus caminatas se conservan. Podrás empezar otra vez cuando quieras.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Dejar el plan',
        style: 'destructive',
        onPress: async () => {
          await stopMarch(db);
          reload();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
      {setback && setback.type === 'retroceso' && (
        <Card style={{ borderColor: colors.info }}>
          <Text style={type.caption}>
            Has estado un tiempo sin caminar, así que el plan vuelve del escalón {setback.from} al {setback.to} para retomarlo sin riesgo.
          </Text>
        </Card>
      )}
      {advance && advance.type === 'avance' && (
        <Card style={{ borderColor: colors.success }}>
          <Text style={[type.caption, { color: colors.success }]}>¡Escalón {advance.from} completado!</Text>
        </Card>
      )}

      <Card style={{ gap: space.md }}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={type.caption}>
              Escalón {s.n} de {LAST_STEP}
            </Text>
            <Text style={type.title}>{KIND_LABEL[s.kind]}</Text>
          </View>
          <Pill label={`${weeklyKm(s)} km esta semana`} color={colors.accent} bg={colors.accentSoft} />
        </View>
        <ProgressBar value={(s.n - 1) / (LAST_STEP - 1)} />
        {s.note && <Text style={type.body}>{s.note}</Text>}
        <Text style={type.caption}>
          Avanzas al completar la tirada larga de {s.long} km (vale con {km(Math.ceil(s.long * 9) / 10)}). Quedan unas {weeksLeft(s.n)} semanas si todo
          sale a la primera.
        </Text>
      </Card>

      <SectionTitle>Caminatas de este escalón</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        {view.planned.map((p, i) => {
          const day = dayOf(p.kind);
          return (
            <Pressable
              key={p.kind}
              disabled={!!p.done}
              onPress={() => router.push({ pathname: '/caminata', params: { kind: p.kind, km: String(p.km) } })}
              accessibilityRole="button"
              accessibilityLabel={`${WALK_LABEL[p.kind]}, ${p.km} kilómetros. ${p.done ? 'Hecha' : 'Registrar'}`}
              style={[styles.row, i > 0 && styles.divider]}>
              <Ionicons name={p.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={p.done ? colors.success : colors.faint} />
              <View style={{ flex: 1 }}>
                <Text style={type.subtitle}>
                  {WALK_LABEL[p.kind]} · {p.km} km
                </Text>
                <Text style={type.caption}>
                  {p.done ? `Hecha el ${formatShort(p.done.date)}: ${km(p.done.km)} km` : day !== null ? `Sugerido: ${DAY_LONG[day].toLowerCase()}` : ''}
                </Text>
              </View>
              {!p.done && <Ionicons name="add-circle-outline" size={22} color={colors.accent} />}
            </Pressable>
          );
        })}
      </Card>
      <Button label="Registrar caminata" icon="walk" onPress={() => router.push('/caminata')} />

      <SectionTitle>Fecha de la marcha</SectionTitle>
      <MarchDate weeksNeeded={weeksLeft(s.n)} />

      <SectionTitle>¿Listo para los {GOAL_KM} km?</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <View style={styles.rowTop}>
          <View style={[styles.light, { backgroundColor: light.color }]} />
          <Text style={[type.subtitle, { flex: 1 }]}>{light.title}</Text>
        </View>
        <Text style={type.caption}>{light.text}</Text>
        <Text style={type.caption}>
          Tirada más larga del último mes: <Text style={styles.strong}>{km(form.longestKm)} km</Text>
          {form.longestPace ? ` a ${formatPace(form.longestPace)}` : ''}.
        </Text>
        {form.longestPace && form.longestKm >= 15 && (
          <Text style={type.caption}>
            Tiempo previsto para {GOAL_KM} km: <Text style={styles.strong}>{formatDuration(predictedMinutes(GOAL_KM, form.longestPace))}</Text>, con una
            hora de paradas y sin contar desnivel.
          </Text>
        )}
      </Card>

      {series.total.length >= 2 && (
        <>
          <SectionTitle>Evolución</SectionTitle>
          <Card style={{ gap: space.sm }}>
            <Text style={type.subtitle}>Kilómetros por semana</Text>
            <LineChart points={series.total} height={150} format={(v) => String(Math.round(v))} />
          </Card>
          <Card style={{ gap: space.sm }}>
            <Text style={type.subtitle}>Caminata más larga de cada semana</Text>
            <LineChart points={series.longest} height={150} format={(v) => String(Math.round(v))} />
            <Text style={type.caption}>
              Objetivo: {GOAL_KM} km. La más larga antes del reto será de {Math.max(...MARCH_PLAN.slice(0, -1).map((x) => x.long))} km.
            </Text>
          </Card>
        </>
      )}

      {history}

      <SectionTitle>El plan</SectionTitle>
      <Section title={`Los ${LAST_STEP} escalones`}>
        {MARCH_PLAN.map((x) => (
          <View key={x.n} style={[styles.planRow, x.n === s.n && { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.planN, x.n < s.n && { color: colors.success }]}>{x.n < s.n ? '✓' : x.n}</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>
                Larga de {x.long} km{x.extra ? ` + ${x.extra} km la víspera` : ''}
              </Text>
              <Text style={type.caption}>
                {KIND_LABEL[x.kind]} · paseos de {x.easy} y {x.hills} km · {weeklyKm(x)} km en total
              </Text>
            </View>
          </View>
        ))}
      </Section>
      <Section title="El día de la marcha">
        {CHECKLIST.map(([title, text]) => (
          <View key={title} style={{ gap: 2 }}>
            <Text style={type.subtitle}>{title}</Text>
            <Text style={type.caption}>{text}</Text>
          </View>
        ))}
      </Section>
      <Section title="Ajustar el plan">
        <Text style={type.caption}>Si el escalón te queda corto o largo, puedes cambiarlo a mano.</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Escalón anterior" variant="secondary" onPress={() => move(s.n - 1)} disabled={s.n <= 1} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Escalón siguiente" variant="secondary" onPress={() => move(s.n + 1)} disabled={s.n >= LAST_STEP} />
          </View>
        </View>
        <Button label="Dejar el plan" variant="ghost" icon="close-circle-outline" onPress={quit} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  light: { width: 14, height: 14, borderRadius: 7 },
  strong: { color: colors.text, ...font.w700 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: 8 },
  planN: { width: 24, textAlign: 'center', fontSize: 15, ...font.w800, color: colors.muted },
});
