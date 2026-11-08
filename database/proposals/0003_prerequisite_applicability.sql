/* PROPOSAL 0003: prerequisites that do not apply to a journey no longer lock dependent tasks.
   Status: NOT APPLIED. Waiting for a product decision (docs/issues/001-prerequisite-satisfaction.md).
   Not part of database/migrations, so `npm run db:local:setup` does not run it.
   Tested only inside a rolled-back transaction: database/proposals/0003_test_rolled_back.sql.

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
