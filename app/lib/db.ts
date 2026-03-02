import 'server-only';
import postgres from 'postgres';

const globalForDb = globalThis as unknown as {
  __latelessSql?: ReturnType<typeof postgres>;
  __latelessDbBootLogged?: boolean;
};

const poolMaxRaw = process.env.POSTGRES_POOL_MAX;
const poolMax = Number(poolMaxRaw);
const maxConnections =
  Number.isFinite(poolMax) && poolMax > 0 ? Math.floor(poolMax) : 10;

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
  sourceEnvVar: 'POSTGRES_URL_TEST' | 'POSTGRES_URL' | 'DATABASE_URL';
  ssl: false | 'require';
  host: string;
  urlHasSslmode: boolean;
};

function resolveHostname(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
}

export function resolveSslMode(connectionString: string): false | 'require' {
  void connectionString;

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
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

export function resolveDbConnectionConfig(): DbConfig {
  const isTestMode =
    process.env.LATELLESS_TEST_MODE === '1' || process.env.NODE_ENV === 'test';
  const useTestUrl =
    isTestMode &&
    typeof process.env.POSTGRES_URL_TEST === 'string' &&
    process.env.POSTGRES_URL_TEST.trim() !== '';
  const sourceEnvVar = useTestUrl
    ? 'POSTGRES_URL_TEST'
    : process.env.POSTGRES_URL
      ? 'POSTGRES_URL'
      : 'DATABASE_URL';
  const connectionStringRaw = process.env[sourceEnvVar];
  if (!connectionStringRaw) {
    throw new Error('Missing POSTGRES_URL_TEST, POSTGRES_URL, or DATABASE_URL');
  }

  const ssl = resolveSslMode(connectionStringRaw);
  const connectionString =
    ssl === false
      ? sanitizeConnectionStringForNoSsl(connectionStringRaw)
      : connectionStringRaw;
  const host = resolveHostname(connectionString);
  const urlHasSslmode = hasSslQueryParam(connectionStringRaw);

  return {
    connectionString,
    sourceEnvVar,
    ssl,
    host,
    urlHasSslmode,
  };
}

function createSqlClient() {
  const dbConfig = resolveDbConnectionConfig();
  if (!globalForDb.__latelessDbBootLogged) {
    globalForDb.__latelessDbBootLogged = true;
    console.error(
      `[db][boot] env=${process.env.NODE_ENV ?? ''} ci=${process.env.CI ?? ''} gha=${process.env.GITHUB_ACTIONS ?? ''} test_mode=${process.env.LATELLESS_TEST_MODE ?? ''} source=${dbConfig.sourceEnvVar} host=${dbConfig.host} ssl=${dbConfig.ssl} url_has_sslmode=${dbConfig.urlHasSslmode}`,
    );
  }

  const { connectionString, ssl } = dbConfig;
  const disablePreparedStatements = isPoolerUrl(connectionString);

  return postgres(connectionString, {
    ssl,
    prepare: disablePreparedStatements ? false : undefined,
    max: maxConnections,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

function getOrCreateSqlClient() {
  if (!globalForDb.__latelessSql) {
    globalForDb.__latelessSql = createSqlClient();
  }

  return globalForDb.__latelessSql;
}

export const sql = new Proxy((() => undefined) as unknown as ReturnType<typeof postgres>, {
  apply(_target, thisArg, argArray) {
    return Reflect.apply(getOrCreateSqlClient() as unknown as Function, thisArg, argArray);
  },
  get(_target, property, receiver) {
    const client = getOrCreateSqlClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set(_target, property, value, receiver) {
    const client = getOrCreateSqlClient() as unknown as Record<PropertyKey, unknown>;
    return Reflect.set(client, property, value, receiver);
  },
});
