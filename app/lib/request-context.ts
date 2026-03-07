import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';

type RequestMetricsMeta = {
  route: string;
  method: string;
  requestScope?: boolean;
};

type RequestMetricsSummary = {
  route: string;
  method: string;
  totalQueryCount: number;
  chosenEnvVar: string;
};

type RequestQueryLog = {
  route: string;
  method: string;
  label: string;
  durationMs: number;
};

type RequestMetricsStore = RequestMetricsMeta & {
  queryCount: number;
  warned: boolean;
  finalized: boolean;
  chosenEnvVar: string | null;
  cache: Map<string, Promise<unknown>>;
};

const QUERY_WARNING_THRESHOLD = 50;

const requestMetricsStorage = new AsyncLocalStorage<RequestMetricsStore>();

export const __testHooks = {
  summaries: [] as RequestMetricsSummary[],
  queryLogs: [] as RequestQueryLog[],
  reset() {
    this.summaries = [];
    this.queryLogs = [];
  },
};

function normalizeRoute(value: string | null | undefined) {
  const route = value?.trim();
  return route ? route : 'unknown';
}

function normalizeMethod(value: string | null | undefined) {
  const method = value?.trim().toUpperCase();
  return method ? method : 'GET';
}

function createStore(meta?: Partial<RequestMetricsMeta>): RequestMetricsStore {
  return {
    route: normalizeRoute(meta?.route),
    method: normalizeMethod(meta?.method),
    requestScope: meta?.requestScope === true,
    queryCount: 0,
    warned: false,
    finalized: false,
    chosenEnvVar: null,
    cache: new Map(),
  };
}

async function ensureRequestMetricsStore(meta?: Partial<RequestMetricsMeta>) {
  const existingStore = requestMetricsStorage.getStore();
  if (existingStore) {
    if (meta?.route) {
      existingStore.route = normalizeRoute(meta.route);
    }
    if (meta?.method) {
      existingStore.method = normalizeMethod(meta.method);
    }
    if (meta?.requestScope === true) {
      existingStore.requestScope = true;
    }
    return existingStore;
  }

  const store = createStore(meta);
  requestMetricsStorage.enterWith(store);
  return store;
}

function logRequestSummary(store: RequestMetricsStore) {
  const chosenEnvVar = store.chosenEnvVar ?? 'unknown';
  console.info(
    `[db][request] route=${store.route} method=${store.method} total_query_count=${store.queryCount} chosen_env_var=${chosenEnvVar}`,
  );
  if (process.env.NODE_ENV === 'test') {
    __testHooks.summaries.push({
      route: store.route,
      method: store.method,
      totalQueryCount: store.queryCount,
      chosenEnvVar,
    });
  }
}

export function finalizeRequestMetrics() {
  const store = requestMetricsStorage.getStore();
  if (!store || store.finalized) {
    return;
  }

  store.finalized = true;
  logRequestSummary(store);
}

export async function recordDbQueryExecution(chosenEnvVar: string) {
  const store = await ensureRequestMetricsStore();
  store.queryCount += 1;
  store.chosenEnvVar = chosenEnvVar;

  if (!store.warned && store.queryCount > QUERY_WARNING_THRESHOLD) {
    store.warned = true;
    console.warn(
      `[db][request_warn] route=${store.route} method=${store.method} total_query_count=${store.queryCount}`,
    );
  }
}

export async function setRequestMetricsMeta(meta: Partial<RequestMetricsMeta>) {
  await ensureRequestMetricsStore(meta);
}

export function getRequestMetricsMeta(): RequestMetricsMeta {
  const store = requestMetricsStorage.getStore();
  return {
    route: normalizeRoute(store?.route),
    method: normalizeMethod(store?.method),
    requestScope: store?.requestScope === true,
  };
}

export function hasRequestScope(): boolean {
  return requestMetricsStorage.getStore()?.requestScope === true;
}

export function recordRequestQueryLog(label: string, durationMs: number) {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  const meta = getRequestMetricsMeta();
  __testHooks.queryLogs.push({
    route: meta.route,
    method: meta.method,
    label,
    durationMs,
  });
}

export async function getRequestCachedValue<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<T> {
  const store = await ensureRequestMetricsStore();
  const cached = store.cache.get(key);
  if (cached) {
    return cached as Promise<T>;
  }

  const promise = loader().catch((error) => {
    store.cache.delete(key);
    throw error;
  });
  store.cache.set(key, promise as Promise<unknown>);
  return promise;
}

export async function runWithRequestMetrics<T>(
  meta: RequestMetricsMeta,
  fn: () => Promise<T>,
): Promise<T> {
  return requestMetricsStorage.run(createStore(meta), async () => {
    try {
      return await fn();
    } finally {
      finalizeRequestMetrics();
    }
  });
}
