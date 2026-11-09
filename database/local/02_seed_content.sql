-- Local development only: synthetic pilot content for FirstSteps_Dev. No people, no passwords.
-- Task texts are guidance drafts, not verified legal requirements. Every source starts as PendingReview.
-- Idempotent: rows are matched by natural keys and inserted only when missing.
-- Run with -d FirstSteps_Dev (local) or -d FirstSteps_Test (disposable copy, CI).
GO
IF DB_NAME() NOT IN (N'FirstSteps_Dev', N'FirstSteps_Test') THROW 51000, 'Wrong database selected.', 1;
GO
SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.Universities WHERE UniversityName = N'RTU Liepāja Academy' AND City = N'Liepāja')
    INSERT INTO dbo.Universities (UniversityName, City, Country, CountryCode, Website)
    VALUES (N'RTU Liepāja Academy', N'Liepāja', N'Latvia', 'LV', N'https://www.rtu.lv/en');

DECLARE @Rtu INT = (SELECT UniversityID FROM dbo.Universities WHERE UniversityName = N'RTU Liepāja Academy' AND City = N'Liepāja');

DECLARE @Templates TABLE (
    Scope NVARCHAR(10), TaskTitle NVARCHAR(200), Description NVARCHAR(1000), Category NVARCHAR(60),
    JourneyStage NVARCHAR(20), ApplicableProgram NVARCHAR(20), AccommodationCondition NVARCHAR(20), Priority TINYINT
);
INSERT INTO @Templates VALUES
 (N'RTU',    N'Review your learning agreement', N'Check that the courses in your Erasmus learning agreement match what your home and host university approved.', N'University', N'BeforeArrival', N'Erasmus', N'Any', 1),
 (N'Global', N'Check entry requirements for your nationality', N'Find out whether you need a visa or residence permit for your stay, based on your citizenship and length of study.', N'Documents', N'BeforeArrival', N'All', N'Any', 1),
 (N'RTU',    N'Arrange accommodation', N'Find a place to stay for your study period: student housing or a private rental.', N'Housing', N'BeforeArrival', N'All', N'NotArranged', 1),
 (N'RTU',    N'Confirm check-in details with your accommodation', N'Ask your accommodation provider for the address, check-in time and how to get the keys.', N'Housing', N'BeforeArrival', N'All', N'Confirmed', 2),
 (N'Global', N'Arrange health insurance', N'Make sure you are covered for healthcare during your stay, for example with a European Health Insurance Card or private insurance.', N'Health', N'BeforeArrival', N'All', N'Any', 1),
 (N'RTU',    N'Plan your route to Liepāja', N'Plan how you will travel from the airport or station to Liepāja on your arrival day.', N'Transport', N'BeforeArrival', N'All', N'Any', 2),
 (N'RTU',    N'Move in and check your accommodation', N'Move in, check the condition of the room and keep a copy of your rental agreement.', N'Housing', N'FirstDays', N'All', N'Any', 1),
 (N'RTU',    N'Register at the international office', N'Visit the international office with your documents to confirm your arrival.', N'University', N'FirstDays', N'All', N'Any', 1),
 (N'RTU',    N'Activate your student portal account', N'Activate your university IT account to access email, timetables and course materials.', N'University', N'FirstDays', N'All', N'Any', 2),
 (N'Global', N'Get a local mobile connection', N'Compare local mobile plans and get a SIM or eSIM if you need one.', N'DailyLife', N'FirstDays', N'All', N'Any', 3),
 (N'RTU',    N'Declare your place of residence', N'Check whether you must declare your address in Latvia and how to do it.', N'Documents', N'FirstWeek', N'All', N'Any', 2),
 (N'RTU',    N'Learn the city public transport', N'Find out how tickets, routes and timetables work for public transport in Liepāja.', N'Transport', N'FirstWeek', N'All', N'Any', 3),
 (N'RTU',    N'Attend orientation week', N'Join the orientation events for incoming exchange students.', N'University', N'FirstWeek', N'Erasmus', N'Any', 2),
 (N'RTU',    N'Confirm your course enrolment', N'Check that you are enrolled in your courses and that your timetable has no conflicts.', N'University', N'FirstWeek', N'All', N'Any', 1),
 (N'Global', N'Save emergency and healthcare contacts', N'Save the EU emergency number 112 and find the nearest medical centre.', N'Health', N'SettlingIn', N'All', N'Any', 3),
 (N'RTU',    N'Report learning agreement changes', N'If your courses changed after arrival, update your learning agreement within the deadline.', N'University', N'SettlingIn', N'Erasmus', N'Any', 3),
 (N'Global', N'Open a local bank account', N'Decide whether you need a local bank account for a longer stay.', N'DailyLife', N'SettlingIn', N'FullTime', N'Any', 4),
 (N'RTU',    N'Join a student community event', N'Meet other students at a buddy or student organisation event.', N'DailyLife', N'SettlingIn', N'All', N'Any', 4);

