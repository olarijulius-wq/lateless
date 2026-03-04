import 'server-only';
import dns from 'node:dns';
import postgres from 'postgres';

const globalForDb = globalThis as unknown as {
  __latelessSql?: ReturnType<typeof postgres>;
  __latelessDbBootLogged?: boolean;
  __latelessDbConfig?: DbConfig;
  __latelessDbInitPromise?: Promise<void>;
  __latelessDbDnsLookupCache?: Map<string, Promise<void>>;
  __latelessDbDnsErrorLogged?: Set<string>;
};

const poolMaxRaw = process.env.POSTGRES_POOL_MAX;
const poolMax = Number(poolMaxRaw);
const maxConnections =
  Number.isFinite(poolMax) && poolMax > 0 ? Math.floor(poolMax) : 10;

type DbSourceEnvVar =
  | 'POSTGRES_URL_TEST'
  | 'POSTGRES_URL_POOLER'
  | 'POSTGRES_URL'
  | 'DATABASE_URL';

export function isPoolerUrl(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return (
      parsed.hostname.toLowerCase().includes('pooler') ||
      parsed.port === '6543'
    );
  } catch {
    return false;
  }
}

type DbConfig = {
  connectionString: string;
  sourceEnvVar: DbSourceEnvVar;
  ssl: false | 'require';
  host: string;
  urlHasSslmode: boolean;
};

type DbDnsFailureDetails = {
  host: string;
  sourceEnvVar: DbSourceEnvVar;
  fallbackAvailable: boolean;
};

const DB_DNS_LOGIN_MESSAGE =
  'Database connection misconfigured (DNS). Contact support or check server env.';

export class DbDnsResolutionError extends Error {
  readonly host: string;
  readonly sourceEnvVar: DbSourceEnvVar;

  constructor({ host, sourceEnvVar }: { host: string; sourceEnvVar: DbSourceEnvVar }) {
    super(`DB host cannot be resolved. Check POSTGRES_URL / DNS / VPN. Host=${host}.`);
    this.name = 'DbDnsResolutionError';
    this.host = host;
    this.sourceEnvVar = sourceEnvVar;
  }

  get userMessage() {
    return `${DB_DNS_LOGIN_MESSAGE} Host=${this.host}.`;
  }
}

export function isDbDnsResolutionError(error: unknown): error is DbDnsResolutionError {
  return error instanceof DbDnsResolutionError;
}

function resolveHostname(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
}

export function resolveSslMode(connectionString: string): false | 'require' {
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    return false;
  }

  if (process.env.LATELLESS_TEST_MODE === '1') {
    return false;
  }

  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  if (process.env.PGSSLMODE?.toLowerCase() === 'disable') {
    return false;
  }

  const hostname = resolveHostname(connectionString);
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return false;
  }

  return 'require';
}

function hasSslQueryParam(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    return parsed.searchParams.has('sslmode') || parsed.searchParams.has('ssl');
  } catch {
    return false;
  }
}

function sanitizeConnectionStringForNoSsl(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('ssl');
    parsed.searchParams.delete('sslrootcert');
    parsed.searchParams.delete('sslcert');
    parsed.searchParams.delete('sslkey');
    parsed.searchParams.delete('sslpassword');
    parsed.searchParams.delete('options');
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

function isTruthy(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

function shouldPreferPoolerUrl() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.LATELLESS_TEST_MODE === '1'
  );
}

export function resolveDbSourcePriority(): DbSourceEnvVar[] {
  const isTestMode =
    process.env.LATELLESS_TEST_MODE === '1' || process.env.NODE_ENV === 'test';

  const priority: DbSourceEnvVar[] = [];
  if (isTestMode && isTruthy(process.env.POSTGRES_URL_TEST)) {
    priority.push('POSTGRES_URL_TEST');
  }

  if (shouldPreferPoolerUrl() && isTruthy(process.env.POSTGRES_URL_POOLER)) {
    priority.push('POSTGRES_URL_POOLER');
  }

  if (isTruthy(process.env.POSTGRES_URL)) {
    priority.push('POSTGRES_URL');
  }

  if (isTruthy(process.env.DATABASE_URL)) {
    priority.push('DATABASE_URL');
  }

  return priority;
}

