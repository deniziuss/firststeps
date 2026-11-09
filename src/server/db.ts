import "server-only";
import sql from "mssql";
import { env } from "./env";

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
    globalForDb.firstStepsPool = undefined;
    throw error;
  });
}

// One pool per server process; reused across hot reloads in development.
export function getPool(): Promise<sql.ConnectionPool> {
  globalForDb.firstStepsPool ??= connect();
  return globalForDb.firstStepsPool;
}

function bind(request: sql.Request, params: Params) {
  for (const [name, [type, value]] of Object.entries(params)) {
    request.input(name, type, value);
  }
  return request;
}

async function newRequest(executor?: Executor) {
  const target = executor ?? (await getPool());
  return target instanceof sql.Transaction ? new sql.Request(target) : new sql.Request(target);
}

// Every query goes through these helpers: values are always bound as typed parameters.
export async function query<T>(text: string, params: Params = {}, executor?: Executor): Promise<T[]> {
  const result = await bind(await newRequest(executor), params).query<T>(text);
  return result.recordset ?? [];
}

export async function queryOne<T>(text: string, params: Params = {}, executor?: Executor): Promise<T | undefined> {
  return (await query<T>(text, params, executor))[0];
}

export async function execute(text: string, params: Params = {}, executor?: Executor): Promise<number> {
  const result = await bind(await newRequest(executor), params).query(text);
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
  const result = await request.execute<T>(name);
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
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (error) {
    // A THROW inside a trigger may already have rolled the transaction back.
    await tx.rollback().catch(() => undefined);
    throw error;
  }
}
