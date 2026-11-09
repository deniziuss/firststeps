// Scans server log files for data that must never be logged. Prints only counts and pattern names,
// never the matched text. Exit code 1 when anything is found.
// Usage: node scripts/scan-logs.mjs <log file>...
import { readFileSync } from "node:fs";

const PATTERNS = {
  "email address": /[\w.+-]+@[\w-]+(\.[\w-]+)+/g,
  "argon2 password hash": /\$argon2(id|i|d)\$/g,
  "verification or reset link token": /\/(verify-email|reset-password)\/[A-Za-z0-9_-]{43}/g,
  "session cookie": /fs_session=/g,
  "JWT": /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./g,
  "database password variable": /DB_PASSWORD=|SESSION_SECRET=/g,
  "connection string": /(Password|Pwd)\s*=\s*[^;\s]+/gi,
};

let found = 0;
let lines = 0;
for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  lines += text.split("\n").length;
  for (const [name, pattern] of Object.entries(PATTERNS)) {
    const count = (text.match(pattern) ?? []).length;
    if (count) {
      console.log(`FOUND ${count}x ${name} in ${file}`);
      found += count;
    }
  }
}
console.log(found ? `${found} sensitive matches in ${lines} lines` : `clean: ${lines} lines scanned, no sensitive data`);
process.exitCode = found ? 1 : 0;
