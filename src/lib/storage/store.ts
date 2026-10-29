/**
 * Serialised, save-first state store.
 * - Every commit runs through one queue, so two quick edits can never write out of order or lose an update.
 * - The new state is saved BEFORE it becomes visible; if saving fails nothing changes and the caller is told.
 * - If the stored data could not be read, the raw blob is copied to a backup key and writes are blocked
 *   until the user explicitly resets, so existing history is never overwritten.
 */
import { EMPTY_DATA, type AppData } from './types';

export const SAVE_FAILED_MESSAGE = 'Could not save on this device. Your last change was not applied.';
export const READ_FAILED_MESSAGE =
  'Saved data could not be read. A backup copy was kept and nothing new will be saved until you reset the app data.';

export type CommitResult = { ok: true; data: AppData } | { ok: false; error: string };

export interface StoreDeps {
  load: () => Promise<AppData>;
  save: (data: AppData) => Promise<void>;
  /** Copy the raw stored blob somewhere safe. May throw; the store still blocks writes. */
  backupRaw: () => Promise<void>;
}

export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

export interface StateStore {
  get(): AppData;
  isBlocked(): boolean;
  loadError(): boolean;
  commit(update: (current: AppData) => AppData): Promise<CommitResult>;
  /** Explicit user reset: overwrites storage with empty data and lifts the write block. */
  reset(): Promise<CommitResult>;
}

function emptyData(): AppData {
  return { ...EMPTY_DATA, logs: [], bodyStats: [] };
}

export async function openStore(deps: StoreDeps): Promise<StateStore> {
  const run = createSerialQueue();
  let data: AppData = emptyData();
  let blocked = false;
  let failedToRead = false;
  try {
    data = await deps.load();
  } catch {
    blocked = true;
    failedToRead = true;
    try {
      await deps.backupRaw();
    } catch {
      // Still blocked: never write over data we could not read.
    }
  }

  const failure = (error: string): CommitResult => ({ ok: false, error });

  return {
    get: () => data,
    isBlocked: () => blocked,
    loadError: () => failedToRead,
    commit: (update) =>
      run(async (): Promise<CommitResult> => {
        if (blocked) return failure(READ_FAILED_MESSAGE);
        const next = update(data);
        try {
          await deps.save(next);
        } catch {
          return failure(SAVE_FAILED_MESSAGE);
        }
        data = next;
        return { ok: true, data: next };
      }),
    reset: () =>
      run(async (): Promise<CommitResult> => {
        const empty = emptyData();
        try {
          await deps.save(empty);
        } catch {
          return failure(SAVE_FAILED_MESSAGE);
        }
        data = empty;
        blocked = false;
        failedToRead = false;
        return { ok: true, data: empty };
      }),
  };
}

/** Insert at an index (clamped), used to put an undone delete back where it was. */
export function insertAt<T>(list: readonly T[], item: T, index: number): T[] {
  const at = Math.max(0, Math.min(list.length, Math.floor(index)));
  return [...list.slice(0, at), item, ...list.slice(at)];
}
