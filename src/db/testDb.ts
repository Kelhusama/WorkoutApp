/// <reference types="node" />
// Solo para tests: imita la API asíncrona de expo-sqlite sobre el SQLite que trae Node.
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = (string | number | null)[];

export function createTestDb(): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');
  const api = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, ...params: Params) {
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync(sql: string, ...params: Params) {
      return db.prepare(sql).all(...params);
    },
    async getFirstAsync(sql: string, ...params: Params) {
      return db.prepare(sql).get(...params) ?? null;
    },
    async withExclusiveTransactionAsync(task: (tx: unknown) => Promise<void>) {
      db.exec('BEGIN');
      try {
        await task(api);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return api as unknown as SQLiteDatabase;
}
