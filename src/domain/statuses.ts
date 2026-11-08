// Value sets mirror the CHECK constraints in database/migrations/0001_initial_schema.sql.

export const USER_ROLES = ["Student", "Mentor", "Admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROGRAM_TYPES = ["Erasmus", "FullTime", "Other"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export const ACCOMMODATION_STATUSES = ["NotArranged", "Confirmed"] as const;
export type AccommodationStatus = (typeof ACCOMMODATION_STATUSES)[number];

export const JOURNEY_STATUSES = ["Planning", "Active", "Completed", "Cancelled"] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

export const JOURNEY_STAGES = ["BeforeArrival", "FirstDays", "FirstWeek", "SettlingIn"] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const APPLICABLE_PROGRAMS = ["All", ...PROGRAM_TYPES] as const;
export type ApplicableProgram = (typeof APPLICABLE_PROGRAMS)[number];

export const ACCOMMODATION_CONDITIONS = ["Any", ...ACCOMMODATION_STATUSES] as const;
export type AccommodationCondition = (typeof ACCOMMODATION_CONDITIONS)[number];

export const TASK_STATUSES = ["Pending", "InProgress", "Blocked", "Completed", "NotApplicable"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Statuses a student may choose. NotApplicable is set only by plan reconciliation.
export const STUDENT_TASK_STATUSES = ["Pending", "InProgress", "Blocked", "Completed"] as const satisfies readonly TaskStatus[];
export type StudentTaskStatus = (typeof STUDENT_TASK_STATUSES)[number];

export const SOURCE_STATUSES = ["PendingReview", "Verified", "Outdated"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const REQUEST_STATUSES = ["Open", "Assigned", "Resolved", "Closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STAGE_LABELS: Record<JourneyStage, string> = {
  BeforeArrival: "Before arrival",
  FirstDays: "First days",
  FirstWeek: "First week",
  SettlingIn: "Settling in",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  Pending: "To do",
  InProgress: "In progress",
  Blocked: "Blocked",
  Completed: "Completed",
  NotApplicable: "Not applicable",
};
