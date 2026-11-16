import type { SQLiteDatabase } from 'expo-sqlite';

import type { ISODate } from '@/domain/dates';
import type { RoutineId, StretchEntry } from '@/domain/stretches';

/** Guarda lo estirado en una rutina: una fila por estiramiento, sumando sus dos lados. */
export async function saveStretching(
  db: SQLiteDatabase,
  date: ISODate,
  routine: RoutineId,
  done: readonly { stretchId: string; seconds: number }[],
): Promise<void> {
  const total = new Map<string, number>();
  for (const d of done) if (d.seconds > 0) total.set(d.stretchId, (total.get(d.stretchId) ?? 0) + Math.round(d.seconds));
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const [stretchId, seconds] of total) {
      await tx.runAsync('INSERT INTO stretch_log (date, routine, stretch_id, seconds) VALUES (?, ?, ?, ?)', date, routine, stretchId, seconds);
    }
  });
}

/** Estiramientos registrados entre dos fechas (incluidas), o todos. */
export async function getStretching(db: SQLiteDatabase, from: ISODate = '0000-01-01', to: ISODate = '9999-12-31'): Promise<StretchEntry[]> {
  const rows = await db.getAllAsync<StretchEntry>(
    'SELECT date, stretch_id AS stretchId, seconds FROM stretch_log WHERE date BETWEEN ? AND ? ORDER BY date, id',
    from,
    to,
  );
  return rows.map((r) => ({ ...r }));
}

/** ¿Se ha hecho ya esta rutina ese día? */
export async function stretchedOn(db: SQLiteDatabase, date: ISODate, routine: RoutineId): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM stretch_log WHERE date = ? AND routine = ?', date, routine);
  return (r?.n ?? 0) > 0;
}
