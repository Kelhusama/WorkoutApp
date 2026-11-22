/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays } from './dates';
import {
  EVENT_DATE,
  LIFT_INFO,
  buildPlan,
  currentLevel,
  doneThisWeek,
  doseText,
  estimate3RM,
  prescription,
  todayPlan,
  weeksLeftOn,
  type TrialLog,
} from './event';

const log = (date: string, lift: TrialLog['lift'], weight: number, reps: number, reserve: TrialLog['reserve'] = 1, sets = 3): TrialLog => ({ date, lift, weight, reps, sets, reserve });

test('el plan cubre las ocho semanas anteriores a la prueba, sin huecos', () => {
  const plan = buildPlan();
  assert.equal(plan.length, 8);
  assert.deepEqual([plan[0].from, plan[0].to], ['2026-11-21', '2026-11-27']);
  assert.deepEqual([plan[7].from, plan[7].to], ['2027-01-09', '2027-01-15']);
  for (let i = 1; i < plan.length; i++) assert.equal(plan[i].from, addDays(plan[i - 1].to, 1));
  assert.deepEqual(plan.map((w) => w.phase), ['base', 'base', 'base', 'fuerza', 'fuerza', 'fuerza', 'pico', 'descarga']);
  // El peso muerto sube poco a poco hasta rozar el objetivo; las dominadas pasan de sueltas a triples con lastre.
  assert.deepEqual(plan.slice(0, 7).map((w) => w.doses.peso_muerto.weight), [80, 85, 87.5, 90, 92.5, 95, 97.5]);
  assert.deepEqual(plan.map((w) => w.doses.dominada.reps), [1, 2, 2, 2, 3, 3, 3, 2]);
  assert.deepEqual(plan.map((w) => w.doses.dominada.weight), [0, 0, 0, 2, 2, 4, 6, 4]);
  // La descarga pide menos que la semana anterior.
  assert.ok(plan[7].doses.dominada.days * plan[7].doses.dominada.sets < plan[6].doses.dominada.days * plan[6].doses.dominada.sets);
});

test('qué semana toca según la fecha', () => {
  assert.equal(weeksLeftOn('2026-11-21'), 8);
  assert.equal(weeksLeftOn('2027-01-15'), 1);
  // El 20 de noviembre faltan 57 días: se empieza ya con la primera semana.
  const now = todayPlan('2026-11-20');
  assert.deepEqual([now.daysLeft, now.week!.weeksLeft, now.phase], [57, 8, 'base']);
  assert.equal(todayPlan('2026-12-15').week!.weeksLeft, 5);
  assert.equal(todayPlan('2027-01-10').phase, 'descarga');
  assert.deepEqual([todayPlan(EVENT_DATE).phase, todayPlan(EVENT_DATE).week], ['dia', null]);
  assert.equal(todayPlan('2027-01-20').phase, 'pasado');
});

test('lo que toca hoy: el plan, corregido por lo último apuntado', () => {
  const plan = buildPlan();
  const [w8, , , w5, , w3, , w1] = plan;
  // Sin nada apuntado, el plan tal cual.
  assert.deepEqual(prescription('dominada', w8, []), w8.doses.dominada);
  // En las semanas sin lastre no se añade aunque sobre.
  assert.equal(prescription('dominada', w8, [log('2026-11-22', 'dominada', 0, 1, 2)]).weight, 0);
  // Semana de 4 kg, pero lo último fueron 2 kg limpios: hoy 4. Si fue justo, se repiten los 2.
  assert.equal(prescription('dominada', w3, [log('2026-12-20', 'dominada', 2, 3, 1)]).weight, 4);
  const stuck = prescription('dominada', w3, [log('2026-12-20', 'dominada', 2, 3, 0)]);
  assert.equal(stuck.weight, 2);
  assert.match(stuck.note, /repite 2 kg/);
  // Nunca se salta: de sin lastre a 2 kg como mucho, aunque el plan diga 4.
  assert.equal(prescription('dominada', w3, [log('2026-12-20', 'dominada', 0, 3, 2)]).weight, 2);
  assert.equal(prescription('dominada', w5, [log('2026-12-10', 'dominada', 0, 2, 0)]).weight, 0);
  // Si va por delante, sigue desde lo que ya ha hecho.
  assert.equal(prescription('dominada', w3, [log('2026-12-20', 'dominada', 6, 3, 1)]).weight, 8);
  // Peso muerto: si la última vez fue al límite con menos peso, se repite.
  assert.equal(prescription('peso_muerto', w5, [log('2026-12-08', 'peso_muerto', 87.5, 3, 0)]).weight, 87.5);
  assert.equal(prescription('peso_muerto', w5, [log('2026-12-08', 'peso_muerto', 87.5, 3, 1)]).weight, 90);
  // En la descarga manda el plan, pase lo que pase.
  assert.deepEqual(prescription('dominada', w1, [log('2027-01-05', 'dominada', 10, 3, 2)]), w1.doses.dominada);
});

