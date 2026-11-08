/* FirstSteps — 0001 initial schema (SQL Server 2016 SP1+).
   8 tables with PK/FK/UNIQUE/CHECK constraints, 4 indexes, 3 triggers, 5 stored procedures.
   Run against an empty development database, for example:
     sqlcmd -S tcp:127.0.0.1,1433 -E -C -b -d FirstSteps_Dev -i database/migrations/0001_initial_schema.sql
   Creates only missing tables and never drops anything.
*/
IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb') THROW 51000, 'Select the FirstSteps development database first.', 1;
GO

-- Tables ------------------------------------------------------------------
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        UserID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        UserRole NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_Role DEFAULT N'Student',
        IsActive BIT NOT NULL CONSTRAINT DF_Users_Active DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Users_Email UNIQUE (Email),
        CONSTRAINT CK_Users_Role CHECK (UserRole IN (N'Student',N'Mentor',N'Admin'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Universities', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Universities (
        UniversityID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Universities PRIMARY KEY,
        UniversityName NVARCHAR(200) NOT NULL,
        City NVARCHAR(100) NOT NULL,
        Country NVARCHAR(100) NOT NULL,
        CountryCode CHAR(2) NOT NULL,
        Website NVARCHAR(500) NULL,
        CONSTRAINT UQ_Universities_NameCity UNIQUE (UniversityName,City)
    );
END;
GO

IF OBJECT_ID(N'dbo.Journeys', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Journeys (
        JourneyID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Journeys PRIMARY KEY,
        UserID INT NOT NULL,
        UniversityID INT NOT NULL,
        ArrivalDate DATE NOT NULL,
        ProgramType NVARCHAR(20) NOT NULL,
        HomeCountryCode CHAR(2) NULL,
        AccommodationStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Journeys_Accommodation DEFAULT N'NotArranged',
        JourneyStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_Journeys_Status DEFAULT N'Planning',
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Journeys_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Journeys_User FOREIGN KEY (UserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_Journeys_University FOREIGN KEY (UniversityID) REFERENCES dbo.Universities(UniversityID),
        CONSTRAINT UQ_Journeys_UserUniArrival UNIQUE (UserID, UniversityID, ArrivalDate),
        CONSTRAINT CK_Journeys_Program CHECK (ProgramType IN (N'Erasmus',N'FullTime',N'Other')),
        CONSTRAINT CK_Journeys_Accommodation CHECK (AccommodationStatus IN (N'NotArranged',N'Confirmed')),
        CONSTRAINT CK_Journeys_Status CHECK (JourneyStatus IN (N'Planning',N'Active',N'Completed',N'Cancelled'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Task_Templates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Task_Templates (
        TaskID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TaskTemplates PRIMARY KEY,
        UniversityID INT NULL,  -- NULL means available across pilot universities
        TaskTitle NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        Category NVARCHAR(60) NOT NULL,
        JourneyStage NVARCHAR(20) NOT NULL,
        ApplicableProgram NVARCHAR(20) NOT NULL CONSTRAINT DF_TaskTemplates_Program DEFAULT N'All',
        AccommodationCondition NVARCHAR(20) NOT NULL CONSTRAINT DF_TaskTemplates_Accommodation DEFAULT N'Any',
        Priority TINYINT NOT NULL CONSTRAINT DF_TaskTemplates_Priority DEFAULT 3,
        IsActive BIT NOT NULL CONSTRAINT DF_TaskTemplates_Active DEFAULT 1,
        CONSTRAINT FK_TaskTemplates_University FOREIGN KEY (UniversityID) REFERENCES dbo.Universities(UniversityID),
        CONSTRAINT CK_TaskTemplates_Stage CHECK (JourneyStage IN (N'BeforeArrival',N'FirstDays',N'FirstWeek',N'SettlingIn')),
        CONSTRAINT CK_TaskTemplates_Program CHECK (ApplicableProgram IN (N'All',N'Erasmus',N'FullTime',N'Other')),
        CONSTRAINT CK_TaskTemplates_Accommodation CHECK (AccommodationCondition IN (N'Any',N'NotArranged',N'Confirmed')),
        CONSTRAINT CK_TaskTemplates_Priority CHECK (Priority BETWEEN 1 AND 5)
    );
END;
GO

IF OBJECT_ID(N'dbo.Journey_Tasks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Journey_Tasks (
        JourneyTaskID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_JourneyTasks PRIMARY KEY,
        JourneyID INT NOT NULL,
        TaskID INT NOT NULL,
        TaskStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_JourneyTasks_Status DEFAULT N'Pending',
        DueDate DATE NULL,
        CompletedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_JourneyTasks_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_JourneyTasks_Journey FOREIGN KEY (JourneyID) REFERENCES dbo.Journeys(JourneyID),
        CONSTRAINT FK_JourneyTasks_Template FOREIGN KEY (TaskID) REFERENCES dbo.Task_Templates(TaskID),
        CONSTRAINT UQ_JourneyTasks_JourneyTask UNIQUE (JourneyID, TaskID),
        CONSTRAINT CK_JourneyTasks_Status CHECK (TaskStatus IN (N'Pending',N'InProgress',N'Blocked',N'Completed',N'NotApplicable')),
        CONSTRAINT CK_JourneyTasks_CompletionTime CHECK (TaskStatus = N'Completed' OR CompletedAt IS NULL)
    );
END;
GO

IF OBJECT_ID(N'dbo.Task_Dependencies', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Task_Dependencies (
        TaskID INT NOT NULL,
        RequiredTaskID INT NOT NULL,
        CONSTRAINT PK_TaskDependencies PRIMARY KEY (TaskID, RequiredTaskID),
        CONSTRAINT FK_TaskDependencies_Task FOREIGN KEY (TaskID) REFERENCES dbo.Task_Templates(TaskID),
        CONSTRAINT FK_TaskDependencies_RequiredTask FOREIGN KEY (RequiredTaskID) REFERENCES dbo.Task_Templates(TaskID),
        CONSTRAINT CK_TaskDependencies_NoSelf CHECK (TaskID <> RequiredTaskID)
    );
END;
GO

IF OBJECT_ID(N'dbo.Information_Sources', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Information_Sources (
        SourceID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InformationSources PRIMARY KEY,
        TaskID INT NOT NULL,
        SourceTitle NVARCHAR(200) NOT NULL,
        SourceURL NVARCHAR(1000) NULL,
        SourceStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_InformationSources_Status DEFAULT N'PendingReview',
        LastVerifiedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InformationSources_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_InformationSources_Task FOREIGN KEY (TaskID) REFERENCES dbo.Task_Templates(TaskID),
        CONSTRAINT CK_InformationSources_Status CHECK (SourceStatus IN (N'PendingReview',N'Verified',N'Outdated'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Help_Requests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Help_Requests (
        RequestID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HelpRequests PRIMARY KEY,
        JourneyTaskID INT NOT NULL,
        MentorUserID INT NULL,
        Subject NVARCHAR(200) NOT NULL,
        ProblemDescription NVARCHAR(2000) NOT NULL,
        ResolutionText NVARCHAR(2000) NULL,
        RequestStatus NVARCHAR(20) NOT NULL CONSTRAINT DF_HelpRequests_Status DEFAULT N'Open',
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HelpRequests_Created DEFAULT SYSUTCDATETIME(),
        ResolvedAt DATETIME2(0) NULL,
        CONSTRAINT FK_HelpRequests_JourneyTask FOREIGN KEY (JourneyTaskID) REFERENCES dbo.Journey_Tasks(JourneyTaskID),
        CONSTRAINT FK_HelpRequests_Mentor FOREIGN KEY (MentorUserID) REFERENCES dbo.Users(UserID),
        CONSTRAINT CK_HelpRequests_Status CHECK (RequestStatus IN (N'Open',N'Assigned',N'Resolved',N'Closed')),
        CONSTRAINT CK_HelpRequests_Assigned CHECK (RequestStatus <> N'Assigned' OR MentorUserID IS NOT NULL)
    );
END;
GO

-- Indexes -----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Journeys_User' AND object_id=OBJECT_ID(N'dbo.Journeys'))
    CREATE INDEX IX_Journeys_User ON dbo.Journeys(UserID, JourneyStatus);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_JourneyTasks_JourneyStatus' AND object_id=OBJECT_ID(N'dbo.Journey_Tasks'))
    CREATE INDEX IX_JourneyTasks_JourneyStatus ON dbo.Journey_Tasks(JourneyID, TaskStatus);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_HelpRequests_MentorStatus' AND object_id=OBJECT_ID(N'dbo.Help_Requests'))
    CREATE INDEX IX_HelpRequests_MentorStatus ON dbo.Help_Requests(MentorUserID, RequestStatus, CreatedAt);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_Sources_TaskStatus' AND object_id=OBJECT_ID(N'dbo.Information_Sources'))
    CREATE INDEX IX_Sources_TaskStatus ON dbo.Information_Sources(TaskID, SourceStatus);
GO

-- Triggers ----------------------------------------------------------------
CREATE OR ALTER TRIGGER dbo.trg_JourneyTasks_ValidatePrerequisites
ON dbo.Journey_Tasks
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Completed tasks must have all prerequisite tasks completed in the SAME journey.
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Task_Dependencies d ON d.TaskID = i.TaskID
        LEFT JOIN dbo.Journey_Tasks prereq
            ON prereq.JourneyID = i.JourneyID
           AND prereq.TaskID = d.RequiredTaskID
        WHERE i.TaskStatus = N'Completed'
          AND (prereq.JourneyTaskID IS NULL OR prereq.TaskStatus <> N'Completed')
    )
        THROW 51001, 'Prerequisite tasks must be completed first.', 1;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_JourneyTasks_CompletionTimestamp
ON dbo.Journey_Tasks
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- The nested UPDATE changes CompletedAt, not TaskStatus: guard prevents trigger recursion.
    IF NOT UPDATE(TaskStatus) RETURN;

    UPDATE jt
       SET CompletedAt = CASE
            WHEN i.TaskStatus = N'Completed' THEN COALESCE(i.CompletedAt, SYSUTCDATETIME())
            ELSE NULL
       END
      FROM dbo.Journey_Tasks jt
      JOIN inserted i ON i.JourneyTaskID = jt.JourneyTaskID
     WHERE (i.TaskStatus = N'Completed' AND jt.CompletedAt IS NULL)
        OR (i.TaskStatus <> N'Completed' AND jt.CompletedAt IS NOT NULL);
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_HelpRequests_ValidateMentor
ON dbo.Help_Requests
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Users u ON u.UserID = i.MentorUserID
        WHERE u.UserRole NOT IN (N'Mentor', N'Admin') OR u.IsActive = 0
    )
        THROW 51002, 'Only active Mentor or Admin accounts can be assigned.', 1;
END;
GO

-- Stored procedures -------------------------------------------------------
-- INSERT PROCEDURE (identity value returned safely)
CREATE OR ALTER PROCEDURE dbo.usp_User_Insert
    @FirstName NVARCHAR(100),
    @LastName NVARCHAR(100),
    @Email NVARCHAR(255),
    @PasswordHash NVARCHAR(255),
    @NewUserID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF NULLIF(LTRIM(RTRIM(@PasswordHash)),N'') IS NULL
        THROW 51010, 'PasswordHash must be supplied by the backend.', 1;
    INSERT INTO dbo.Users (FirstName,LastName,Email,PasswordHash,UserRole)
    VALUES (@FirstName,@LastName,@Email,@PasswordHash,N'Student');
    SET @NewUserID = CONVERT(INT, SCOPE_IDENTITY());
END;
GO

-- UPDATE PROCEDURE
CREATE OR ALTER PROCEDURE dbo.usp_JourneyTask_UpdateStatus
    @JourneyTaskID INT,
    @NewStatus NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Journey_Tasks WHERE JourneyTaskID = @JourneyTaskID)
        THROW 51011, 'Journey task not found.', 1;
    -- Leaving Completed clears CompletedAt in the same statement, so CK_JourneyTasks_CompletionTime holds.
    UPDATE dbo.Journey_Tasks
       SET TaskStatus = @NewStatus,
           CompletedAt = CASE WHEN @NewStatus = N'Completed' THEN CompletedAt ELSE NULL END
     WHERE JourneyTaskID = @JourneyTaskID;
    SELECT JourneyTaskID, JourneyID, TaskID, TaskStatus, CompletedAt
      FROM dbo.Journey_Tasks WHERE JourneyTaskID = @JourneyTaskID;
END;
GO

-- DELETE PROCEDURE: only an unassigned, open request may be deleted.
CREATE OR ALTER PROCEDURE dbo.usp_HelpRequest_DeleteOpen
    @RequestID INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Help_Requests WHERE RequestID=@RequestID AND RequestStatus=N'Open' AND MentorUserID IS NULL)
        THROW 51012, 'Only an unassigned open help request may be deleted.', 1;
    DELETE FROM dbo.Help_Requests WHERE RequestID=@RequestID;
END;
GO

-- TRANSACTION PROCEDURE: journey and its personal task rows succeed or fail together.
CREATE OR ALTER PROCEDURE dbo.usp_Journey_CreateWithTasks
    @UserID INT,
    @UniversityID INT,
    @ArrivalDate DATE,
    @ProgramType NVARCHAR(20),
    @AccommodationStatus NVARCHAR(20),
    @NewJourneyID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserID=@UserID AND UserRole=N'Student' AND IsActive=1)
        THROW 51013, 'Active student not found.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Universities WHERE UniversityID=@UniversityID)
        THROW 51014, 'University not found.', 1;
    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT INTO dbo.Journeys(UserID,UniversityID,ArrivalDate,ProgramType,AccommodationStatus)
        VALUES(@UserID,@UniversityID,@ArrivalDate,@ProgramType,@AccommodationStatus);
        SET @NewJourneyID = CONVERT(INT,SCOPE_IDENTITY());
        INSERT INTO dbo.Journey_Tasks(JourneyID,TaskID,TaskStatus)
        SELECT @NewJourneyID, t.TaskID, N'Pending'
        FROM dbo.Task_Templates t
        WHERE t.IsActive=1
          AND (t.UniversityID IS NULL OR t.UniversityID=@UniversityID)
          AND (t.ApplicableProgram=N'All' OR t.ApplicableProgram=@ProgramType)
          AND (t.AccommodationCondition=N'Any' OR t.AccommodationCondition=@AccommodationStatus);
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- CURSOR PROCEDURE (course demonstration): sequentially prepare pending-task report.
CREATE OR ALTER PROCEDURE dbo.usp_Journey_PendingTaskCursorReport
    @JourneyID INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TaskTitle NVARCHAR(200), @TaskStatus NVARCHAR(20), @Position INT=0;
    DECLARE @Report TABLE (TaskNumber INT, TaskTitle NVARCHAR(200), TaskStatus NVARCHAR(20));
    DECLARE task_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT t.TaskTitle, jt.TaskStatus
        FROM dbo.Journey_Tasks jt
        JOIN dbo.Task_Templates t ON t.TaskID=jt.TaskID
        WHERE jt.JourneyID=@JourneyID AND jt.TaskStatus IN (N'Pending',N'InProgress',N'Blocked')
        ORDER BY t.Priority, t.TaskTitle;
    OPEN task_cursor;
    FETCH NEXT FROM task_cursor INTO @TaskTitle,@TaskStatus;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @Position = @Position+1;
        INSERT INTO @Report(TaskNumber,TaskTitle,TaskStatus) VALUES (@Position,@TaskTitle,@TaskStatus);
        FETCH NEXT FROM task_cursor INTO @TaskTitle,@TaskStatus;
    END;
    CLOSE task_cursor;
    DEALLOCATE task_cursor;
    SELECT TaskNumber, TaskTitle, TaskStatus FROM @Report ORDER BY TaskNumber;
END;
GO
