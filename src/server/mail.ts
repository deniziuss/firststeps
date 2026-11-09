import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { log, logError } from "./log";

/**
 * Email delivery behind one function, so the transport can change without touching the flows.
 *
 * Transports (MAIL_TRANSPORT):
 * - "outbox" (development and tests): every message is written as a JSON file to MAIL_OUTBOX_DIR
 *   (default .mail-outbox, git-ignored). Nothing leaves the machine. Not allowed when
 *   DEPLOYMENT=public (env.ts refuses it).
 * - "disabled": sending fails; the flows show their generic messages.
 * A real provider (SMTP or an email API) is a later, approved step; see docs/email.md. It would be
 * added here as one more transport, configured only through server environment variables.
 */
export type MailMessage = { to: string; subject: string; text: string };

export class MailUnavailableError extends Error {
  constructor() {
    super("Mail transport unavailable");
    this.name = "MailUnavailableError";
  }
}

export async function sendMail(message: MailMessage, kind: string): Promise<void> {
  const config = env();
  try {
    if (config.MAIL_TRANSPORT === "disabled") throw new MailUnavailableError();
    const dir = path.resolve(config.MAIL_OUTBOX_DIR);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${randomBytes(4).toString("hex")}.json`);
    await writeFile(file, JSON.stringify({ from: config.MAIL_FROM, ...message, createdAt: new Date().toISOString() }, null, 2), { flag: "wx" });
    // The recipient and the body (which contains the link) are not logged.
    void log("info", "mail", "mail_sent", { kind, transport: config.MAIL_TRANSPORT });
  } catch (error) {
    logError("mail_failed", error, { kind, transport: config.MAIL_TRANSPORT }, "mail");
    throw error instanceof MailUnavailableError ? error : new MailUnavailableError();
  }
}

/** Absolute link for emails, always built from APP_URL (never from the request Host header). */
export function appLink(pathname: string) {
  return new URL(pathname, env().APP_URL).toString();
}