test('dónde está hoy cada ejercicio, expresado como en la prueba', () => {
  // Punto de partida: 80 kg × 8 equivalen a unos 92 kg × 3; el punto de partida en dominadas son cuatro sin lastre.
  assert.equal(estimate3RM(80, 8), 92);
  assert.equal(currentLevel('peso_muerto', [], '2026-11-20'), 92);
  // Cuatro dominadas sin lastre con 80 kg de peso equivalen a unos 2,5 kg de lastre a tres.
  assert.equal(currentLevel('dominada', [], '2026-11-20'), 2.5);
  // Cinco dominadas sin lastre con 80 kg de peso equivalen a unos 5 kg de lastre a tres.
  assert.equal(currentLevel('dominada', [log('2026-12-10', 'dominada', 0, 5)], '2026-12-12', 80), 5);
  // Pesar menos ayuda: la misma serie con 76 kg da menos lastre equivalente, pero cada kilo perdido es uno menos que subir.
  assert.equal(currentLevel('dominada', [log('2026-12-10', 'dominada', 4, 3)], '2026-12-12', 76), 4);
  // Solo cuentan las últimas tres semanas; si no hay nada reciente, se vuelve al punto de partida.
  assert.equal(currentLevel('peso_muerto', [log('2026-11-25', 'peso_muerto', 95, 3)], '2026-12-30'), 92);
  assert.equal(currentLevel('peso_muerto', [log('2026-12-20', 'peso_muerto', 95, 3), log('2026-12-27', 'peso_muerto', 90, 3)], '2026-12-30'), 95);
});

test('sesiones de la semana y texto de la dosis', () => {
  const w8 = buildPlan()[0];
  const logs = [log('2026-11-21', 'dominada', 0, 1), log('2026-11-21', 'dominada', 0, 1), log('2026-11-23', 'dominada', 0, 1), log('2026-11-28', 'dominada', 0, 2), log('2026-11-24', 'peso_muerto', 80, 5)];
  assert.equal(doneThisWeek('dominada', w8, logs), 2);
  assert.equal(doneThisWeek('peso_muerto', w8, logs), 1);
  assert.equal(doseText('dominada', w8.doses.dominada), '6 series de 1 repetición, sin lastre');
  assert.equal(doseText('dominada', buildPlan()[5].doses.dominada), '4 series de 3 repeticiones, con 4 kg de lastre');
  assert.equal(doseText('peso_muerto', buildPlan()[4].doses.peso_muerto), '3 series de 3 repeticiones con 92,5 kg');
  assert.match(LIFT_INFO.dominada.rules, /hasta abajo/);
});

test('días de dominadas: entre semana, con descanso para los codos', async () => {
  const { isPullupDay, pullupDaysText, isElbowCareDay } = await import('./event');
  const plan = buildPlan();
  assert.equal(pullupDaysText(plan[0]), 'lunes, martes, jueves y viernes');
  assert.equal(pullupDaysText(plan[4]), 'lunes, miércoles y viernes');
  assert.equal(pullupDaysText(plan[7]), 'lunes y miércoles');
  // Primera semana (21–27 nov): lunes 23, martes 24, jueves 26 y viernes 27.
  const first = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];
  assert.deepEqual(first.filter((d) => isPullupDay(d)), ['2026-11-23', '2026-11-24', '2026-11-26', '2026-11-27']);
  // Última semana: lunes 11 y miércoles 13; el 14 y el 15, descanso. El día de la prueba no hay plan.
  assert.deepEqual(['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15', '2027-01-16'].map((d) => isPullupDay(d)), [true, false, true, false, false, false]);
  // Cuidado de codos dos días por semana.
  assert.deepEqual(first.filter((d) => isElbowCareDay(d)), ['2026-11-24', '2026-11-27']);
  assert.deepEqual(['2026-12-21', '2026-12-23', '2026-12-25'].filter((d) => isElbowCareDay(d)), ['2026-12-23', '2026-12-25']);
});

