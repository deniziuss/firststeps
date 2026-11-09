/* MIGRATION 0003: prerequisites that do not apply to a journey no longer lock dependent tasks.
   Approved and applied to the local FirstSteps_Dev on 2026-11-09 (Issue 001).
   The application rule (src/domain/prerequisites.ts) is identical; tests/unit/prerequisite-parity
   checks both against the same cases. Rollback: database/rollbacks/0003_rollback.sql.

   A prerequisite counts as satisfied when
     - its journey task is Completed, or
     - its journey task is NotApplicable (set by re-planning), or
     - it has no journey task AND its template does not apply to the journey
       (inactive, other university, other programme, other accommodation status).
   A prerequisite whose template DOES apply but which has no journey task is a data gap
   (for example a template added after the journey was created). It still blocks completion;
   the application repairs it by re-planning the journey, which adds the missing task.
   Error number and message are unchanged (51001), so the application needs no error mapping change.
*/
CREATE OR ALTER TRIGGER dbo.trg_JourneyTasks_ValidatePrerequisites
ON dbo.Journey_Tasks
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Journeys j ON j.JourneyID = i.JourneyID
        JOIN dbo.Task_Dependencies d ON d.TaskID = i.TaskID
        JOIN dbo.Task_Templates r ON r.TaskID = d.RequiredTaskID
        LEFT JOIN dbo.Journey_Tasks prereq
            ON prereq.JourneyID = i.JourneyID
           AND prereq.TaskID = d.RequiredTaskID
        WHERE i.TaskStatus = N'Completed'
          AND (
                (prereq.JourneyTaskID IS NOT NULL AND prereq.TaskStatus NOT IN (N'Completed', N'NotApplicable'))
             OR (prereq.JourneyTaskID IS NULL
                 AND r.IsActive = 1
                 AND (r.UniversityID IS NULL OR r.UniversityID = j.UniversityID)
                 AND r.ApplicableProgram IN (N'All', j.ProgramType)
                 AND r.AccommodationCondition IN (N'Any', j.AccommodationStatus))
          )
    )
        THROW 51001, 'Prerequisite tasks must be completed first.', 1;
END;
GO
