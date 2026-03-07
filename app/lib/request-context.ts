import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { headers } from 'next/headers';

type RequestMetricsMeta = {
  route: string;
  method: string;
};

type RequestMetricsSummary = {
  route: string;
  method: string;
  totalQueryCount: number;
  chosenEnvVar: string;
};

type RequestMetricsStore = RequestMetricsMeta & {
  queryCount: number;
  warned: boolean;
  finalized: boolean;
  chosenEnvVar: string | null;
  cache: Map<string, Promise<unknown>>;
};

const REQUEST_ROUTE_HEADER = 'x-lateless-request-route';
const REQUEST_METHOD_HEADER = 'x-lateless-request-method';
const QUERY_WARNING_THRESHOLD = 50;

const requestMetricsStorage = new AsyncLocalStorage<RequestMetricsStore>();

export const __testHooks = {
  summaries: [] as RequestMetricsSummary[],
  reset() {
    this.summaries = [];
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
    queryCount: 0,
    warned: false,
    finalized: false,
    chosenEnvVar: null,
    cache: new Map(),
  };
}

async function resolveRequestMetaFromHeaders(): Promise<RequestMetricsMeta> {
  try {
    const requestHeaders = await headers();
    return {
      route: normalizeRoute(requestHeaders.get(REQUEST_ROUTE_HEADER)),
      method: normalizeMethod(requestHeaders.get(REQUEST_METHOD_HEADER)),
    };
  } catch {
    return {
      route: 'unknown',
      method: 'GET',
    };
  }
}

async function ensureRequestMetricsStore(meta?: Partial<RequestMetricsMeta>) {
  const existingStore = requestMetricsStorage.getStore();
  if (existingStore) {
    if (meta?.route && existingStore.route === 'unknown') {
      existingStore.route = normalizeRoute(meta.route);
    }
    if (meta?.method && existingStore.method === 'GET') {
      existingStore.method = normalizeMethod(meta.method);
    }
    return existingStore;
  }

  const resolvedMeta = meta ?? (await resolveRequestMetaFromHeaders());
  const store = createStore(resolvedMeta);
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
