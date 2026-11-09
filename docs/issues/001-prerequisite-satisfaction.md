# Issue 001: missing or not-applicable prerequisites

**Status:**
- **Data gaps:** fixed in the application.
- **Prerequisites that do not apply:** fixed by migration 0003, approved and applied to the local `FirstSteps_Dev` on 2026-11-09. The trigger and `unmetPrerequisites` / `checkTransition` follow the same rule; `tests/unit/prerequisite-parity.test.ts` checks both against 9 cases (`npm run test:db` for the SQL side).

**Related objects:**
- `dbo.trg_JourneyTasks_ValidatePrerequisites`
- `src/domain/prerequisites.ts`
- `src/server/repositories/{tasks,journeys}.ts`

## Problem
A task can only be completed when every prerequisite exists **in the same journey** with status `Completed`; the trigger enforces this. A prerequisite without such a row has two very different causes, and they need different answers.

| Case | Example | What is right for the student |
|---|---|---|
| **A. Does not apply** | B (any housing) requires A, but A only applies when housing is `NotArranged`. A student with `Confirmed` housing never gets A, or re-planning marks it `NotApplicable`. | B should not wait for a task that does not concern them. |
| **B. Data gap** | An admin adds a new template and makes it a prerequisite of a task that existing journeys already have. Those journeys do not contain the new task. | The missing task should be added to the plan; B should wait for it. |

Under the current trigger, both cases lock the dependent task permanently. Treating both as "satisfied" would be wrong for case B, because the student would skip a step that does apply to them.

## How the application tells them apart
`unmetPrerequisites` returns one of three reasons:
- `open`: the prerequisite is in the journey but not completed yet.
- `notApplicable`: the journey task is `NotApplicable`, **or** there is no journey task and the template does not match the journey. A template does not match when it is inactive or belongs to another university, programme or accommodation status. This uses the same `isTemplateApplicable` rule as journey creation and `usp_Journey_CreateWithTasks`.
- `missing`: there is no journey task, but the template **does** match the journey. This is a data gap.

## Case B: fixed (no database change)
- **Task page:** shows "A required task is missing from your plan" with an **Update my plan** button.
- **Journey list:** says "Waiting for a task that is missing from your plan."
- **Update my plan** runs the existing re-planning (`replanJourney`, which `changeAccommodation` also uses) with the current profile. The update runs in one transaction.
  - Templates that apply but are missing are inserted as `Pending`. Rows are never deleted and completed tasks are never changed.
  - Afterwards the normal rule applies: do the added task first, then the dependent one.
- **Tests:**
  - Unit test: `notApplicable` and `missing` are separated.
  - E2E `plan-repair.spec.ts`: an admin adds a prerequisite after the journey exists; the task is locked with the explanation; *Update my plan* adds the missing task; both tasks are then completed in order.

## Case A: proposal 0003 (not applied)
`database/proposals/0003_prerequisite_applicability.sql` changes only the prerequisite trigger. A prerequisite counts as satisfied when:
1. its journey task is `Completed`, or
2. its journey task is `NotApplicable`, or
3. it has no journey task **and** its template does not apply to the journey.

A prerequisite that applies but is missing (case B) **still blocks** with 51001.

**Compatibility check** (`database/proposals/0003_test_rolled_back.sql`, local `FirstSteps_Dev`, one transaction that is always rolled back):

| Check | Result |
|---|---|
| Absent, not-applicable prerequisite no longer locks; `trg_JourneyTasks_CompletionTimestamp` still sets `CompletedAt` | PASS |
| `NotApplicable` prerequisite row no longer locks | PASS |
| Applicable but missing prerequisite is still blocked with 51001 | PASS |
| After rollback: original trigger in place, no test rows left | PASS |

**Effects on the rest of the system:**
- **Error handling:** error number and message are unchanged, so the application's error mapping stays as it is.
- **Other triggers:** `trg_HelpRequests_ValidateMentor` and the completion timestamp trigger are unaffected.
- **`usp_JourneyTask_UpdateStatus`** needs no change.
- **Reopening rule:** "a prerequisite cannot be reopened while a dependent is completed" still holds for real prerequisites.
- **Edge case:** if re-planning later makes a `NotApplicable` prerequisite apply again, it returns as `Pending` while its dependent stays `Completed`. History is kept on purpose; the student is not asked to redo finished work.

**If approved,** do these together:
1. Copy the file to `database/migrations/0003_…sql`.
2. Change `unmetPrerequisites` to treat `notApplicable` as satisfied, plus its unit tests.
3. Remove the "not part of your plan" explanation.
4. Run it locally first.

Applying it to the course database is a separate decision, made manually in SSMS.

## Admin safeguards (unchanged)
When an admin adds a dependency whose applicability does not cover the dependent task (`applicabilityGaps`), they see the reasons and must confirm.
