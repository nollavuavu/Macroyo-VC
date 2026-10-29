/**
 * Serialised, save-first state store.
 * - Every commit runs through one queue, so two quick edits can never write out of order or lose an update.
 * - The new state is saved BEFORE it becomes visible; if saving fails nothing changes and the caller is told.
 * - If the stored data could not be read, the raw blob is copied to a backup key and writes are blocked
 *   until the user explicitly resets, so existing history is never overwritten.
 */
import { msg } from '../../i18n/msg';
import type { Msg } from '../../i18n/types';
import { EMPTY_DATA, type AppData } from './types';

export const SAVE_FAILED_MESSAGE: Msg = msg('storage.saveFailed');
export const READ_FAILED_MESSAGE: Msg = msg('storage.readFailed');

export type CommitResult = { ok: true; data: AppData } | { ok: false; error: Msg };

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
  /**
   * The banner's Retry. After a failed save it applies the change that failed; after a failed read it reads the
   * stored data again (and lifts the write block if it is readable now). Never overwrites unreadable data.
   */
  retry(): Promise<CommitResult>;
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

  const failure = (error: Msg): CommitResult => ({ ok: false, error });
  /** The last change whose save failed, so Retry can apply it. */
  let lastFailed: ((current: AppData) => AppData) | null = null;

  const attempt = async (update: (current: AppData) => AppData): Promise<CommitResult> => {
    if (blocked) return failure(READ_FAILED_MESSAGE);
    const next = update(data);
    try {
      await deps.save(next);
    } catch {
      lastFailed = update;
      return failure(SAVE_FAILED_MESSAGE);
    }
    lastFailed = null;
    data = next;
    return { ok: true, data: next };
  };

  return {
    get: () => data,
    isBlocked: () => blocked,
    loadError: () => failedToRead,
    commit: (update) => run(() => attempt(update)),
    retry: () =>
      run(async (): Promise<CommitResult> => {
        if (blocked) {
          try {
            data = await deps.load();
          } catch {
            return failure(READ_FAILED_MESSAGE);
          }
          blocked = false;
          failedToRead = false;
          return { ok: true, data };
        }
        if (lastFailed) return attempt(lastFailed);
        return { ok: true, data };
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
        lastFailed = null;
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
