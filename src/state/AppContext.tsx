import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemSchemeRN } from 'react-native';
import { Platform } from 'react-native';
import { getTheme, type Theme } from '../theme/theme';
import { loadState, saveState, EMPTY_DATA, type AppData, type BodyStat, type LogEntry, type Profile } from '../lib/storage/repository';

interface AppContextValue {
  ready: boolean;
  error: string | null;
  data: AppData;
  saveProfile: (profile: Profile) => Promise<void>;
  updateProfile: (profile: Profile) => Promise<void>;
  addLog: (entry: LogEntry) => Promise<void>;
  updateLog: (entry: LogEntry) => Promise<void>;
  deleteLog: (id: string) => Promise<LogEntry | null>;
  restoreLog: (entry: LogEntry) => Promise<void>;
  addBodyStat: (stat: BodyStat) => Promise<void>;
  deleteBodyStat: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    let cancelled = false;
    loadState()
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Saved data could not be read. You can keep going, but it may not stick.');
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback(async (next: AppData) => {
    dataRef.current = next;
    setData(next);
    try {
      await saveState(next);
      setError(null);
    } catch {
      setError('Could not save on this device.');
    }
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    ready,
    error,
    data,
    saveProfile: (profile) => commit({ ...dataRef.current, profile }),
    updateProfile: (profile) => commit({ ...dataRef.current, profile }),
    addLog: (entry) => commit({ ...dataRef.current, logs: [entry, ...dataRef.current.logs] }),
    updateLog: (entry) =>
      commit({
        ...dataRef.current,
        logs: dataRef.current.logs.map((item) => (item.id === entry.id ? entry : item)),
      }),
    deleteLog: async (id) => {
      const existing = dataRef.current.logs.find((item) => item.id === id) ?? null;
      await commit({ ...dataRef.current, logs: dataRef.current.logs.filter((item) => item.id !== id) });
      return existing;
    },
    restoreLog: (entry) => {
      if (dataRef.current.logs.some((item) => item.id === entry.id)) return Promise.resolve();
      return commit({ ...dataRef.current, logs: [entry, ...dataRef.current.logs] });
    },
    addBodyStat: (stat) => commit({ ...dataRef.current, bodyStats: [stat, ...dataRef.current.bodyStats] }),
    deleteBodyStat: (id) =>
      commit({ ...dataRef.current, bodyStats: dataRef.current.bodyStats.filter((item) => item.id !== id) }),
    resetAll: () => commit({ ...EMPTY_DATA, logs: [], bodyStats: [] }),
  }), [commit, data, error, ready]);

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
