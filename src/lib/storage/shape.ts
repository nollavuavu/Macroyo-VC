/**
 * Shape checks for stored data. JSON.parse only fails on broken text, but `123`, `"abc"`, `[]`,
 * `{"profile":5,"logs":"x"}` and `{"logs":{}}` are valid JSON with the wrong shape. They must count as a read
 * failure (the store then backs the blob up and blocks writes) instead of loading as empty data that the next
 * save would overwrite, or crashing at the first `logs.filter`.
 */
import { isLanguagePref } from '../../i18n/types';
import { freshEmptyData, type AppData } from './types';

export const BACKUP_KEEP = 3;
export const BACKUP_PREFIX = 'macroyo.v1.backup.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRecordList = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) && value.every(isRecord);

/** Returns clean app data, or throws when the parsed value is not the shape the app writes. */
export function validateStoredData(parsed: unknown): AppData {
  if (!isRecord(parsed)) throw new Error('stored data is not an object');
  const { profile, logs, bodyStats, language } = parsed;
  if (profile != null && !isRecord(profile)) throw new Error('stored profile is not an object');
  if (logs != null && !isRecordList(logs)) throw new Error('stored logs are not a list of entries');
  if (bodyStats != null && !isRecordList(bodyStats)) throw new Error('stored body stats are not a list of entries');
  const empty = freshEmptyData();
  return {
    profile: (profile ?? null) as AppData['profile'],
    logs: (logs ?? empty.logs) as AppData['logs'],
    bodyStats: (bodyStats ?? empty.bodyStats) as AppData['bodyStats'],
    ...(isLanguagePref(language) ? { language } : {}),
  };
}

/** Parse the stored text and check its shape. Throws on either failure. */
export function parseStoredData(raw: string): AppData {
  return validateStoredData(JSON.parse(raw));
}

/** Backup keys (timestamp suffix) beyond the newest `keep`, oldest first. Unrelated keys are never returned. */
export function backupKeysToPrune(keys: readonly string[], keep = BACKUP_KEEP): string[] {
  const stamped = keys
    .filter((key) => key.startsWith(BACKUP_PREFIX) && Number.isFinite(Number(key.slice(BACKUP_PREFIX.length))))
    .sort((a, b) => Number(b.slice(BACKUP_PREFIX.length)) - Number(a.slice(BACKUP_PREFIX.length)));
  return stamped.slice(keep).reverse();
}
