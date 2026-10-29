import AsyncStorage from '@react-native-async-storage/async-storage';
import { freshEmptyData, type AppData } from './types';
import { BACKUP_PREFIX, backupKeysToPrune, parseStoredData } from './shape';

const KEY = 'macroyo.v1';

/** Throws (a read failure) for broken text AND for valid JSON of the wrong shape. */
export async function loadState(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return freshEmptyData();
  return parseStoredData(raw);
}

export async function saveState(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

/** Keep a copy of the raw stored blob under a timestamped key before anything can overwrite it; keep only the latest 3. */
export async function backupRawState(): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return;
  await AsyncStorage.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
  const stale = backupKeysToPrune(await AsyncStorage.getAllKeys());
  if (stale.length > 0) await AsyncStorage.multiRemove(stale);
}
