const STORAGE_PREFIX = 'tourist-companion.arrival-done.';

export function progressStorageKey(airport: string): string {
  return `${STORAGE_PREFIX}${airport}`;
}

export function loadDoneIds(airport: string, storage: Storage = localStorage): Set<string> {
  try {
    const raw = storage.getItem(progressStorageKey(airport));
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function saveDoneIds(airport: string, ids: Iterable<string>, storage: Storage = localStorage): void {
  storage.setItem(progressStorageKey(airport), JSON.stringify([...ids]));
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((done / total) * 100);
}
