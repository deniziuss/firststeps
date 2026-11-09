import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { env, type ServerEnv } from "./env";
import { log, logError } from "./log";

/**
 * Email delivery behind one function, so the flows never depend on a provider.
 *
 * Transports (MAIL_TRANSPORT):
 * - "outbox" (development and tests): JSON files in MAIL_OUTBOX_DIR (git-ignored). Nothing leaves the
 *   machine. Refused when DEPLOYMENT=public.
 * - "smtp": any SMTP provider. TLS is required (implicit TLS on 465 with SMTP_SECURE=true, otherwise
 *   STARTTLS is mandatory) and the server certificate is verified. Credentials come only from server
 *   environment variables and are never logged.
 * - "disabled": every send fails; the flows show their generic messages.
 *
 * Retries: up to 3 attempts for transient failures (connection problems, SMTP 4xx answers), with a
 * short backoff. Permanent failures (5xx, e.g. an invalid address) are not retried.
 * Logging: kind, transport, attempts, SMTP response code and the provider message id. Never the
 * recipient, the subject or the body (they contain one-time links).
 */
export type MailMessage = { to: string; subject: string; text: string; html?: string };

export class MailUnavailableError extends Error {
  constructor() {
    super("Mail transport unavailable");
    this.name = "MailUnavailableError";
  }
}

type SendResult = { messageId?: string };
export type Sender = (message: MailMessage & { from: string }) => Promise<SendResult>;

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 500, 1500];

export function isTransientMailError(error: unknown): boolean {
  const e = error as { responseCode?: number; code?: string } | null;
  if (typeof e?.responseCode === "number") return e.responseCode >= 400 && e.responseCode < 500;
  return ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNRESET", "ECONNREFUSED", "EDNS"].includes(e?.code ?? "");
}

/** Sends with retries; returns the number of attempts used. Exported for tests with a local SMTP server. */
export async function sendWithRetry(sender: Sender, message: MailMessage & { from: string }, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(BACKOFF_MS[attempt - 1]);
    try {
      const result = await sender(message);
      return { attempts: attempt, messageId: result.messageId };
    } catch (error) {
      lastError = error;
      if (!isTransientMailError(error)) break;
    }
  }
  throw Object.assign(lastError instanceof Error ? lastError : new Error("send failed"), { attempts: MAX_ATTEMPTS });
}

export function smtpOptions(config: Pick<ServerEnv, "SMTP_HOST" | "SMTP_PORT" | "SMTP_SECURE" | "SMTP_USER" | "SMTP_PASSWORD" | "SMTP_REQUIRE_TLS">) {
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE === "true",
    requireTLS: config.SMTP_SECURE !== "true" && config.SMTP_REQUIRE_TLS !== "false",
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? "" } : undefined,
    tls: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

let smtpTransport: Transporter | undefined;

function senderFor(config: ServerEnv): Sender {
  if (config.MAIL_TRANSPORT === "disabled") return async () => Promise.reject(new MailUnavailableError());
  if (config.MAIL_TRANSPORT === "smtp") {
    smtpTransport ??= nodemailer.createTransport(smtpOptions(config));
    return async (message) => {
      const info = await smtpTransport!.sendMail(message);
      return { messageId: info.messageId };
    };
  }
  return async (message) => {
    const dir = path.resolve(config.MAIL_OUTBOX_DIR);
    await mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ ...message, createdAt: new Date().toISOString() }, null, 2), { flag: "wx" });
    return { messageId: `outbox-${id}` };
  };
}

export async function sendMail(message: MailMessage, kind: string): Promise<void> {
  const config = env();
  try {
    const { attempts, messageId } = await sendWithRetry(senderFor(config), { from: config.MAIL_FROM, ...message });
    void log("info", "mail", "mail_sent", { kind, transport: config.MAIL_TRANSPORT, attempts, messageId });
  } catch (error) {
    const e = error as { responseCode?: number; attempts?: number };
    logError("mail_failed", error, { kind, transport: config.MAIL_TRANSPORT, attempts: e.attempts, responseCode: e.responseCode }, "mail");
    throw new MailUnavailableError();
  }
}

/** Absolute link for emails, always built from APP_URL (never from the request Host header). */
export function appLink(pathname: string) {
  return new URL(pathname, env().APP_URL).toString();
}
