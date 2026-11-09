# Privacy: personal data, retention, export and deletion

This page describes what the code does. It is **not legal advice and not a statement of GDPR compliance**. The privacy notice at the end is a draft that the project owner must review and confirm before any public use.

## Personal data inventory

| Data | Where | Purpose | Who can see it | Retention (configurable) |
|---|---|---|---|---|
| First and last name, email | `Users` | Account, sign-in, emails | The student; mentors see the first name only on requests assigned to them; administrators (user list) | While the account exists; removed by anonymisation |
| Password hash (Argon2id) | `Users.PasswordHash` | Sign-in | Nobody (never shown, exported or logged) | Replaced by an unusable marker on anonymisation |
| Role, active flag, created, email confirmed | `Users` | Authorisation, verification | Administrators | While the account exists |
| Arrival date, programme, accommodation, home country, university | `Journeys` | Building the personal task list | The student; mentors see university, arrival date and programme on assigned requests | Home country removed on anonymisation; the rest kept without identity for statistics |
| Task status and dates | `Journey_Tasks` | Progress | The student; administrators in aggregated reports | Kept without identity after anonymisation |
| Help requests (subject, description, answer) | `Help_Requests` | Asynchronous help | The student, the assigned mentor, administrators | Text replaced by "[removed]" on anonymisation |
| One-time tokens (SHA-256 hash only) | `Account_Tokens` | Verification and reset | Nobody | Used or expired tokens removed after 7 days (`maintenance.mjs`); all removed with the account |
| Rate-limit counters (HMAC of email or address, no plain value) | `Rate_Limit_Buckets` | Abuse protection | Nobody | Removed after the window ends (minutes to an hour) |
| Admin audit events (admin id, action, entity, details) | `Admin_Audit_Events` | Accountability for admin changes | Administrators | At least 365 days (database rule), 730 by default |
| Application logs (user id, request id, event; no names, emails or secrets) | Server log files | Operations, security | Operators | 30 days (`rotate-logs.ps1`) |
| Database backups (everything above) | Backup folder | Recovery | Operators | 14 days, newest 3 always kept (`backup-dev.ps1`) |
| Language and theme preference | Browser cookie / local storage | Interface | The user's browser | Until changed |

No passports, visas, residence cards or other document scans are stored (project rule).

## Data export (implemented and verified)
**Settings → Your data → Download my data (JSON)** calls `GET /api/account/export`.
- **Authentication:** the same session checks as every page (session version, password fingerprint, active account). Without a session: 401.
- **Scope:** the data is selected only by the signed-in user's id; nothing from the request is used. It contains the profile, journeys, tasks and the student's own help requests with the answers. For mentors it contains the answers they wrote, without the student's identity. For administrators it contains the number of audit events.
- **Never included:** password hash, session data, token hashes, rate-limit records, other people's data.
- **Limit and logging:** 10 downloads per hour per account; each one is logged as `data_exported` (user id only).
- **Tests:** an E2E test downloads a student's file and checks that it holds that student's journey and tasks, no other student's email, and no hash or session field. CI checks the 401.

## Deletion requests: anonymisation (implemented and verified on FirstSteps_Test)
`scripts/privacy/anonymize-account.mjs` handles one **student** account per run. The default is a dry run that only prints counts.

```
node --env-file=.env.local scripts/privacy/anonymize-account.mjs --user 42                         # dry run
node --env-file=.env.local scripts/privacy/anonymize-account.mjs --user 42 --by 1 --apply --confirm 42
```

**Why anonymise and not `DELETE`:** journeys, tasks and help requests are linked without cascades, mentors' answers are part of their own history, and report counts must stay correct. All of the following happens in one serializable transaction:
- **User:** the name becomes "Deleted User" and the email `deleted-<id>@anonymized.invalid`. The password hash is replaced by an unusable marker, the account is deactivated, and `SessionVersion + 1` ends every session.
- **Data:** the journey's home country becomes NULL; subject, description and answer of the student's help requests become "[removed]".
- **Tokens and audit:** the user's tokens are deleted, and one append-only audit event `user_anonymize` is written for the administrator given with `--by`.

**Safeguards (each one tested):**
- mentors and administrators are refused;
- `--apply` without `--confirm <same id>` is refused, and so is a `--by` that is not an active administrator;
- `FirstSteps_Dev` needs `ANONYMIZE_ALLOW_DEV=1` (checked before connecting);
- a second run reports "already anonymised" and changes nothing.

Every refused run left the account unchanged.

**What anonymisation does not reach:**
- **Backups** keep the old values until they expire (14 days). A restored backup must be followed by re-running the anonymisations of the last 14 days. The audit log lists them (`user_anonymize`).
- **Application logs** keep the user id (never the name or email) until they expire (30 days).
- **Copies made outside the system** (exports the user downloaded, emails already delivered).

Accounts are never deleted or anonymised automatically. Every request is handled by an administrator.

## Privacy notice: DRAFT, requires owner confirmation
> **FirstSteps privacy notice (draft)**
>
> FirstSteps is an independent student project that helps international students prepare their arrival. It is not run by or affiliated with any university.
>
> **What we store:** your name and email address, a protected form of your password, the details you give for your arrival plan (university, arrival date, programme, accommodation, optionally your home country), your task progress, and the help requests you send.
>
> **Why:** to give you your personal task list, to let mentors answer your questions, and to keep your account secure.
>
> **Who sees it:** you; a mentor sees your first name and the request they are answering; administrators manage accounts and content. We do not sell or share your data and use no advertising or tracking cookies.
>
> **How long:** while you use your account. Security records expire automatically; backups are kept for 14 days.
>
> **Your choices:** you can download your data in Settings at any time. To delete your account, contact [contact address to be confirmed]. Your name and email are then removed and your requests are anonymised.
>
> **Contact:** [responsible person and contact address to be confirmed by the project owner].

Items the owner must decide or confirm: the responsible person and contact address, the legal basis, whether any data leaves the EU (hosting, email provider), and the final retention periods.
