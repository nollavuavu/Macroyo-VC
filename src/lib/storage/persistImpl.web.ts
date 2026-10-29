import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_DATA, type AppData } from './types';

const KEY = 'macroyo.v1';

export async function loadState(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...EMPTY_DATA, logs: [], bodyStats: [] };
  const parsed = JSON.parse(raw) as AppData;
  return {
    profile: parsed.profile ?? null,
    logs: parsed.logs ?? [],
    bodyStats: parsed.bodyStats ?? [],
  };
}

export async function saveState(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