function buildDbConfig(sourceEnvVar: DbSourceEnvVar, connectionStringRaw: string): DbConfig {
  const trimmedRaw = connectionStringRaw.trim();
  const ssl = resolveSslMode(trimmedRaw);
  const connectionString =
    ssl === false
      ? sanitizeConnectionStringForNoSsl(trimmedRaw)
      : trimmedRaw;
  const host = resolveHostname(connectionString);
  const urlHasSslmode = hasSslQueryParam(trimmedRaw);

  return {
    connectionString,
    sourceEnvVar,
    ssl,
    host,
    urlHasSslmode,
  };
}

export function resolveDbConnectionCandidates(): DbConfig[] {
  const priority = resolveDbSourcePriority();
  const seen = new Set<string>();
  const candidates: DbConfig[] = [];

  for (const sourceEnvVar of priority) {
    const raw = process.env[sourceEnvVar];
    if (typeof raw !== 'string' || raw.trim() === '') continue;
    const trimmedRaw = raw.trim();
    if (seen.has(trimmedRaw)) continue;
    seen.add(trimmedRaw);
    candidates.push(buildDbConfig(sourceEnvVar, trimmedRaw));
  }

  if (candidates.length === 0) {
    throw new Error(
      'Missing POSTGRES_URL_TEST, POSTGRES_URL_POOLER, POSTGRES_URL, or DATABASE_URL',
    );
  }

  return candidates;
}

export function resolveDbConnectionConfig(): DbConfig {
  return resolveDbConnectionCandidates()[0];
}

function logBootOnce(dbConfig: DbConfig) {
  if (globalForDb.__latelessDbBootLogged) return;
  globalForDb.__latelessDbBootLogged = true;
  const message = `[db][boot] env=${process.env.NODE_ENV ?? ''} ci=${process.env.CI ?? ''} gha=${process.env.GITHUB_ACTIONS ?? ''} test_mode=${process.env.LATELLESS_TEST_MODE ?? ''} source=${dbConfig.sourceEnvVar} host=${dbConfig.host} ssl=${dbConfig.ssl} url_has_sslmode=${dbConfig.urlHasSslmode}`;
  if (process.env.NODE_ENV === 'development') {
    console.log(message);
    return;
  }
  console.info(message);
}

function logDnsErrorOnce(details: DbDnsFailureDetails) {
  if (!globalForDb.__latelessDbDnsErrorLogged) {
    globalForDb.__latelessDbDnsErrorLogged = new Set();
  }
  const key = `${details.sourceEnvVar}:${details.host}`;
  if (globalForDb.__latelessDbDnsErrorLogged.has(key)) return;
  globalForDb.__latelessDbDnsErrorLogged.add(key);
  console.error('[db][dns_error]', {
    host: details.host,
    source: details.sourceEnvVar,
    fallback_available: details.fallbackAvailable,
    error: 'ENOTFOUND',
  });
}

function isDnsNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOTFOUND'
  );
}

async function lookupHostnameOnce(hostname: string): Promise<void> {
  if (!hostname || hostname === 'unknown') return;
  if (!globalForDb.__latelessDbDnsLookupCache) {
    globalForDb.__latelessDbDnsLookupCache = new Map();
  }
  const cache = globalForDb.__latelessDbDnsLookupCache;
  const existing = cache.get(hostname);
  if (existing) {
    await existing;
    return;
  }

  const lookupPromise = dns.promises.lookup(hostname).then(() => undefined);
  cache.set(hostname, lookupPromise);
  await lookupPromise;
}

