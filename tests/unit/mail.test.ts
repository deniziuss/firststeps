import { createServer, type Server } from "node:net";
import nodemailer from "nodemailer";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { createTranslator } from "@/i18n/translator";
import { isTransientMailError, sendWithRetry, smtpOptions, type Sender } from "@/server/mail";
import { renderAccountEmail } from "@/server/mail-templates";

// A minimal SMTP server on localhost (no TLS, test only): it records messages and can answer the
// first MAIL FROM with a temporary (421) or permanent (550) error.
function fakeSmtp(mode: "ok" | "transientOnce" | "permanent") {
  const received: string[] = [];
  let failures = 0;
  const server: Server = createServer((socket) => {
    let data = false;
    let buffer = "";
    socket.write("220 fake ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (data) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end < 0) return;
        received.push(buffer.slice(0, end));
        buffer = buffer.slice(end + 5);
        data = false;
        socket.write("250 2.0.0 queued as TEST1\r\n");
      }
      let line: number;
      while (!data && (line = buffer.indexOf("\r\n")) >= 0) {
        const command = buffer.slice(0, line).toUpperCase();
        buffer = buffer.slice(line + 2);
        if (command.startsWith("EHLO")) socket.write("250-fake\r\n250 8BITMIME\r\n");
        else if (command.startsWith("MAIL FROM")) {
          if (mode === "permanent") socket.write("550 5.1.0 rejected\r\n");
          else if (mode === "transientOnce" && failures++ === 0) socket.write("421 4.3.2 try again later\r\n");
          else socket.write("250 OK\r\n");
        } else if (command.startsWith("RCPT TO")) socket.write("250 OK\r\n");
        else if (command === "DATA") {
          data = true;
          socket.write("354 go ahead\r\n");
        } else if (command === "QUIT") socket.end("221 bye\r\n");
        else if (command === "RSET") socket.write("250 OK\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  return new Promise<{ port: number; received: string[]; server: Server }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as { port: number }).port, received, server })),
  );
}

let servers: Server[] = [];
afterEach(() => {
  for (const server of servers) server.close();
  servers = [];
});

async function senderFor(mode: "ok" | "transientOnce" | "permanent") {
  const smtp = await fakeSmtp(mode);
  servers.push(smtp.server);
  const options = smtpOptions({ SMTP_HOST: "127.0.0.1", SMTP_PORT: smtp.port, SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "false", SMTP_USER: undefined, SMTP_PASSWORD: undefined });
  // Each attempt opens a new connection, like a real retry after a dropped session.
  const sender: Sender = async (message) => {
    const transport = nodemailer.createTransport(options);
    try {
      return { messageId: (await transport.sendMail(message)).messageId };
    } finally {
      transport.close();
    }
  };
  return { sender, received: smtp.received };
}

const t = createTranslator("en", en).t;
const message = { from: "FirstSteps <no-reply@firststeps.invalid>", to: "student@example.invalid", ...renderAccountEmail("verify", t, "en", { name: "Ada", link: "https://firststeps.example/verify-email/AAAA" }) };
const noSleep = async () => undefined;

describe("SMTP transport (local test server)", () => {
  it("requires TLS and certificate checks in the default configuration", () => {
    const options = smtpOptions({ SMTP_HOST: "smtp.example", SMTP_PORT: 587, SMTP_SECURE: "false", SMTP_REQUIRE_TLS: "true", SMTP_USER: "u", SMTP_PASSWORD: "p" });
    expect(options.requireTLS).toBe(true);
    expect(options.tls).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true });
    expect(options.connectionTimeout).toBeGreaterThan(0);
    expect(smtpOptions({ SMTP_HOST: "smtp.example", SMTP_PORT: 465, SMTP_SECURE: "true", SMTP_REQUIRE_TLS: "true", SMTP_USER: undefined, SMTP_PASSWORD: undefined }).secure).toBe(true);
  });

  it("delivers a multipart message with text and HTML", async () => {
    const { sender, received } = await senderFor("ok");
    const result = await sendWithRetry(sender, message, noSleep);
    expect(result.attempts).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0]).toContain("multipart/alternative");
    expect(received[0]).toContain("Confirm your FirstSteps email address");
  });

  it("retries a temporary failure and then succeeds", async () => {
    const { sender, received } = await senderFor("transientOnce");
    const result = await sendWithRetry(sender, message, noSleep);
    expect(result.attempts).toBe(2);
    expect(received).toHaveLength(1);
  });

  it("does not retry a permanent failure", async () => {
    const { sender } = await senderFor("permanent");
    await expect(sendWithRetry(sender, message, noSleep)).rejects.toMatchObject({ responseCode: 550 });
    expect(isTransientMailError({ responseCode: 550 })).toBe(false);
    expect(isTransientMailError({ responseCode: 421 })).toBe(true);
    expect(isTransientMailError({ code: "ECONNREFUSED" })).toBe(true);
  });
});

describe("account email templates", () => {
  it("renders English and Turkish with the link in both the text and the HTML", () => {
    for (const [locale, messages, subject] of [
      ["en", en, "Reset your FirstSteps password"],
      ["tr", tr, "FirstSteps şifreni sıfırla"],
    ] as const) {
      const translate = createTranslator(locale, messages).t;
      const email = renderAccountEmail("reset", translate, locale, { name: "Elif", link: "https://firststeps.example/reset-password/BBBB", minutes: 30 });
      expect(email.subject).toBe(subject);
      expect(email.text).toContain("https://firststeps.example/reset-password/BBBB");
      expect(email.html).toContain('href="https://firststeps.example/reset-password/BBBB"');
      expect(email.html).toContain(`lang="${locale}"`);
      expect(email.html).toContain("30");
    }
  });

  it("escapes names and has a distinct resend message", () => {
    const email = renderAccountEmail("verifyResend", t, "en", { name: '<img src=x onerror="x">', link: "https://firststeps.example/verify-email/CCCC" });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
    expect(email.subject).toBe("Your new FirstSteps confirmation link");
  });
});