test('avisos de dominadas: varios al día hasta que se apuntan', async () => {
  const { planTrialReminders } = await import('./event');
  const times = ['12:00', '09:00', '10:00'];
  const now = new Date(2026, 10, 23, 9, 30); // lunes 23 a las 9:30
  const all = planTrialReminders([], times, now, '2026-11-23', 5);
  // Hoy quedan los de las 10 y las 12; martes, jueves y viernes, los tres.
  assert.equal(all.length, 2 + 3 + 3 + 3);
  assert.deepEqual(all.slice(0, 2).map((r) => [r.id, r.at.getHours()]), [['rem-dom-2026-11-23-1', 10], ['rem-dom-2026-11-23-2', 12]]);
  assert.match(all[0].title, /^Dominadas · 6 series de 1 repetición, sin lastre$/);
  assert.match(all[1].body, /Último aviso/);
  // Al apuntar las de hoy, los avisos de hoy desaparecen.
  const after = planTrialReminders([log('2026-11-23', 'dominada', 0, 1)], times, now, '2026-11-23', 5);
  assert.equal(after.length, 9);
  assert.ok(after.every((r) => !r.id.includes('2026-11-23')));
  // Sin horas no hay avisos.
  assert.deepEqual(planTrialReminders([], [], now, '2026-11-23', 5), []);
});

test('con el plan activo, las sesiones de casa no repiten las dominadas', async () => {
  const { withoutTrialWork } = await import('./event');
  const { TEMPLATES, focusSlots } = await import('./templates');
  const keys = (s: { key: string }[]) => s.map((x) => x.key);
  const a = withoutTrialWork(TEMPLATES.A, true, '2026-11-24');
  assert.ok(!keys(a).some((k) => k.includes('dominadas') || k.includes('negativas')));
  assert.ok(keys(a).includes('A.curl') && keys(a).includes('A.remo'));
  assert.deepEqual(keys(withoutTrialWork(focusSlots(), true, '2026-11-24')), ['B.flexiones', 'A.curl', 'B.inclinadas']);
  // La sesión enfocada pensada para el plan: tres flexiones y tres con mancuerna, sin dominadas.
  assert.deepEqual(keys(focusSlots(true)), ['B.flexiones', 'B.inclinadas', 'B.pica', 'A.curl', 'C.martillo', 'C.press']);
  assert.deepEqual(withoutTrialWork(focusSlots(true), true, '2026-11-24'), focusSlots(true));
  // La sesión de empuje no cambia; sin el plan activo o pasada la prueba, tampoco cambia nada.
  assert.deepEqual(withoutTrialWork(TEMPLATES.B, true, '2026-11-24'), TEMPLATES.B);
  assert.deepEqual(withoutTrialWork(TEMPLATES.A, false, '2026-11-24'), TEMPLATES.A);
  assert.deepEqual(withoutTrialWork(TEMPLATES.A, true, '2027-01-20'), TEMPLATES.A);
});

test('agarres: el de la prueba se repite más y los otros reparten', async () => {
  const { gripFor, gripsText, TEST_GRIP } = await import('./event');
  assert.equal(TEST_GRIP, 'prono');
  const plan = buildPlan();
  assert.equal(gripsText(plan[0]), 'lunes prono, martes prono y supino, jueves prono y neutro y viernes prono');
  assert.deepEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'].map((d) => gripFor(d)), ['prono', 'supino', null, 'neutro', 'prono']);
  // Con tres días, el del medio alterna entre semanas.
  assert.equal(gripsText(plan[3]), 'lunes prono, miércoles prono y neutro y viernes prono');
  assert.equal(gripsText(plan[4]), 'lunes prono, miércoles prono y supino y viernes prono');
  // En la descarga, solo el de la prueba.
  assert.equal(gripsText(plan[7]), 'lunes prono y miércoles prono');
});

