// Shared connection settings for the database scripts. Local SQL Server only.
// Values come from .env.local (loaded with `node --env-file`). Never print the password.

export const LOCAL_DB_NAME = "FirstSteps_Dev";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];
const REQUIRED = ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"];

export function loadDbConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")} (run npm run db:local:setup)`);
  }
  if (!LOCAL_HOSTS.includes(process.env.DB_SERVER.toLowerCase())) {
    throw new Error("DB_SERVER must be a local address. Remote servers are not allowed.");
  }
  if (process.env.DB_NAME !== LOCAL_DB_NAME) {
    throw new Error(`DB_NAME must be ${LOCAL_DB_NAME}.`);
  }

  return {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true",
      abortTransactionOnError: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

// Runs `work` inside a transaction that is always rolled back.
export async function withReadOnlySession(sql, work) {
  const config = loadDbConfig();
  console.log(`Target: ${config.server}:${config.port} / [${config.database}] as ${config.user}`);

  const pool = await sql.connect(config);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const request = () => new sql.Request(tx);
    const { recordset } = await request().query("SELECT DB_NAME() AS CurrentDatabase");
    if (recordset[0].CurrentDatabase !== LOCAL_DB_NAME) {
      throw new Error(`Connected to [${recordset[0].CurrentDatabase}], expected [${LOCAL_DB_NAME}].`);
    }
    return await work(request);
  } finally {
    await tx.rollback();
    await pool.close();
  }
}
