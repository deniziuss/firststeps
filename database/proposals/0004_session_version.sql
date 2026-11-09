/*
  PROPOSAL 0004 — server-side session revocation (NOT APPLIED; requires approval)

  Problem: sign-out revocation is kept in the memory of the Next.js process (src/server/session.ts).
  It is complete for the single-process local deployment, but it is lost on restart and not shared
  between several instances. Password changes are already enforced through the database (a keyed
  fingerprint of PasswordHash is part of the token).

  Change: one column on dbo.Users. The session token carries the version it was issued with; the
  application rejects a token whose version differs, and sign-out / "sign out everywhere" /
  deactivation increment the version. No data is changed; existing rows start at 0.

  Apply only to the local FirstSteps_Dev first. The course database is a separate, manual decision.
*/
IF COL_LENGTH(N'dbo.Users', N'SessionVersion') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD SessionVersion INT NOT NULL CONSTRAINT DF_Users_SessionVersion DEFAULT 0;
END;
GO