test('fecha y objetivos se pueden cambiar: el plan, los días y el nombre se mueven con ellos', async () => {
  const { eventConfig, setEventConfig, eventName, targetOf, buildPlan: build, todayPlan: at, isPullupDay } = await import('./event');
  const before = { date: eventConfig.date, targets: { ...eventConfig.targets } };
  try {
    setEventConfig({ date: '2027-02-06', targets: { peso_muerto: 110, dominada: 8 } });
    assert.equal(eventName(), 'Prueba del 6 de febrero');
    assert.deepEqual([targetOf('peso_muerto'), targetOf('dominada')], [110, 8]);
    const plan = build();
    assert.deepEqual([plan[0].from, plan[7].to], ['2026-12-12', '2027-02-05']);
    // Los kilos de peso muerto se escalan con el objetivo, redondeados a 2,5.
    assert.deepEqual(plan.slice(0, 7).map((w) => w.doses.peso_muerto.weight), [87.5, 92.5, 97.5, 100, 102.5, 105, 107.5]);
    assert.equal(at('2027-01-16').phase, 'fuerza');
    assert.equal(isPullupDay('2027-02-01'), true); // lunes de la semana de descarga
  } finally {
    setEventConfig(before);
  }
  assert.equal(eventName(), 'Prueba del 16 de enero');
});

test('colgarse: máximo sin marca o el último día de la semana; el resto, a tres cuartos', async () => {
  const { hangBest, hangDose } = await import('./event');
  const h = (date: string, seconds: number) => ({ date, seconds });
  // Sin marca: intento al máximo.
  assert.equal(hangDose([], '2026-11-23').max, true);
  const logs = [h('2026-11-23', 40), h('2026-11-24', 30)];
  assert.equal(hangBest(logs, '2026-11-26'), 40);
  // Jueves: dos series al 75 % de 40 s = 30 s.
  const thu = hangDose(logs, '2026-11-26');
  assert.deepEqual([thu.max, thu.sets, thu.seconds], [false, 2, 30]);
  // Viernes, último día de dominadas de la semana: al máximo.
  assert.equal(hangDose(logs, '2026-11-27').max, true);
  // En la descarga no se busca el máximo ni el último día.
  assert.equal(hangDose([h('2027-01-05', 60)], '2027-01-13').max, false);
  // Una marca de hace más de cuatro semanas ya no cuenta.
  assert.equal(hangBest(logs, '2027-01-05'), null);
});

test('antes de que empiece el plan no tocan dominadas', async () => {
  const { isPullupDay } = await import('./event');
  // El viernes 20 de noviembre es la víspera de la primera semana (21–27).
  assert.equal(isPullupDay('2026-11-20'), false);
  assert.equal(isPullupDay('2026-11-23'), true);
});

test('el plan se ajusta a los discos que hay para el cinturón', async () => {
  const { loadsWith, fitToPlates, repsInsteadOf, platesWarning, setEventConfig, eventConfig, prescription: rx } = await import('./event');
  assert.deepEqual(loadsWith([]), [0]);
  assert.deepEqual(loadsWith([1.25, 1.25, 2.5]), [0, 1.25, 2.5, 3.75, 5]);
  const plan = buildPlan();
  const w3 = plan[5]; // pide 4 kg
  const before = eventConfig.plates;
  try {
    // Sin indicar nada, no se limita.
    assert.equal(rx('dominada', w3, []).weight, 4);
    assert.equal(platesWarning('2026-11-25'), null);
    // Sin discos: sin lastre y bajando despacio, y aviso con los días que faltan.
    setEventConfig({ plates: [] });
    // Sin discos, más repeticiones en vez de kilos: 3 con 4 kg equivalen a unas 5 sin lastre.
    const none = rx('dominada', w3, []);
    assert.deepEqual([none.weight, none.reps], [0, 5]);
    assert.match(none.note, /5 sin lastre equivalen/);
    assert.deepEqual([repsInsteadOf(3, 2), repsInsteadOf(3, 4), repsInsteadOf(3, 6), repsInsteadOf(2, 2)], [4, 5, 5, 3]);
    assert.match(platesWarning('2026-11-25')!, /El 12\/12 empieza el lastre.*Faltan 17 días/);
    assert.match(platesWarning('2026-12-20')!, /Ya toca lastre/);
    assert.equal(platesWarning('2026-11-01'), null); // aún queda mucho
    // El peso muerto no depende de estos discos.
    assert.equal(rx('peso_muerto', w3, []).weight, 95);
    // Con discos que se quedan cortos: el más cercano por debajo y una repetición más.
    setEventConfig({ plates: [2.5, 2.5] });
    const short = rx('dominada', w3, []);
    assert.deepEqual([short.weight, short.reps], [2.5, 4]);
    assert.equal(platesWarning('2026-11-25'), null);
    // Si sale un peso a medio kilo del pedido, vale: 3,75 kg por 4.
    setEventConfig({ plates: [1.25, 1.25, 2.5, 2.5] });
    assert.deepEqual(fitToPlates(w3.doses.dominada, eventConfig.plates), { ...w3.doses.dominada, weight: 3.75 });
  } finally {
    setEventConfig({ plates: before });
  }
});

