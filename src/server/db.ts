import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import sql from "mssql";
import { env } from "./env";
import { log, logError } from "./log";
import { observeDb, type PoolStats } from "./metrics";

export { sql };

type Executor = sql.ConnectionPool | sql.Transaction;
type SqlType = sql.ISqlType | (() => sql.ISqlType);
export type Params = Record<string, [type: SqlType, value: unknown]>;

const globalForDb = globalThis as unknown as { firstStepsPool?: Promise<sql.ConnectionPool> };

function connect(): Promise<sql.ConnectionPool> {
  const config = env();
  const pool = new sql.ConnectionPool({
    server: config.DB_SERVER,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    options: {
      encrypt: config.DB_ENCRYPT === "true",
      trustServerCertificate: config.DB_TRUST_SERVER_CERT === "true",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    // Explicit limits: a stuck query fails with a generic message instead of hanging a request.
    connectionTimeout: 15000,
    requestTimeout: 15000,
  });
  return pool.connect().catch((error) => {
    // Not cached: the next request tries to connect again (recovers when the server is back).
    globalForDb.firstStepsPool = undefined;
    logError("db_connect_failed", error, { server: config.DB_SERVER, database: config.DB_NAME }, "db");
    throw error;
  });
}

// One pool per server process; reused across hot reloads in development.
export function getPool(): Promise<sql.ConnectionPool> {
  globalForDb.firstStepsPool ??= connect();
  return globalForDb.firstStepsPool;
}

/** Pool state for /api/metrics without opening a connection (undefined until the pool exists). */
export async function poolStats(): Promise<PoolStats> {
  const pending = globalForDb.firstStepsPool;
  if (!pending) return undefined;
  try {
    const pool = (await pending) as sql.ConnectionPool & { size: number; available: number; borrowed: number; pending: number };
    return { size: pool.size, available: pool.available, borrowed: pool.borrowed, pending: pool.pending };
  } catch {
    return undefined;
  }
}

function bind(request: sql.Request, params: Params) {
  for (const [name, [type, value]] of Object.entries(params)) {
    request.input(name, type, value);
  }
  return request;
}

// The transaction of the surrounding withTransaction() call, if any. Repository functions that are
// called inside one (for example an admin change together with its audit event) join it
// automatically, so the change and its audit record commit or roll back together.
const ambient = new AsyncLocalStorage<sql.Transaction>();

const SLOW_QUERY_MS = 500;

async function timed<T>(text: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  let ok = false;
  try {
    const result = await run();
    ok = true;
    return result;
  } finally {
    const ms = performance.now() - started;
    observeDb(ms, ok);
    // Only the start of the statement is logged, never parameter values.
    if (ms > SLOW_QUERY_MS) void log("warn", "perf", "slow_query", { ms: Math.round(ms), statement: text.replace(/\s+/g, " ").trim().slice(0, 80) });
  }
}

async function newRequest(executor?: Executor) {
  const target = executor ?? ambient.getStore() ?? (await getPool());
  return target instanceof sql.Transaction ? new sql.Request(target) : new sql.Request(target);
}

// Every query goes through these helpers: values are always bound as typed parameters.
export async function query<T>(text: string, params: Params = {}, executor?: Executor): Promise<T[]> {
  const request = bind(await newRequest(executor), params);
  const result = await timed(text, () => request.query<T>(text));
  return result.recordset ?? [];
}

export async function queryOne<T>(text: string, params: Params = {}, executor?: Executor): Promise<T | undefined> {
  return (await query<T>(text, params, executor))[0];
}

export async function execute(text: string, params: Params = {}, executor?: Executor): Promise<number> {
  const request = bind(await newRequest(executor), params);
  const result = await timed(text, () => request.query(text));
  return result.rowsAffected.reduce((sum, n) => sum + n, 0);
}

export async function procedure<T>(
  name: string,
  params: Params,
  outputs: Record<string, SqlType> = {},
  executor?: Executor,
) {
  const request = bind(await newRequest(executor), params);
  for (const [outName, type] of Object.entries(outputs)) request.output(outName, type);
  const result = await timed(name, () => request.execute<T>(name));
  return { rows: result.recordset ?? [], output: result.output };
}

const DEADLOCK_VICTIM = 1205;

function isDeadlock(error: unknown) {
  const e = error as { number?: number; originalError?: { info?: { number?: number } } } | null;
  return (e?.number ?? e?.originalError?.info?.number) === DEADLOCK_VICTIM;
}

// Runs the work in one transaction. If SQL Server chose it as a deadlock victim (1205), the whole
// transaction was rolled back, so it is safe to run it once more before reporting an error.
export async function withTransaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  // Nested call: join the outer transaction (its owner commits, rolls back and retries).
  const outer = ambient.getStore();
  if (outer) return work(outer);
  try {
    return await runTransaction(work);
  } catch (error) {
    if (!isDeadlock(error)) throw error;
    return runTransaction(work);
  }
}

async function runTransaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const result = await ambient.run(tx, () => work(tx));
    await tx.commit();
    return result;
  } catch (error) {
    // A THROW inside a trigger may already have rolled the transaction back.
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}
