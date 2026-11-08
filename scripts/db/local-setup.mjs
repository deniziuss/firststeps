// Sets up the local FirstSteps_Dev database on SQLEXPRESS (127.0.0.1:1433).
// - creates .env.local with generated secrets if it does not exist (values are never printed)
// - creates the database and the least-privilege app login (Windows authentication via sqlcmd)
// - applies every database/migrations/*.sql file in order (each one is idempotent)
// - applies synthetic content and runs the verification script
// Never drops or truncates anything.
// Usage: npm run db:local:setup
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env.local";
const MIGRATIONS = "database/migrations";
const SERVER = "tcp:127.0.0.1,1433";
const SQLCMD_CANDIDATES = ["sqlcmd", "C:\\Program Files\\SqlCmd\\sqlcmd.exe"];

function secret(bytes) {
  return randomBytes(bytes).toString("base64url");
}

function ensureEnvFile() {
  if (!existsSync(ENV_FILE)) {
    const content = [
      "DB_SERVER=127.0.0.1",
      "DB_PORT=1433",
      "DB_NAME=FirstSteps_Dev",
      "DB_USER=firststeps_app",
      // Suffix guarantees the SQL Server password policy (upper, lower, digit, symbol).
      `DB_PASSWORD=${secret(24)}Aa1-`,
      "DB_ENCRYPT=true",
      "DB_TRUST_SERVER_CERT=true",
      `SESSION_SECRET=${secret(32)}`,
      "",
    ].join("\n");
    writeFileSync(ENV_FILE, content, { encoding: "utf8", flag: "wx" });
    console.log(`Created ${ENV_FILE} with generated secrets.`);
  }
  const env = Object.fromEntries(
    readFileSync(ENV_FILE, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  if (!/^[A-Za-z0-9_-]+$/.test(env.DB_PASSWORD ?? "")) {
    throw new Error("DB_PASSWORD in .env.local may only contain letters, digits, '-' and '_'.");
  }
  return env;
}

function findSqlcmd() {
  for (const candidate of SQLCMD_CANDIDATES) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("sqlcmd not found. Install it with: winget install Microsoft.Sqlcmd");
}

function sqlcmd(bin, args) {
  return execFileSync(bin, ["-S", SERVER, "-E", "-C", "-b", ...args], { encoding: "utf8" });
}

try {
  const env = ensureEnvFile();
  const bin = findSqlcmd();

  sqlcmd(bin, ["-i", "database/local/00_create_database.sql", "-v", `APP_PASSWORD=${env.DB_PASSWORD}`]);
  console.log("Database and app login ready.");

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    sqlcmd(bin, ["-d", "FirstSteps_Dev", "-i", `${MIGRATIONS}/${file}`]);
    console.log(`Migration applied: ${file}`);
  }

  for (const file of ["02_seed_content.sql", "03_seed_translations.sql", "04_verify.sql"]) {
    console.log(sqlcmd(bin, ["-i", `database/local/${file}`, "-W"]));
  }
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  if (error.stdout) console.error(error.stdout);
  process.exitCode = 1;
}