test('de viaje sin barra, el plan de dominadas no avisa esos días', async () => {
  const { planTrialReminders, pullupsPausedBy } = await import('./event');
  const now = new Date(2026, 10, 23, 8, 0);
  const all = planTrialReminders([], ['09:00'], now, '2026-11-23', 5);
  const paused = planTrialReminders([], ['09:00'], now, '2026-11-23', 5, new Set(['2026-11-24']));
  assert.equal(paused.length, all.length - 1);
  assert.ok(paused.every((r) => !r.id.includes('2026-11-24')));
  assert.equal(pullupsPausedBy(null), false);
  assert.equal(pullupsPausedBy({ gimnasio: true }), false);
  assert.equal(pullupsPausedBy({ gimnasio: false }), true);
});

test('los agarres de la sesión los fija el plan: primero prono, luego el del día', async () => {
  const { gripPlan, gripPlanText } = await import('./event');
  // Lunes (día de prono): todas en prono.
  assert.equal(gripPlanText(gripPlan(6, '2026-11-23')), '6 series en prono');
  // Martes (día de supino): la primera mitad en prono y el resto en supino.
  assert.deepEqual(gripPlan(5, '2026-11-24'), ['prono', 'prono', 'prono', 'supino', 'supino']);
  assert.equal(gripPlanText(gripPlan(6, '2026-11-24')), '3 series en prono y 3 en supino');
  assert.equal(gripPlanText(gripPlan(1, '2026-11-26')), '1 serie en prono');
  assert.equal(gripPlanText(gripPlan(4, '2026-11-26')), '2 series en prono y 2 en neutro');
});

test('fatiga de tirón: dos sesiones al límite o más días de los planificados', async () => {
  const { pullFatigue } = await import('./event');
  const today = '2026-11-27';
  // Una semana normal de plan (cuatro días, con margen) no avisa.
  const normal = ['2026-11-23', '2026-11-24', '2026-11-26'].map((d) => log(d, 'dominada', 0, 1, 1));
  assert.equal(pullFatigue(normal, today), null);
  // Las dos últimas al límite: aviso. Con una sola, no.
  assert.match(pullFatigue([log('2026-11-24', 'dominada', 0, 1, 0), log('2026-11-26', 'dominada', 0, 1, 0)], today)!, /al límite/);
  assert.equal(pullFatigue([log('2026-11-24', 'dominada', 0, 1, 1), log('2026-11-26', 'dominada', 0, 1, 0)], today), null);
  // Si pasó más de una semana, ya no cuentan.
  assert.equal(pullFatigue([log('2026-11-10', 'dominada', 0, 1, 0), log('2026-11-12', 'dominada', 0, 1, 0)], today), null);
  // Cinco días de dominadas en una semana: más de lo que pide el plan.
  const many = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-26'].map((d) => log(d, 'dominada', 0, 1, 2));
  assert.match(pullFatigue(many, today)!, /5 días/);
  // El peso muerto no cuenta, ni lo de hoy.
  assert.equal(pullFatigue([log('2026-11-25', 'peso_muerto', 80, 5, 0), log('2026-11-26', 'peso_muerto', 80, 5, 0), log(today, 'dominada', 0, 1, 0)], today), null);
});

test('el viernes es el día suave de dominadas: menos series, sin lastre', async () => {
  const { buildPlan, isEasyPullupDay, pullupDose, prescription } = await import('./event');
  const plan = buildPlan();
  assert.deepEqual(['2026-11-23', '2026-11-24', '2026-11-26', '2026-11-27', '2026-11-28'].map((d) => isEasyPullupDay(d)), [false, false, false, true, false]);
  for (const week of plan) {
    const normal = prescription('dominada', week, []);
    const friday = week.from <= '2026-11-27' && '2026-11-27' <= week.to ? '2026-11-27' : null;
    if (!friday) continue;
    const easy = pullupDose(friday, week, []);
    assert.ok(easy.sets <= normal.sets && easy.sets >= Math.min(2, normal.sets));
    assert.equal(easy.weight, 0);
    assert.equal(easy.reps, normal.reps);
    assert.match(easy.note, /suave/);
    // El resto de días, lo de la semana.
    assert.deepEqual(pullupDose('2026-11-23', week, []), normal);
  }
});
