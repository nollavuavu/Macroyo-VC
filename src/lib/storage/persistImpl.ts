import * as SQLite from 'expo-sqlite';
import { EMPTY_DATA, type AppData } from './types';

const DB_NAME = 'macroyo.db';

// One connection for the life of the app.
let connection: Promise<SQLite.SQLiteDatabase> | null = null;

function open(): Promise<SQLite.SQLiteDatabase> {
  if (!connection) {
    connection = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY NOT NULL, json TEXT NOT NULL);',
      );
      return db;
    })().catch((error) => {
      connection = null; // allow a retry on the next call
      throw error;
    });
  }
  return connection;
}

export async function loadState(): Promise<AppData> {
  const db = await open();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM app_state WHERE id = 1');
  if (!row?.json) return { ...EMPTY_DATA };
  return { ...EMPTY_DATA, ...(JSON.parse(row.json) as AppData) };
}

export async function saveState(data: AppData): Promise<void> {
  const db = await open();
  await db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (1, ?)', JSON.stringify(data));
}

/** Keep a copy of the raw stored blob (row id = timestamp, always > 1) before anything can overwrite it. */
export async function backupRawState(): Promise<void> {
  const db = await open();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM app_state WHERE id = 1');
  if (!row?.json) return;
  await db.runAsync('INSERT OR REPLACE INTO app_state (id, json) VALUES (?, ?)', Date.now(), row.json);
}
