# Email: verification and password reset

## What is implemented
| Feature | Behaviour |
|---|---|
| Verification on registration | A new student account starts **unverified**. A verification email is sent right after registration. The account works immediately, so onboarding and the journey are not blocked. |
| Restriction while unverified | A student cannot open help requests until the address is confirmed. This is checked on the server (`createHelpRequest`); the task page shows a notice instead of the form, and the dashboard shows a banner with *Send the link again*. |
| Verification page | `/verify-email/<token>` shows a **Confirm my email address** button. The token is used only when the button is pressed (a POST), so automatic link scanners in mail systems cannot use it up. |
| Resend | From the dashboard banner. Limit: 3 per hour per account. Sending a new link retires the older ones. |
| Forgot password | `/forgot-password`. Always shows the same answer, whether the address has an account, the request was rate-limited, or sending failed. Limits: 3 per hour per address and 10 per hour per client (behind a trusted proxy). |
| Reset | `/reset-password/<token>` with a new password and its confirmation (same rules as registration). In one transaction, the token is used up, the new password hash is stored, `SessionVersion` is incremented (signing out **every** device) and the address counts as verified. The user then signs in again. |
| Existing accounts | Accounts that existed before migration 0006 (seeded admin and mentor, earlier students) are backfilled as verified (`EmailVerifiedAt = CreatedAt`). |

## Tokens
- **Format:** 32 random bytes from `crypto.randomBytes`, sent as 43 base64url characters.
- **Storage:** only the SHA-256 hash is stored (`dbo.Account_Tokens.TokenHash`, unique). The raw token exists only in the email and is never logged or shown to administrators.
- **Lifetime:** verification 24 hours, reset 30 minutes.
- **Single use:** one atomic `UPDATE … WHERE UsedAt IS NULL AND ExpiresAt > now`. Two concurrent attempts with the same link cannot both succeed.
- **Removal:** tokens are deleted with their user (`ON DELETE CASCADE`).
- **Link base:** every link is built from `APP_URL`, never from the request `Host` header, so a forged host cannot redirect reset links (host-header poisoning).
- **Referrer:** both token pages send `Referrer-Policy: no-referrer`.

## Account states
```
registered (EmailVerifiedAt NULL) ── confirm link ──▶ verified
        │                                              ▲
        └── password reset via email ──────────────────┘   (reset also proves access to the address)
any state ── admin deactivates ──▶ inactive (cannot sign in; SessionVersion + 1 ends sessions)
```

## Transports (`MAIL_TRANSPORT`)
All sending goes through `sendMail()` in `src/server/mail.ts`; the flows never know the provider.

| Value | Use | Notes |
|---|---|---|
| `outbox` (default) | Local development and tests | Writes each message as JSON to `MAIL_OUTBOX_DIR` (default `.mail-outbox/`, git-ignored). Nothing is sent. The end-to-end tests read the links from there. **Refused when `DEPLOYMENT=public`.** |
| `smtp` | Any SMTP provider (nodemailer 10.2.1, MIT-0) | See below. **Implemented and verified against a local test SMTP server; requires configuration and an approved provider** |
| `disabled` | Any environment without mail | Sending fails: registration still works, *resend* shows "could not be sent", and *forgot password* shows its generic answer. |

**SMTP settings** (server environment only, validated at startup, never logged):

| Variable | Default | Meaning |
|---|---|---|
| `SMTP_HOST` | — (required for `smtp`) | Provider host |
| `SMTP_PORT` | 587 | 587 = submission with STARTTLS, 465 = implicit TLS |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (port 465) |
| `SMTP_USER`, `SMTP_PASSWORD` | — | Authentication; the password is required when a user is set |
| `SMTP_REQUIRE_TLS` | `true` | STARTTLS is mandatory; `false` exists only for a local test server and is refused with `DEPLOYMENT=public` |
| `MAIL_FROM` | `FirstSteps <no-reply@firststeps.invalid>` | Sender; must be on the authenticated domain |

**Transport security and reliability**
- TLS 1.2 or newer, certificate verified (`rejectUnauthorized: true`).
- Timeouts: connection 10 s, greeting 10 s, socket 20 s, so a hanging provider cannot hold a request.
- nodemailer's file and URL access are disabled (no attachments from paths).
- **Retry:** up to 3 attempts (backoff 0.5 s, 1.5 s) for temporary failures: connection errors and SMTP 4xx. Permanent failures (5xx, for example a rejected address) are not retried.
- **Logging:** `mail_sent` with kind, transport, attempts and the provider's message id, or `mail_failed` with the SMTP code. Never the recipient, subject, body or link.
- **Tests** (`tests/unit/mail.test.ts`, a fake SMTP server on localhost): TLS options, a multipart message delivered, retry after a 421, no retry after a 550.

## Templates
`src/server/mail-templates.ts` renders each email as plain text and HTML, in English or Turkish (the language the user was using):
- `verify` (registration), `verifyResend` (a new link; older links stop working), `reset`.
- HTML with inline styles and tables only, no images or remote content, so it looks right with images blocked. The FirstSteps colours, a button **and** the link as text, `lang` set, a footer saying why the email arrived and that FirstSteps never asks for passwords by email.
- Every dynamic value is HTML-escaped (tested with a name containing markup).

## Deliverability (to do with the chosen provider; nothing is configured)
For the sending domain (example `firststeps.example`):
- **SPF:** a TXT record that allows only the provider, for example `v=spf1 include:<provider-spf-domain> -all`.
- **DKIM:** the provider's public key as a TXT (or CNAME) record under its selector; sign every message.
- **DMARC:** start with `v=DMARC1; p=none; rua=mailto:dmarc@firststeps.example`, read the reports, then move to `p=quarantine` and `p=reject` once SPF and DKIM align.
- `MAIL_FROM` on the same domain, a reverse DNS name if the provider uses dedicated IPs, and a monitored reply address or a clear "do not reply" note.
- Transactional mail only (no newsletters) keeps the reputation clean; bounces (5xx) are logged as `mail_failed` and not retried.
## Failure behaviour (tested)
- **Mail unavailable:** registration succeeds and the banner offers a resend; *forgot password* still gives the generic answer. Every failure is logged as `mail_failed` without the address or the link.
- **Database unavailable:** the forms show the generic translated error (see `docs/testing.md`).
