import 'server-only';
import postgres from 'postgres';

const globalForDb = globalThis as unknown as {
  __latelessSql?: ReturnType<typeof postgres>;
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
};

function resolveSslMode(connectionString: string): false | 'require' {
  if (process.env.PGSSLMODE?.toLowerCase() === 'disable') {
    return false;
  }

  if (process.env.NODE_ENV === 'test') {
    try {
      const host = new URL(connectionString).hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return false;
      }
    } catch {
      // Fall through to default SSL requirement.
    }
  }

  return 'require';
}

export function resolveDbConnectionConfig(): DbConfig {
  const useTestUrl =
    process.env.NODE_ENV === 'test' &&
    typeof process.env.POSTGRES_URL_TEST === 'string' &&
    process.env.POSTGRES_URL_TEST.trim() !== '';
  const sourceEnvVar = useTestUrl
    ? 'POSTGRES_URL_TEST'
    : process.env.POSTGRES_URL
      ? 'POSTGRES_URL'
      : 'DATABASE_URL';
  const connectionString = process.env[sourceEnvVar];
  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL_TEST, POSTGRES_URL, or DATABASE_URL');
  }

  return {
    connectionString,
    sourceEnvVar,
    ssl: resolveSslMode(connectionString),
  };
}

function createSqlClient() {
  const { connectionString, ssl } = resolveDbConnectionConfig();
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
