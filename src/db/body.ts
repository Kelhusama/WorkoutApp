import type { SQLiteDatabase } from 'expo-sqlite';

import type { BodyEntry, Profile, Sex } from '@/domain/body';
import type { ISODate } from '@/domain/dates';

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const r = await db.getFirstAsync<{ height_cm: number; birth_date: ISODate; sex: Sex; activity: number }>(
    'SELECT height_cm, birth_date, sex, activity FROM profile WHERE id = 1',
  );
  return r ? { heightCm: r.height_cm, birthDate: r.birth_date, sex: r.sex, activity: r.activity } : null;
}

export async function saveProfile(db: SQLiteDatabase, p: Profile) {
  await db.runAsync(
    `INSERT INTO profile (id, height_cm, birth_date, sex, activity) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET height_cm = excluded.height_cm, birth_date = excluded.birth_date,
       sex = excluded.sex, activity = excluded.activity`,
    p.heightCm,
    p.birthDate,
    p.sex,
    p.activity,
  );
}

interface Row {
  date: ISODate;
  weight: number;
  waist: number | null;
  neck: number | null;
  hip: number | null;
  arm: number | null;
  chest: number | null;
  body_fat: number | null;
}

const toEntry = (r: Row): BodyEntry => ({
  date: r.date,
  weight: r.weight,
  waist: r.waist,
  neck: r.neck,
  hip: r.hip,
  arm: r.arm,
  chest: r.chest,
  bodyFat: r.body_fat,
});

/** Mediciones en orden cronológico. */
export async function getBodyLog(db: SQLiteDatabase): Promise<BodyEntry[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT date, weight, waist, neck, hip, arm, chest, body_fat FROM body_log ORDER BY date',
  );
  return rows.map(toEntry);
}

export async function saveBodyEntry(db: SQLiteDatabase, e: BodyEntry) {
  await db.runAsync(
    `INSERT INTO body_log (date, weight, waist, neck, hip, arm, chest, body_fat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, waist = excluded.waist, neck = excluded.neck,
       hip = excluded.hip, arm = excluded.arm, chest = excluded.chest, body_fat = excluded.body_fat`,
    e.date,
    e.weight,
    e.waist ?? null,
    e.neck ?? null,
    e.hip ?? null,
    e.arm ?? null,
    e.chest ?? null,
    e.bodyFat ?? null,
  );
}

export async function deleteBodyEntry(db: SQLiteDatabase, date: ISODate) {
  await db.runAsync('DELETE FROM body_log WHERE date = ?', date);
}
