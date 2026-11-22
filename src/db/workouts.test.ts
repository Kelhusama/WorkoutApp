/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { totalLoad, trained } from '../domain/workouts';
import { addTrialLog, deleteTrialLog } from './event';
import { loadDays, markMissed, saveGymSession } from './repo';
import { migrate } from './schema';
import { createTestDb } from './testDb';
import { addWorkout, deleteWorkout, getWorkouts, setWorkoutMeta, updateWorkout } from './workouts';

const DAY = '2026-11-23'; // lunes: toca gimnasio

async function setup() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

test('todo lo apuntado en un día sale como entrenamiento, con su carga por defecto', async () => {
  const db = await setup();
  await saveGymSession(db, DAY, 'dura', null, []);
  await addTrialLog(db, { date: DAY, lift: 'dominada', weight: 0, reps: 2, sets: 5, reserve: 2 });
  await addTrialLog(db, { date: DAY, lift: 'dominada', weight: 0, reps: 1, sets: 3, reserve: 1 });
  await db.runAsync("INSERT INTO walk_log (date, kind, km, minutes, effort) VALUES (?, 'suave', 6.5, 70, 4)", DAY);
  await db.runAsync("INSERT INTO flex_session (date, level, seconds, exercises) VALUES (?, 1, 600, '[]')", DAY);
  await db.runAsync("INSERT INTO stretch_log (date, routine, stretch_id, seconds) VALUES (?, 'postA', 'a', 60), (?, 'postA', 'b', 90)", DAY, DAY);

  const w = await getWorkouts(db, DAY, DAY);
  assert.deepEqual(
    w.map((x) => [x.type, x.title, x.load, x.minutes]),
    [
      ['gimnasio', 'Gimnasio', 3, null],
      ['dominadas', 'Dominadas', 1, null],
      ['dominadas', 'Dominadas', 2, null],
      ['movilidad', 'Flexibilidad', 1, 10],
      // Las dos filas de estiramientos de la misma rutina son un solo entrenamiento.
      ['estiramientos', 'Estiramientos', 1, 3],
      ['caminata', 'Caminata 6,5 km', 2, 70],
    ],
  );
  // Volver a leer no duplica nada.
  assert.equal((await getWorkouts(db, DAY, DAY)).length, 6);
  // Carga del día: 3 + 1 + 2 + 2 + 1; los estiramientos no suman.
  assert.equal(totalLoad(w), 9);
});

test('borrar o cambiar el detalle se refleja; lo corregido a mano se respeta', async () => {
  const db = await setup();
  const id = await addTrialLog(db, { date: DAY, lift: 'dominada', weight: 0, reps: 2, sets: 5, reserve: 0 });
  await saveGymSession(db, DAY, 'facil', null, []);
  let [gym, pull] = [...(await getWorkouts(db, DAY, DAY))].sort((a, b) => a.type.localeCompare(b.type)).reverse();
  assert.deepEqual([gym.type, gym.load, pull.type, pull.load], ['gimnasio', 1, 'dominadas', 3]);

  // Cómo estabas y la duración real se añaden sin marcarlo como corregido: la carga sigue saliendo del detalle.
  await setWorkoutMeta(db, 'session_log', gym.sourceId!, { state: 'cansado', minutes: 52 });
  await saveGymSession(db, DAY, 'dura', null, []);
  gym = (await getWorkouts(db, DAY, DAY)).find((x) => x.type === 'gimnasio')!;
  assert.deepEqual([gym.load, gym.state, gym.minutes], [3, 'cansado', 52]);

  // Corregido a mano: ya no se recalcula.
  await updateWorkout(db, gym.id, { minutes: 60, load: 2, state: 'molestias', notes: '  codo  ' });
  await saveGymSession(db, DAY, 'facil', null, []);
  gym = (await getWorkouts(db, DAY, DAY)).find((x) => x.type === 'gimnasio')!;
  assert.deepEqual([gym.load, gym.state, gym.minutes, gym.notes], [2, 'molestias', 60, 'codo']);

  // Borrar el registro de dominadas quita su entrenamiento.
  await deleteTrialLog(db, id);
  assert.deepEqual((await getWorkouts(db, DAY, DAY)).map((x) => x.type), ['gimnasio']);
});

test('entrenamientos sin detalle: se pueden repetir en el día, de cualquier tipo, y borrar', async () => {
  const db = await setup();
  const base = { date: DAY, minutes: 45, load: 2 as const, state: 'normal' as const, notes: null };
  const a = await addWorkout(db, { ...base, type: 'gimnasio', title: 'Gimnasio' });
  await addWorkout(db, { ...base, type: 'gimnasio', title: 'Gimnasio' });
  // Un tipo que la app aún no conoce también se guarda.
  await addWorkout(db, { ...base, type: 'padel', title: 'Pádel', load: 3 });
  let w = await getWorkouts(db, DAY, DAY);
  assert.deepEqual(w.map((x) => x.type), ['gimnasio', 'gimnasio', 'padel']);
  assert.ok(trained(w));
  await deleteWorkout(db, a);
  w = await getWorkouts(db, DAY, DAY);
  assert.equal(w.length, 2);
  // Uno con detalle no se borra desde aquí.
  await saveGymSession(db, '2026-11-26', 'normal', null, []);
  const detailed = (await getWorkouts(db, '2026-11-26', '2026-11-26'))[0];
  await deleteWorkout(db, detailed.id);
  assert.equal((await getWorkouts(db, '2026-11-26', '2026-11-26')).length, 1);
});

test('calendario: el día está hecho si se entrena algo, aunque no sea lo que tocaba', async () => {
  const db = await setup();
  const status = async (date: string) => (await loadDays(db, date, date)).days[0];
  // Lunes pasado, tocaba gimnasio y solo hubo dominadas: hecho, con sus entrenamientos a la vista.
  await addTrialLog(db, { date: '2026-11-16', lift: 'dominada', weight: 0, reps: 2, sets: 5, reserve: 1 });
  const mon = await status('2026-11-16');
  assert.deepEqual([mon.type, mon.status, mon.workouts.map((w) => w.type)], ['gym', 'done', ['dominadas']]);
  // Marcado «hoy no entreno» pero luego se apunta algo: gana lo entrenado.
  await markMissed(db, '2026-11-17', 'B');
  assert.equal((await status('2026-11-17')).status, 'missed');
  await addWorkout(db, { date: '2026-11-17', type: 'otro', title: 'Pádel', minutes: 60, load: 2, state: null, notes: null });
  assert.equal((await status('2026-11-17')).status, 'done');
  // Solo estirar no cuenta como haber entrenado.
  await db.runAsync("INSERT INTO stretch_log (date, routine, stretch_id, seconds) VALUES ('2026-11-18', 'postA', 'a', 60)");
  const wed = await status('2026-11-18');
  assert.equal(wed.status, 'missed');
  assert.deepEqual(wed.workouts.map((w) => w.type), ['estiramientos']);
});
