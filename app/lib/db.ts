import 'server-only';
import postgres from 'postgres';

const globalForDb = globalThis as unknown as {
  __latelessSql?: ReturnType<typeof postgres>;
};

const poolMaxRaw = process.env.POSTGRES_POOL_MAX;
const poolMax = Number(poolMaxRaw);
const maxConnections =
  Number.isFinite(poolMax) && poolMax > 0 ? Math.floor(poolMax) : 10;

function createSqlClient() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL');
  }

  return postgres(connectionString, {
    ssl: 'require',
    prepare: false,
    max: maxConnections,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export const sql = globalForDb.__latelessSql ?? createSqlClient();

if (!globalForDb.__latelessSql) {
  globalForDb.__latelessSql = sql;
}
