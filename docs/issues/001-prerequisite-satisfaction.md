# Issue 001: missing or not-applicable prerequisites

**Status:** short-term handling implemented; the permanent rule needs a product decision.
**Related object:** `dbo.trg_JourneyTasks_ValidatePrerequisites`

## Problem
A task can only be completed when every prerequisite exists **in the same journey** with status `Completed`. Two cases lock a task permanently:

1. **Missing prerequisite:** the prerequisite template was never added to the journey (filtered out by programme, accommodation or university, or deactivated later).
2. **Not-applicable prerequisite:** the prerequisite became `NotApplicable` after re-planning.

Example: task B (any accommodation) requires task A, which only applies when accommodation is `NotArranged`. A student with `Confirmed` accommodation never gets A, so B can never be completed.

## Options
| # | Approach | Database change | Note |
|---|---|---|---|
| 1 | Treat a prerequisite as satisfied when it is Completed, NotApplicable or not in the journey | Trigger change (new migration) | Simplest permanent rule; app and database stay aligned |
| 2 | Keep the trigger; warn admins when a dependency has narrower applicability than its dependent | None | Does not cover re-planning to NotApplicable |
| 3 | Keep the trigger; explain the lock to the student and point to help | None | The task stays locked |

## Current handling (options 2 and 3)
- `src/domain/prerequisites.ts` applies exactly the trigger's strict rule and distinguishes `open`, `missing` and `notApplicable` reasons.
- The task page explains when a prerequisite is not part of the plan and points to "I'm stuck"; the task list shows the same explanation.
- Admins adding a dependency whose applicability does not cover the dependent task (`applicabilityGaps`) see the reasons and must confirm explicitly.
- The synthetic content (`02_seed_content.sql`) contains no dependency that triggers the problem.

Option 1 would be a new migration, tested locally first; the application rule must change together with the trigger.
