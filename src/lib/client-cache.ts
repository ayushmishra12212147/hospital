const cacheStore: Record<string, { data: any; timestamp: number }> = {};

export function getCachedData<T>(key: string, ttlMs = 300000): T | null { // 5 minutes default
  const cached = cacheStore[key];
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data as T;
  }
  return null;
}

export function setCachedData(key: string, data: any): void {
  cacheStore[key] = { data, timestamp: Date.now() };
}

export function clearCache(key?: string): void {
  if (key) {
    delete cacheStore[key];
  } else {
    for (const k in cacheStore) {
      delete cacheStore[k];
    }
  }
}
