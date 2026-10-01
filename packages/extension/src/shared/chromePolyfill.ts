/**
 * Minimal chrome.storage / chrome.runtime Polyfill für WKWebView (Safari-Host-App).
 * Nur aktiv, wenn kein echtes Extension-API vorhanden ist.
 */
const STORAGE_PREFIX = 'langs-polyfill:';

function areaStore(area: string): Storage {
  // sync + local persistent; session ≈ Tab/Sitzung
  return area === 'session' ? sessionStorage : localStorage;
}

function createArea(areaName: string) {
  const store = () => areaStore(areaName);

  return {
    async get(
      keys?: string | string[] | Record<string, unknown> | null,
    ): Promise<Record<string, unknown>> {
      const out: Record<string, unknown> = {};
      const s = store();
      if (keys == null) {
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (!k?.startsWith(STORAGE_PREFIX)) continue;
          const raw = s.getItem(k);
          if (raw != null) {
            try {
              out[k.slice(STORAGE_PREFIX.length)] = JSON.parse(raw);
            } catch {
              /* ignore */
            }
          }
        }
        return out;
      }
      const list: string[] = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : Object.keys(keys);
      for (const key of list) {
        const raw = s.getItem(STORAGE_PREFIX + key);
        if (raw != null) {
          try {
            out[key] = JSON.parse(raw);
          } catch {
            /* ignore */
          }
        } else if (
          keys &&
          typeof keys === 'object' &&
          !Array.isArray(keys) &&
          key in keys
        ) {
          out[key] = (keys as Record<string, unknown>)[key];
        }
      }
      return out;
    },
    async set(items: Record<string, unknown>): Promise<void> {
      const s = store();
      for (const [key, value] of Object.entries(items)) {
        s.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      }
    },
    async remove(keys: string | string[]): Promise<void> {
      const list = Array.isArray(keys) ? keys : [keys];
      const s = store();
      for (const key of list) s.removeItem(STORAGE_PREFIX + key);
    },
    async clear(): Promise<void> {
      const s = store();
      const toRemove: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) toRemove.push(k);
      }
      for (const k of toRemove) s.removeItem(k);
    },
  };
}

/** Echte Browser-Extension (Chrome/Firefox/Safari): hat immer eine runtime.id. */
export function isRealExtensionRuntime(): boolean {
  try {
    const id = (
      globalThis as typeof globalThis & { chrome?: typeof chrome }
    ).chrome?.runtime?.id;
    return typeof id === 'string' && id.length > 0;
  } catch {
    return false;
  }
}

export function installChromePolyfill(): void {
  const g = globalThis as typeof globalThis & { chrome?: typeof chrome };

  // Niemals echte Extension-APIs überschreiben (auch ohne storage.session).
  if (isRealExtensionRuntime()) return;

  if (g.chrome?.storage?.sync && g.chrome?.storage?.session) return;

  g.chrome = {
    storage: {
      sync: createArea('sync'),
      session: createArea('session'),
      local: createArea('local'),
    },
    runtime: {
      getURL(path: string) {
        try {
          return new URL(path, document.baseURI).href;
        } catch {
          return path;
        }
      },
    },
  } as unknown as typeof chrome;
}

export function isHostAppMode(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('host') === '1') return true;
  // Extension-Kontext: nie Host — auch wenn Polyfill fälschlich fehlte
  if (isRealExtensionRuntime()) return false;
  try {
    return typeof chrome?.runtime?.id !== 'string';
  } catch {
    return true;
  }
}
