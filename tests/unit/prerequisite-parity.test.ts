import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isTemplateApplicable, type JourneyProfile, type TemplateRule } from "@/domain/journeyEngine";
import { checkTransition } from "@/domain/prerequisites";
import type { AccommodationCondition, AccommodationStatus, ApplicableProgram, ProgramType, TaskStatus } from "@/domain/statuses";

// One table of cases for both rule implementations: the TypeScript engine (always) and the SQL
// trigger dbo.trg_JourneyTasks_ValidatePrerequisites (with RUN_DB_TESTS=1, a local development/test database or the CI container only,
// every case inside its own rolled-back transaction). Task D requires prerequisite P; the student
// tries to complete D.
type Case = {
  name: string;
  journey: { program: ProgramType; accommodation: AccommodationStatus };
  prerequisite: { program?: ApplicableProgram; accommodation?: AccommodationCondition; active?: boolean; row: TaskStatus | null };
  expected: "allowed" | "blocked";
};

const ERASMUS_CONFIRMED = { program: "Erasmus", accommodation: "Confirmed" } as const;
const CASES: Case[] = [
  { name: "1 completed prerequisite", journey: ERASMUS_CONFIRMED, prerequisite: { row: "Completed" }, expected: "allowed" },
  { name: "2 NotApplicable prerequisite row", journey: ERASMUS_CONFIRMED, prerequisite: { accommodation: "NotArranged", row: "NotApplicable" }, expected: "allowed" },
  { name: "3a absent, other housing status", journey: ERASMUS_CONFIRMED, prerequisite: { accommodation: "NotArranged", row: null }, expected: "allowed" },
  { name: "3b absent, other programme", journey: { program: "FullTime", accommodation: "Confirmed" }, prerequisite: { program: "Erasmus", row: null }, expected: "allowed" },
  { name: "3c absent, inactive template", journey: ERASMUS_CONFIRMED, prerequisite: { active: false, row: null }, expected: "allowed" },
  { name: "4 absent but applicable (data gap)", journey: ERASMUS_CONFIRMED, prerequisite: { row: null }, expected: "blocked" },
  { name: "5a present, Pending", journey: ERASMUS_CONFIRMED, prerequisite: { row: "Pending" }, expected: "blocked" },
  { name: "5b present, InProgress", journey: ERASMUS_CONFIRMED, prerequisite: { row: "InProgress" }, expected: "blocked" },
  { name: "5c present, Blocked", journey: ERASMUS_CONFIRMED, prerequisite: { row: "Blocked" }, expected: "blocked" },
];

// Connection for the SQL side: the local instance with Windows authentication by default; CI passes a
// disposable container with SQL authentication (SQLCMD_USER / SQLCMD_PASSWORD) and DB_NAME=FirstSteps_Test.
const DATABASE = process.env.DB_NAME === "FirstSteps_Test" ? "FirstSteps_Test" : "FirstSteps_Dev";
const SQLCMD = [
  "-S", process.env.SQLCMD_SERVER ?? "tcp:127.0.0.1,1433",
  ...(process.env.SQLCMD_USER ? ["-U", process.env.SQLCMD_USER, "-P", process.env.SQLCMD_PASSWORD ?? ""] : ["-E"]),
  "-C", "-b", "-d", DATABASE,
];

const P = 1;
const D = 2;

function typescriptResult(c: Case): "allowed" | "blocked" {
  const template: TemplateRule = {
    taskId: P,
    universityId: null,
    applicableProgram: c.prerequisite.program ?? "All",
    accommodationCondition: c.prerequisite.accommodation ?? "Any",
    isActive: c.prerequisite.active ?? true,
  };
  const profile: JourneyProfile = { universityId: 1, programType: c.journey.program, accommodationStatus: c.journey.accommodation };
  const tasks = [...(c.prerequisite.row ? [{ taskId: P, status: c.prerequisite.row }] : []), { taskId: D, status: "Pending" as const }];
  const check = checkTransition(D, "Pending", "Completed", tasks, [{ taskId: D, requiredTaskId: P }], () => isTemplateApplicable(template, profile));
  return check.ok ? "allowed" : "blocked";
}

