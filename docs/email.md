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
| Value | Use | Notes |
|---|---|---|
| `outbox` (default) | Local development and tests | Writes each message as JSON to `MAIL_OUTBOX_DIR` (default `.mail-outbox/`, git-ignored). Nothing is sent. The end-to-end tests read the links from there. **Refused when `DEPLOYMENT=public`.** |
| `disabled` | Any environment without mail | Sending fails: registration still works, *resend* shows "could not be sent", and *forgot password* shows its generic answer. |

**Real delivery (not configured; needs approval):** add one transport in `src/server/mail.ts` (SMTP through a small, maintained library, or a provider's HTTPS API) that reads its credentials only from server environment variables, for example `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`. The sending domain needs SPF, DKIM and DMARC. No provider was chosen and no credentials exist in the repository.

## Failure behaviour (tested)
- **Mail unavailable:** registration succeeds and the banner offers a resend; *forgot password* still gives the generic answer. Every failure is logged as `mail_failed` without the address or the link.
- **Database unavailable:** the forms show the generic translated error (see `docs/testing.md`).