INSERT INTO dbo.Task_Templates (UniversityID, TaskTitle, Description, Category, JourneyStage, ApplicableProgram, AccommodationCondition, Priority)
SELECT CASE WHEN s.Scope = N'RTU' THEN @Rtu END, s.TaskTitle, s.Description, s.Category, s.JourneyStage, s.ApplicableProgram, s.AccommodationCondition, s.Priority
  FROM @Templates s
 WHERE NOT EXISTS (SELECT 1 FROM dbo.Task_Templates t WHERE t.TaskTitle = s.TaskTitle);

-- Dependencies only between tasks that share applicability, so every journey that has the
-- dependent task also has its prerequisite (see docs/issues/001-prerequisite-satisfaction.md).
DECLARE @Deps TABLE (TaskTitle NVARCHAR(200), RequiredTitle NVARCHAR(200));
INSERT INTO @Deps VALUES
 (N'Activate your student portal account', N'Register at the international office'),
 (N'Attend orientation week', N'Register at the international office'),
 (N'Confirm your course enrolment', N'Activate your student portal account'),
 (N'Declare your place of residence', N'Move in and check your accommodation'),
 (N'Report learning agreement changes', N'Confirm your course enrolment'),
 (N'Report learning agreement changes', N'Review your learning agreement');

INSERT INTO dbo.Task_Dependencies (TaskID, RequiredTaskID)
SELECT t.TaskID, r.TaskID
  FROM @Deps d
  JOIN dbo.Task_Templates t ON t.TaskTitle = d.TaskTitle
  JOIN dbo.Task_Templates r ON r.TaskTitle = d.RequiredTitle
 WHERE NOT EXISTS (SELECT 1 FROM dbo.Task_Dependencies x WHERE x.TaskID = t.TaskID AND x.RequiredTaskID = r.TaskID);

DECLARE @Sources TABLE (TaskTitle NVARCHAR(200), SourceTitle NVARCHAR(200), SourceURL NVARCHAR(1000));
INSERT INTO @Sources VALUES
 (N'Review your learning agreement', N'Erasmus+ programme information', N'https://erasmus-plus.ec.europa.eu'),
 (N'Check entry requirements for your nationality', N'Office of Citizenship and Migration Affairs (PMLP)', N'https://www.pmlp.gov.lv/en'),
 (N'Arrange health insurance', N'Your Europe: health care abroad', N'https://europa.eu/youreurope'),
 (N'Register at the international office', N'RTU international students', N'https://www.rtu.lv/en'),
 (N'Activate your student portal account', N'RTU website', N'https://www.rtu.lv/en'),
 (N'Declare your place of residence', N'Office of Citizenship and Migration Affairs (PMLP)', N'https://www.pmlp.gov.lv/en'),
 (N'Learn the city public transport', N'Liepāja city website', N'https://www.liepaja.lv'),
 (N'Plan your route to Liepāja', N'Liepāja city website', N'https://www.liepaja.lv'),
 (N'Save emergency and healthcare contacts', N'Your Europe: health care abroad', N'https://europa.eu/youreurope');

INSERT INTO dbo.Information_Sources (TaskID, SourceTitle, SourceURL, SourceStatus)
SELECT t.TaskID, s.SourceTitle, s.SourceURL, N'PendingReview'
  FROM @Sources s
  JOIN dbo.Task_Templates t ON t.TaskTitle = s.TaskTitle
 WHERE NOT EXISTS (SELECT 1 FROM dbo.Information_Sources x WHERE x.TaskID = t.TaskID AND x.SourceTitle = s.SourceTitle);

SELECT (SELECT COUNT(*) FROM dbo.Universities) AS Universities,
       (SELECT COUNT(*) FROM dbo.Task_Templates) AS TaskTemplates,
       (SELECT COUNT(*) FROM dbo.Task_Dependencies) AS Dependencies,
       (SELECT COUNT(*) FROM dbo.Information_Sources) AS Sources;
GO
