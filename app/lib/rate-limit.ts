export type RateLimitResult = {
  ok: boolean;
  retryAfterMs?: number;
};

type Entry = {
  count: number;
  windowStart: number;
};

const globalAny = globalThis as {
  __rateLimitStore?: Map<string, Entry>;
};

const store: Map<string, Entry> =
  globalAny.__rateLimitStore || (globalAny.__rateLimitStore = new Map());

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  const nextCount = existing.count + 1;
  existing.count = nextCount;

  if (nextCount > limit) {
    const elapsed = now - existing.windowStart;
    return {
      ok: false,
      retryAfterMs: Math.max(0, windowMs - elapsed),
    };
  }

  return { ok: true };
}
