import "server-only";
import { z } from "zod";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

/**
 * Server configuration, validated once at first use. The app refuses to start its database
 * connection with an invalid configuration, and the message names only the fields, never values.
 *
 * Databases: FirstSteps_Dev (developer data) or FirstSteps_Test (disposable copy / CI database).
 * Both must be on a local address; the school server can never be configured.
 *
 * DEPLOYMENT=public enables the production checks (HTTPS app URL, real mail transport, encrypted
 * and certificate-checked database connection, explicit proxy setting). Local builds, including
 * `next start` for the end-to-end tests, use DEPLOYMENT=local.
 */
const schema = z
  .object({
    DB_SERVER: z.string().refine((value) => LOCAL_HOSTS.includes(value.toLowerCase()), "DB_SERVER must be a local address"),
    DB_PORT: z.coerce.number().int().positive().default(1433),
    DB_NAME: z.enum(["FirstSteps_Dev", "FirstSteps_Test"]),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_ENCRYPT: z.enum(["true", "false"]).default("true"),
    DB_TRUST_SERVER_CERT: z.enum(["true", "false"]).default("false"),
    SESSION_SECRET: z.string().min(32),
    DEPLOYMENT: z.enum(["local", "public"]).default("local"),
    // Absolute base URL for links in emails. Never derived from the request Host header, so a forged
    // Host cannot redirect password-reset links to another site.
    APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
    MAIL_TRANSPORT: z.enum(["outbox", "smtp", "disabled"]).default("outbox"),
    // SMTP (MAIL_TRANSPORT=smtp). TLS is always used; SMTP_REQUIRE_TLS=false exists only for a local
    // test server and is refused in a public deployment.
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z.enum(["true", "false"]).default("false"),
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_REQUIRE_TLS: z.enum(["true", "false"]).default("true"),
    MAIL_FROM: z.string().min(3).default("FirstSteps <no-reply@firststeps.invalid>"),
    MAIL_OUTBOX_DIR: z.string().min(1).default(".mail-outbox"),
    TRUST_PROXY: z.enum(["true", "false"]).optional(),
  })
  .superRefine((value, ctx) => {
    const require = (ok: boolean, path: string, message: string) => ok || ctx.addIssue({ code: "custom", path: [path], message });
    if (value.MAIL_TRANSPORT === "smtp") {
      require(value.SMTP_HOST !== undefined, "SMTP_HOST", "is required when MAIL_TRANSPORT=smtp");
      require(value.SMTP_USER === undefined || value.SMTP_PASSWORD !== undefined, "SMTP_PASSWORD", "is required with SMTP_USER");
    }
    if (value.DEPLOYMENT !== "public") return;
    require(value.SMTP_REQUIRE_TLS === "true", "SMTP_REQUIRE_TLS", "TLS cannot be disabled in a public deployment");
    require(value.APP_URL.startsWith("https://"), "APP_URL", "must use https in a public deployment");
    require(value.MAIL_TRANSPORT !== "outbox", "MAIL_TRANSPORT", "the development outbox is not allowed in a public deployment");
    require(value.DB_ENCRYPT === "true", "DB_ENCRYPT", "must be true in a public deployment");
    require(value.DB_TRUST_SERVER_CERT === "false", "DB_TRUST_SERVER_CERT", "must be false in a public deployment");
    // Without a trusted proxy the client address is unknown and per-client rate limits cannot work.
    require(value.TRUST_PROXY === "true", "TRUST_PROXY", "a public deployment must run behind a trusted reverse proxy (TRUST_PROXY=true)");
  });

export type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | undefined;

export function parseEnv(source: Record<string, string | undefined>) {
  return schema.safeParse(source);
}

export function env(): ServerEnv {
  if (!cached) {
    const parsed = parseEnv(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      throw new Error(`Invalid server configuration (${fields}). See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
