import { vi } from 'vitest';

/** Minimal asynchronous IDB harness for the adapter's get/put/open/transaction contract. */
export function installIndexedDb() {
  const records = new Map<string, unknown>();
  let exists = false;
  let openFails = false;
  let writeFails = false;
  const database = {
    createObjectStore: vi.fn(), close: vi.fn(),
    transaction: (_store: string, mode: string) => {
      const transaction = { oncomplete: null as (() => void) | null, onerror: null as (() => void) | null,
        onabort: null as (() => void) | null, error: null as Error | null,
        objectStore: () => ({
          get: (key: string) => {
            const request = { result: undefined as unknown, onsuccess: null as (() => void) | null };
            setTimeout(() => { request.result = records.get(key); request.onsuccess?.(); transaction.oncomplete?.(); }, 0);
            return request;
          },
          put: (record: { key: string }) => {
            setTimeout(() => {
              if (writeFails && mode === 'readwrite') { transaction.error = new Error('Write failed'); transaction.onabort?.(); }
              else { records.set(record.key, record); transaction.oncomplete?.(); }
            }, 0);
          },
        }),
      };
      return transaction;
    },
  };
  vi.stubGlobal('indexedDB', { open: vi.fn(() => {
    const request = { result: database, error: null as Error | null,
      onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
    setTimeout(() => {
      if (openFails) { request.error = new Error('Open failed'); request.onerror?.(); return; }
      if (!exists) { exists = true; request.onupgradeneeded?.(); }
      request.onsuccess?.();
    }, 0);
    return request;
  }) });
  return { records, database, failOpen: () => { openFails = true; }, failWrite: () => { writeFails = true; } };
}
