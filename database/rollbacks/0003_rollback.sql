/* ROLLBACK 0003: restores the original prerequisite trigger from migration 0001 (strict rule:
   every prerequisite must be Completed in the same journey). No data is changed; tasks completed
   under the 0003 rule stay Completed (history is kept). Revert the application code first. */
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