function sqlResult(c: Case, index: number): string {
  const p = c.prerequisite;
  const batch = `
SET NOCOUNT ON; SET XACT_ABORT OFF;
IF DB_NAME() NOT IN (N'FirstSteps_Dev', N'FirstSteps_Test') THROW 51000, 'Run only against a FirstSteps development or test database', 1;
BEGIN TRANSACTION;
DECLARE @uni INT, @user INT, @j INT, @P INT, @D INT;
INSERT dbo.Universities (UniversityName, City, Country, CountryCode) VALUES (N'Parity U ${index}', N'Paritycity', N'Testland', 'XX'); SET @uni = SCOPE_IDENTITY();
INSERT dbo.Users (FirstName, LastName, Email, PasswordHash) VALUES (N'Parity', N'Test', N'parity-${index}@example.invalid', N'x'); SET @user = SCOPE_IDENTITY();
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Category, JourneyStage, ApplicableProgram, AccommodationCondition, IsActive)
  VALUES (@uni, N'Parity P', N'Housing', N'BeforeArrival', N'${p.program ?? "All"}', N'${p.accommodation ?? "Any"}', ${p.active === false ? 0 : 1}); SET @P = SCOPE_IDENTITY();
INSERT dbo.Task_Templates (UniversityID, TaskTitle, Category, JourneyStage) VALUES (@uni, N'Parity D', N'Housing', N'FirstDays'); SET @D = SCOPE_IDENTITY();
INSERT dbo.Task_Dependencies (TaskID, RequiredTaskID) VALUES (@D, @P);
INSERT dbo.Journeys (UserID, UniversityID, ArrivalDate, ProgramType, AccommodationStatus) VALUES (@user, @uni, '2030-01-01', N'${c.journey.program}', N'${c.journey.accommodation}'); SET @j = SCOPE_IDENTITY();
${p.row ? `INSERT dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus) VALUES (@j, @P, N'${p.row}');` : ""}
INSERT dbo.Journey_Tasks (JourneyID, TaskID, TaskStatus) VALUES (@j, @D, N'Pending');
BEGIN TRY
  UPDATE dbo.Journey_Tasks SET TaskStatus = N'Completed' WHERE JourneyID = @j AND TaskID = @D;
  PRINT 'RESULT allowed';
END TRY
BEGIN CATCH
  PRINT CASE WHEN ERROR_NUMBER() = 51001 THEN 'RESULT blocked' ELSE 'RESULT error ' + CAST(ERROR_NUMBER() AS VARCHAR(10)) END;
END CATCH;
IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
`;
  const dir = mkdtempSync(path.join(tmpdir(), "fs-parity-"));
  try {
    const file = path.join(dir, "case.sql");
    writeFileSync(file, batch);
    const output = execFileSync("sqlcmd", [...SQLCMD, "-i", file], { encoding: "utf8" });
    return /RESULT (\w+(?: \d+)?)/.exec(output)?.[1] ?? `no result: ${output}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("prerequisite rule: TypeScript engine", () => {
  for (const c of CASES) it(c.name, () => expect(typescriptResult(c)).toBe(c.expected));
});

describe.runIf(process.env.RUN_DB_TESTS === "1")(`prerequisite rule: SQL trigger (${DATABASE}, rolled back)`, () => {
  CASES.forEach((c, index) => it(c.name, () => expect(sqlResult(c, index)).toBe(c.expected), 30_000));
  it("left no test rows behind", () => {
    const output = execFileSync("sqlcmd", [...SQLCMD, "-h", "-1", "-Q", "SET NOCOUNT ON; SELECT COUNT(*) FROM dbo.Users WHERE Email LIKE N'parity-%@example.invalid'"], { encoding: "utf8" });
    expect(output.trim()).toBe("0");
  });
});
