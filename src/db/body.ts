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

/** Campo de la medición → columna de la tabla body_log (además de date y weight). */
const COLUMNS: Record<Exclude<keyof BodyEntry, 'date' | 'weight'>, string> = {
  waist: 'waist',
  neck: 'neck',
  hip: 'hip',
  arm: 'arm',
  chest: 'chest',
  bodyFat: 'body_fat',
  fatFreeMass: 'fat_free_mass',
  skeletalMuscle: 'skeletal_muscle',
  water: 'water',
  protein: 'protein',
  boneMass: 'bone_mass',
  visceralFat: 'visceral_fat',
  scaleBmr: 'scale_bmr',
  bodyAge: 'body_age',
  bodyScore: 'body_score',
};
const FIELDS = Object.keys(COLUMNS) as (keyof typeof COLUMNS)[];

/** Mediciones en orden cronológico. */
export async function getBodyLog(db: SQLiteDatabase): Promise<BodyEntry[]> {
  const cols = FIELDS.map((k) => `${COLUMNS[k]} AS ${k}`).join(', ');
  return db.getAllAsync<BodyEntry>(`SELECT date, weight, ${cols} FROM body_log ORDER BY date`);
}

export async function saveBodyEntry(db: SQLiteDatabase, e: BodyEntry) {
  const cols = FIELDS.map((k) => COLUMNS[k]);
  await db.runAsync(
    `INSERT INTO body_log (date, weight, ${cols.join(', ')}) VALUES (${['?', '?', ...cols.map(() => '?')].join(', ')})
     ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`,
    e.date,
    e.weight,
    ...FIELDS.map((k) => e[k] ?? null),
  );
}

export async function deleteBodyEntry(db: SQLiteDatabase, date: ISODate) {
  await db.runAsync('DELETE FROM body_log WHERE date = ?', date);
}
