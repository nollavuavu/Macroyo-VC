import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_DATA, type AppData } from './types';
import { isLanguagePref } from '../../i18n/types';

const KEY = 'macroyo.v1';

export async function loadState(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...EMPTY_DATA, logs: [], bodyStats: [] };
  const parsed = JSON.parse(raw) as AppData;
  return {
    profile: parsed.profile ?? null,
    logs: parsed.logs ?? [],
    bodyStats: parsed.bodyStats ?? [],
    ...(isLanguagePref(parsed.language) ? { language: parsed.language } : {}),
  };
}

export async function saveState(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

/** Keep a copy of the raw stored blob under a timestamped key before anything can overwrite it. */
export async function backupRawState(): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw == null) return;
  await AsyncStorage.setItem(`${KEY}.backup.${Date.now()}`, raw);
}
