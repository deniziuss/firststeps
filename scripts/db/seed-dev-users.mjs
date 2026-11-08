// Local development only: creates one synthetic Admin and one synthetic Mentor account in FirstSteps_Dev.
// Passwords are generated, hashed with argon2id and stored only in .env.local (never printed).
// Usage: npm run db:seed-users
import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import sql from "mssql";
import { loadDbConfig } from "./config.mjs";

const ACCOUNTS = [
  { key: "DEV_ADMIN", firstName: "Alex", lastName: "Admin", email: "admin@example.invalid", role: "Admin" },
  { key: "DEV_MENTOR", firstName: "Maria", lastName: "Mentor", email: "mentor@example.invalid", role: "Mentor" },
];

const envText = readFileSync(".env.local", "utf8");
const pool = await sql.connect(loadDbConfig());
try {
  for (const account of ACCOUNTS) {
    const existing = await pool.request().input("email", sql.NVarChar(255), account.email).query("SELECT UserID FROM dbo.Users WHERE Email = @email");
    if (existing.recordset.length > 0) {
      console.log(`${account.role} ${account.email} already exists.`);
      continue;
    }

    const password = randomBytes(18).toString("base64url");
    const result = await pool
      .request()
      .input("FirstName", sql.NVarChar(100), account.firstName)
      .input("LastName", sql.NVarChar(100), account.lastName)
      .input("Email", sql.NVarChar(255), account.email)
      .input("PasswordHash", sql.NVarChar(255), await hash(password))
      .output("NewUserID", sql.Int)
      .execute("dbo.usp_User_Insert");
    await pool
      .request()
      .input("id", sql.Int, result.output.NewUserID)
      .input("role", sql.NVarChar(20), account.role)
      .query("UPDATE dbo.Users SET UserRole = @role WHERE UserID = @id");

    if (!envText.includes(`${account.key}_EMAIL=`)) {
      appendFileSync(".env.local", `${account.key}_EMAIL=${account.email}\n${account.key}_PASSWORD=${password}\n`);
    }
    console.log(`Created ${account.role} ${account.email} (password saved in .env.local as ${account.key}_PASSWORD).`);
  }
} finally {
  await pool.close();
}
