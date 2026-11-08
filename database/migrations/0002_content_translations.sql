/* FirstSteps — 0002 content translations.
   English stays the source language in Task_Templates and Information_Sources. These tables hold
   translations; the application falls back to English when a translation is missing.
   Idempotent: creates only missing objects and never drops anything.
*/
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb') THROW 51000, 'Select the FirstSteps development database first.', 1;
GO

IF OBJECT_ID(N'dbo.Task_Template_Translations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Task_Template_Translations (
        TaskID INT NOT NULL,
        LanguageCode CHAR(2) NOT NULL,
        TaskTitle NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TaskTemplateTranslations_Updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_TaskTemplateTranslations PRIMARY KEY (TaskID, LanguageCode),
        CONSTRAINT FK_TaskTemplateTranslations_Task FOREIGN KEY (TaskID) REFERENCES dbo.Task_Templates(TaskID),
        CONSTRAINT CK_TaskTemplateTranslations_Language CHECK (LanguageCode IN ('tr'))
    );
END;
GO

-- Sources can be deleted by admins, so their translations go with them.
IF OBJECT_ID(N'dbo.Information_Source_Translations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Information_Source_Translations (
        SourceID INT NOT NULL,
        LanguageCode CHAR(2) NOT NULL,
        SourceTitle NVARCHAR(200) NOT NULL,
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SourceTranslations_Updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_SourceTranslations PRIMARY KEY (SourceID, LanguageCode),
        CONSTRAINT FK_SourceTranslations_Source FOREIGN KEY (SourceID) REFERENCES dbo.Information_Sources(SourceID) ON DELETE CASCADE,
        CONSTRAINT CK_SourceTranslations_Language CHECK (LanguageCode IN ('tr'))
    );
END;
GO
