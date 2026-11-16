import type { SQLiteDatabase } from 'expo-sqlite';

import { getBodyLog } from '@/db/body';
import { loadMarch } from '@/db/march';
import { loadDays } from '@/db/repo';
import { getSetCounts } from '@/db/stats';
import { getStretching } from '@/db/stretch';
import { addDays, type ISODate } from '@/domain/dates';
import { trendRatePerWeek, trendWeight, weeklyFocus, type Focus, type WeekReview } from '@/domain/insights';
import { longDone } from '@/domain/marchPlan';
import { stepAt } from '@/domain/marchPlan';
import { weeklyVolume } from '@/domain/volume';

/** Ejercicios cuya mejor serie o mayor total de la semana supera todo lo anterior. */
export async function countWeekRecords(db: SQLiteDatabase, from: ISODate, to: ISODate): Promise<number> {
  const rows = await db.getAllAsync<{ exercise_id: string; top: number; total: number; inWeek: number }>(
    `SELECT l.exercise_id AS exercise_id, MAX(l.value) AS top, SUM(l.value) AS total,
            CASE WHEN s.date BETWEEN ? AND ? THEN 1 ELSE 0 END AS inWeek
       FROM set_log l JOIN session_log s ON s.id = l.session_id
      WHERE s.status = 'done' AND s.date <= ?
      GROUP BY l.exercise_id, s.date`,
    from,
    to,
    to,
  );
  const before = new Map<string, { top: number; total: number }>();
  const week = new Map<string, { top: number; total: number }>();
  for (const r of rows) {
    const target = r.inWeek ? week : before;
    const cur = target.get(r.exercise_id) ?? { top: 0, total: 0 };
    target.set(r.exercise_id, { top: Math.max(cur.top, r.top), total: Math.max(cur.total, r.total) });
  }
  let n = 0;
  for (const [id, w] of week) {
    const b = before.get(id);
    if (b && (w.top > b.top || w.total > b.total)) n++;
  }
  return n;
}

export interface WeekReviewData extends WeekReview {
  planned: number;
  stretchMinutes: number;
  walks: number;
  /** Peso tendencial al final de la semana, si hay mediciones. */
  trend: number | null;
  focus: Focus;
}

/** Resumen de una semana (de lunes a domingo) con el foco para la siguiente. */
export async function loadWeekReview(db: SQLiteDatabase, monday: ISODate, today: ISODate): Promise<WeekReviewData> {
  const sunday = addDays(monday, 6);
  const { days } = await loadDays(db, monday, sunday);
  const done = days.filter((d) => d.status === 'done').length;
  const missed = days.filter((d) => d.status === 'missed').length;
  const hardSessions = days.filter((d) => d.status === 'done' && d.log?.feeling === 'dura').length;

  const volume = weeklyVolume(await getSetCounts(db, monday, sunday));
  const records = await countWeekRecords(db, monday, sunday);

  const stretching = await getStretching(db, monday, sunday);
  const stretchDays = new Set(stretching.map((e) => e.date)).size;
  const stretchMinutes = Math.round(stretching.reduce((a, e) => a + e.seconds, 0) / 60);

  const march = await loadMarch(db, today);
  const weekWalks = march.walks.filter((w) => w.date >= monday && w.date <= sunday);
  const walkedKm = Math.round(weekWalks.reduce((a, w) => a + w.km, 0) * 10) / 10;
  const marchActive = march.state !== null && !march.state.completed;
  // La tirada larga cuenta si hubo una caminata marcada como larga o tan larga como pide el escalón actual.
  const longWalkDone =
    weekWalks.some((w) => w.kind === 'larga') || (marchActive && weekWalks.some((w) => longDone(stepAt(march.state!.step), w.km)));

  const body = (await getBodyLog(db)).filter((e) => e.date <= sunday);
  const weighedIn = body.some((e) => e.date >= monday);
  const trendSeries = trendWeight(body);
  const weightRate = trendRatePerWeek(trendSeries);

  const review: WeekReview = { done, missed, volume, records, stretchDays, walkedKm, marchActive, longWalkDone, weighedIn, weightRate, hardSessions };
  return {
    ...review,
    planned: done + missed + days.filter((d) => d.status === 'pending' || d.status === 'future').length,
    stretchMinutes,
    walks: weekWalks.length,
    trend: trendSeries.length ? trendSeries[trendSeries.length - 1].value : null,
    focus: weeklyFocus(review),
  };
}
