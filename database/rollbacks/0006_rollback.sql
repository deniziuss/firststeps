/* ROLLBACK 0006: removes the security infrastructure. Revert the application code first.
   Data impact: rate-limit counters, outstanding verification/reset tokens, the EmailVerifiedAt values
   and the ADMIN AUDIT HISTORY are deleted. Export dbo.Admin_Audit_Events first if it must be kept. */
DROP PROCEDURE IF EXISTS dbo.usp_AdminAudit_Purge;
DROP TRIGGER IF EXISTS dbo.trg_AdminAuditEvents_AppendOnly;
DROP TABLE IF EXISTS dbo.Admin_Audit_Events;
DROP TABLE IF EXISTS dbo.Account_Tokens;
GO
IF COL_LENGTH(N'dbo.Users', N'EmailVerifiedAt') IS NOT NULL
    ALTER TABLE dbo.Users DROP COLUMN EmailVerifiedAt;
GO
DROP PROCEDURE IF EXISTS dbo.usp_RateLimit_Purge;
DROP PROCEDURE IF EXISTS dbo.usp_RateLimit_Reset;
DROP PROCEDURE IF EXISTS dbo.usp_RateLimit_Peek;
DROP PROCEDURE IF EXISTS dbo.usp_RateLimit_Hit;
DROP TABLE IF EXISTS dbo.Rate_Limit_Buckets;
GO