function createClientForConfig(dbConfig: DbConfig) {
  const disablePreparedStatements = isPoolerUrl(dbConfig.connectionString);
  const clientSsl = dbConfig.ssl === false ? false : 'require';

  return postgres(dbConfig.connectionString, {
    ssl: clientSsl,
    prepare: disablePreparedStatements ? false : undefined,
    max: maxConnections,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

async function ensureDnsPreflight(): Promise<void> {
  if (globalForDb.__latelessDbInitPromise) {
    await globalForDb.__latelessDbInitPromise;
    return;
  }

  const initPromise = (async () => {
    const candidates = resolveDbConnectionCandidates();
    const activeConfig = globalForDb.__latelessDbConfig ?? candidates[0];
    const fallbackConfig = candidates.find(
      (candidate) => candidate.sourceEnvVar !== activeConfig.sourceEnvVar,
    );

    try {
      await lookupHostnameOnce(activeConfig.host);
    } catch (error) {
      if (!isDnsNotFoundError(error)) {
        throw error;
      }

      if (fallbackConfig) {
        try {
          await lookupHostnameOnce(fallbackConfig.host);
          globalForDb.__latelessDbConfig = fallbackConfig;
          globalForDb.__latelessSql = createClientForConfig(fallbackConfig);
          const fallbackMessage = `[db][boot] fallback_used=true from=${activeConfig.sourceEnvVar} to=${fallbackConfig.sourceEnvVar} host=${activeConfig.host}`;
          if (process.env.NODE_ENV === 'development') {
            console.log(fallbackMessage);
          } else {
            console.info(fallbackMessage);
          }
          return;
        } catch (fallbackError) {
          if (!isDnsNotFoundError(fallbackError)) {
            throw fallbackError;
          }
          logDnsErrorOnce({
            host: fallbackConfig.host,
            sourceEnvVar: fallbackConfig.sourceEnvVar,
            fallbackAvailable: true,
          });
          throw new DbDnsResolutionError({
            host: fallbackConfig.host,
            sourceEnvVar: fallbackConfig.sourceEnvVar,
          });
        }
      }

      logDnsErrorOnce({
        host: activeConfig.host,
        sourceEnvVar: activeConfig.sourceEnvVar,
        fallbackAvailable: false,
      });
      throw new DbDnsResolutionError({
        host: activeConfig.host,
        sourceEnvVar: activeConfig.sourceEnvVar,
      });
    }
  })();

  globalForDb.__latelessDbInitPromise = initPromise;
  await initPromise;
}

function createSqlClient() {
  const dbConfig = resolveDbConnectionConfig();
  globalForDb.__latelessDbConfig = dbConfig;
  logBootOnce(dbConfig);
  return createClientForConfig(dbConfig);
}

function getOrCreateSqlClient() {
  if (!globalForDb.__latelessSql) {
    globalForDb.__latelessSql = createSqlClient();
  }

  return globalForDb.__latelessSql;
}

const SQL_SYNTAX_LOG_LIMIT = 400;

function shouldLogSqlSyntaxError() {
  return process.env.DEBUG_SQL_ERRORS === '1';
}

function truncateForSingleLineLog(value: string, limit = SQL_SYNTAX_LOG_LIMIT): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= limit) {
    return singleLine;
  }
  return `${singleLine.slice(0, limit)}…`;
}

function extractSqlTextForSyntaxError(error: unknown, argArray: unknown[]): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'query' in error &&
    typeof (error as { query?: unknown }).query === 'string'
  ) {
    return (error as { query: string }).query;
  }

  if (typeof argArray[0] === 'string') {
    return argArray[0];
  }

  if (argArray[0] && typeof argArray[0] === 'object') {
    const keys = Object.keys(argArray[0] as Record<string, unknown>).slice(0, 8);
    return `[unavailable:first_arg_type=object keys=${keys.join(',') || '-'}]`;
  }

  return `[unavailable:first_arg_type=${typeof argArray[0]}]`;
}

function extractErrorPosition(error: unknown): number | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'position' in error
  ) {
    const position = Number((error as { position?: unknown }).position);
    if (Number.isFinite(position) && position > 0) {
      return Math.floor(position);
    }
  }
  return null;
}

