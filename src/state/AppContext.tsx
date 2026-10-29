import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemSchemeRN } from 'react-native';
import { Platform } from 'react-native';
import { getTheme, type Theme } from '../theme/theme';
import { localDateISO } from '../lib/dates';
import { getLocale, setLocale, subscribeLocale } from '../i18n/state';
import { deviceLanguageTags, resolvePreference } from '../i18n/detect';
import type { LanguagePref, Msg } from '../i18n/types';
import {
  EMPTY_DATA,
  READ_FAILED_MESSAGE,
  backupRawState,
  insertAt,
  loadState,
  openStore,
  saveState,
  type AppData,
  type BodyStat,
  type LogEntry,
  type Profile,
  type StateStore,
} from '../lib/storage/repository';

interface AppContextValue {
  ready: boolean;
  error: Msg | null;
  /** True when stored data could not be read: writes are blocked until resetAll. */
  readFailed: boolean;
  data: AppData;
  /** Date shown on Today, shared with the Log tab. */
  selectedDate: string;
  setSelectedDate: (iso: string) => void;
  saveProfile: (profile: Profile) => Promise<boolean>;
  updateProfile: (profile: Profile) => Promise<boolean>;
  addLog: (entry: LogEntry) => Promise<boolean>;
  updateLog: (entry: LogEntry) => Promise<boolean>;
  /** Returns the removed entry and the position it had, or null if nothing was deleted. */
  deleteLog: (id: string) => Promise<{ entry: LogEntry; index: number } | null>;
  restoreLog: (entry: LogEntry, index?: number) => Promise<boolean>;
  addBodyStat: (stat: BodyStat) => Promise<boolean>;
  deleteBodyStat: (id: string) => Promise<boolean>;
  resetAll: () => Promise<boolean>;
  /** Persist the language preference and switch the UI language immediately. */
  setLanguage: (language: LanguagePref) => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Msg | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => localDateISO());
  const storeRef = useRef<StateStore | null>(null);

  // Keep <html lang> in step with the UI language on web (screen readers pick pronunciation from it).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const apply = () => { document.documentElement.lang = getLocale(); };
    apply();
    return subscribeLocale(apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    openStore({ load: loadState, save: saveState, backupRaw: backupRawState }).then((store) => {
      if (cancelled) return;
      storeRef.current = store;
      const loaded = store.get();
      setLocale(resolvePreference(loaded.language ?? 'system', deviceLanguageTags()));
      setData(loaded);
      if (store.loadError()) {
        setReadFailed(true);
        setError(READ_FAILED_MESSAGE);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Save first, then show. On failure nothing changes and the user sees why.
  const commit = useCallback(async (update: (current: AppData) => AppData): Promise<boolean> => {
    const store = storeRef.current;
    if (!store) return false;
    const result = await store.commit(update);
    if (result.ok) {
      setData(result.data);
      setError(null);
      return true;
    }
    setError(result.error);
    return false;
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    error,
    readFailed,
    data,
    selectedDate,
    setSelectedDate,
    saveProfile: (profile) => commit((cur) => ({ ...cur, profile })),
    updateProfile: (profile) => commit((cur) => ({ ...cur, profile })),
    addLog: (entry) => commit((cur) => ({ ...cur, logs: [entry, ...cur.logs] })),
    updateLog: (entry) =>
      commit((cur) => ({ ...cur, logs: cur.logs.map((item) => (item.id === entry.id ? entry : item)) })),
    deleteLog: async (id) => {
      let removed: { entry: LogEntry; index: number } | null = null;
      const ok = await commit((cur) => {
        const index = cur.logs.findIndex((item) => item.id === id);
        removed = index < 0 ? null : { entry: cur.logs[index], index };
        return index < 0 ? cur : { ...cur, logs: cur.logs.filter((item) => item.id !== id) };
      });
      return ok ? removed : null;
    },
    restoreLog: (entry, index = 0) =>
      commit((cur) =>
        cur.logs.some((item) => item.id === entry.id) ? cur : { ...cur, logs: insertAt(cur.logs, entry, index) },
      ),
    addBodyStat: (stat) => commit((cur) => ({ ...cur, bodyStats: [stat, ...cur.bodyStats] })),
    deleteBodyStat: (id) => commit((cur) => ({ ...cur, bodyStats: cur.bodyStats.filter((item) => item.id !== id) })),
    setLanguage: async (language) => {
      const ok = await commit((cur) => ({ ...cur, language }));
      if (ok) setLocale(resolvePreference(language, deviceLanguageTags()));
      return ok;
    },
    resetAll: async () => {
      const store = storeRef.current;
      if (!store) return false;
      const result = await store.reset();
      if (result.ok) {
        setData(result.data);
        setLocale(resolvePreference(result.data.language ?? 'system', deviceLanguageTags()));
        setReadFailed(false);
        setError(null);
        return true;
      }
      setError(result.error);
      return false;
    },
  }), [commit, data, error, ready, readFailed, selectedDate]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

function usePreferredScheme(): 'light' | 'dark' {
  const system = useSystemSchemeRN();
  const [webScheme, setWebScheme] = useState<'light' | 'dark'>(system === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setWebScheme(query.matches ? 'dark' : 'light');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  if (Platform.OS === 'web') return webScheme;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  const system = usePreferredScheme();
  const { data } = useApp();
  const appearance = data.profile?.appearance ?? 'system';
  const scheme = appearance === 'system' ? system : appearance;
  return getTheme(scheme);
}
