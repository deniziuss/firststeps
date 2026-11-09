import "server-only";
import type { Locale } from "@/i18n/config";
import type { Translate } from "@/i18n/translator";

/**
 * Account emails in English and Turkish, as plain text and as simple HTML with the FirstSteps look
 * (deep forest, warm ivory, ochre accent). The HTML uses inline styles and tables only, works without
 * images, and contains the link both as a button and as text. Every dynamic value is HTML-escaped.
 */
export type AccountEmailKind = "verify" | "verifyResend" | "reset";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderAccountEmail(kind: AccountEmailKind, t: Translate, locale: Locale, vars: { name: string; link: string; hours?: number; minutes?: number }) {
  const subject = t(`email.${kind}.subject`);
  const text = t(`email.${kind}.text`, { name: vars.name, link: vars.link, hours: vars.hours ?? 24, minutes: vars.minutes ?? 30 });
  const button = t(`email.${kind}.button`);
  // Body paragraphs come from the text version, without the link line and the signature.
  const paragraphs = text
    .split("\n\n")
    .map((part) => part.trim())
    .filter((part) => part && !part.includes(vars.link) && part !== "FirstSteps");
  const link = escapeHtml(vars.link);
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#eeede4;color:#15261b;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eeede4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbfaf6;border:1px solid #dcd7c6;border-radius:14px 0 14px 14px;">
<tr><td style="background:#15261b;color:#eeede4;padding:20px 28px;border-radius:14px 0 0 0;font-size:18px;letter-spacing:-0.02em;">FirstSteps</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 16px;font-size:24px;font-weight:400;letter-spacing:-0.02em;color:#15261b;">${escapeHtml(subject)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3d4a40;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n")}
<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#15261b;color:#eeede4;text-decoration:none;padding:12px 20px;border-radius:3px;font-size:15px;">${escapeHtml(button)}</a></p>
<p style="margin:0 0 6px;font-size:13px;color:#5c5848;">${escapeHtml(t("email.linkHint"))}</p>
<p style="margin:0;font-size:13px;word-break:break-all;"><a href="${link}" style="color:#7a5a1f;">${link}</a></p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #dcd7c6;font-size:12px;line-height:1.5;color:#5c5848;">${escapeHtml(t("email.footer"))}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return { subject, text, html };
}