function extractNearSqlPosition(sqlText: string, position: number | null): string {
  if (position === null) {
    return '[unavailable]';
  }
  const zeroBased = position - 1;
  if (zeroBased < 0 || zeroBased >= sqlText.length) {
    return '[out_of_range]';
  }
  const start = Math.max(0, zeroBased - 30);
  const end = Math.min(sqlText.length, zeroBased + 30);
  return truncateForSingleLineLog(sqlText.slice(start, end), 120);
}

function extractAppCallsiteFromStack(stack: string | undefined): string | null {
  if (!stack) {
    return null;
  }

  const appFrame = stack
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.includes('/app/') && !line.includes('/app/lib/db.ts'));

  return appFrame ?? null;
}

function isSyntaxError42601(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === '42601'
  );
}

function logSqlSyntaxError42601(error: unknown, argArray: unknown[], invocationStack: string | undefined) {
  if (!shouldLogSqlSyntaxError() || !isSyntaxError42601(error)) {
    return;
  }

  const sqlText = extractSqlTextForSyntaxError(error, argArray);
  const truncatedSqlText = truncateForSingleLineLog(sqlText);
  const position = extractErrorPosition(error);
  const near = extractNearSqlPosition(sqlText, position);
  const callsite =
    extractAppCallsiteFromStack(
      typeof error === 'object' && error !== null && 'stack' in error
        ? String((error as { stack?: unknown }).stack ?? '')
        : undefined,
    ) ?? extractAppCallsiteFromStack(invocationStack);

  console.error(`[db][sql_42601] ${truncatedSqlText}`);
  console.error(`[db][sql_42601_pos] position=${position ?? 'unknown'} near=${near}`);
  if (callsite) {
    console.error(`[db][sql_42601_stack] ${truncateForSingleLineLog(callsite, 400)}`);
  } else {
    console.error('[db][sql_42601_stack] [app_frame_unavailable]');
  }
}

function withSqlSyntaxErrorLogging<T>(
  argArray: unknown[],
  invocationStack: string | undefined,
  invoke: () => T,
): T {
  try {
    const result = invoke();
    if (
      result &&
      typeof (result as unknown as { then?: unknown }).then === 'function'
    ) {
      const promiseResult = result as unknown as Promise<unknown>;
      return promiseResult.catch((error) => {
        logSqlSyntaxError42601(error, argArray, invocationStack);
        throw error;
      }) as T;
    }
    return result;
  } catch (error) {
    logSqlSyntaxError42601(error, argArray, invocationStack);
    throw error;
  }
}

export const sql = new Proxy((() => undefined) as unknown as ReturnType<typeof postgres>, {
  apply(_target, thisArg, argArray) {
    const invocationStack = new Error().stack;
    return ensureDnsPreflight().then(() => {
      return withSqlSyntaxErrorLogging(argArray, invocationStack, () =>
        Reflect.apply(getOrCreateSqlClient() as unknown as Function, thisArg, argArray),
      );
    });
  },
  get(_target, property, receiver) {
    const client = getOrCreateSqlClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, property, receiver);
    if (typeof value !== 'function') {
      return value;
    }
    const bound = value.bind(client) as (...args: unknown[]) => unknown;
    const invokeWithLogging = (...args: unknown[]) => {
      const invocationStack = new Error().stack;
      return withSqlSyntaxErrorLogging(args, invocationStack, () => bound(...args));
    };
    if (
      property === 'begin' ||
      property === 'reserve' ||
      property === 'listen' ||
      property === 'notify' ||
      property === 'end'
    ) {
      return (...args: unknown[]) =>
        ensureDnsPreflight().then(() => invokeWithLogging(...args));
    };
    return invokeWithLogging;
  },
  set(_target, property, value, receiver) {
    const client = getOrCreateSqlClient() as unknown as Record<PropertyKey, unknown>;
    return Reflect.set(client, property, value, receiver);
  },
});
