import { z } from "zod";
import {
  ACCOMMODATION_CONDITIONS,
  ACCOMMODATION_STATUSES,
  APPLICABLE_PROGRAMS,
  JOURNEY_STAGES,
  PROGRAM_TYPES,
  SOURCE_STATUSES,
  STUDENT_TASK_STATUSES,
  USER_ROLES,
} from "@/domain/statuses";
import type { Translate } from "@/i18n/translator";

// Error messages are translation keys; fieldErrors() turns them into text in the user's language.
const required = "validation.required";
const tooLong = "validation.tooLong";

const text = (min: number, max: number, minMessage = required) => z.string().trim().min(min, minMessage).max(max, tooLong);
const name = text(1, 100);
const email = z.string().trim().toLowerCase().max(255, tooLong).pipe(z.email("validation.email"));
const password = z.string().min(10, "validation.passwordLength").max(128, "validation.passwordMax");
const id = z.coerce.number().int().positive();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === "" ? null : value));
const optionalUrl = (max: number) => optionalText(max).pipe(z.url("validation.url").nullable());

export const registerSchema = z
  .object({ firstName: name, lastName: name, email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "validation.passwordsMatch" });

export const signInSchema = z.object({ email, password: z.string().min(1, required).max(128, tooLong) });

export const profileSchema = z.object({ firstName: name, lastName: name });

export const passwordChangeSchema = z
  .object({ currentPassword: z.string().min(1, required).max(128, tooLong), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "validation.passwordsMatch" });

export const journeySchema = z.object({
  universityId: id,
  arrivalDate: z.iso.date("validation.date"),
  programType: z.enum(PROGRAM_TYPES, "validation.required"),
  accommodationStatus: z.enum(ACCOMMODATION_STATUSES, "validation.required"),
  homeCountryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/, "validation.countryCode")
    .transform((value) => (value === "" ? null : value)),
});

export const accommodationSchema = z.object({ journeyId: id, accommodationStatus: z.enum(ACCOMMODATION_STATUSES) });

export const taskStatusSchema = z.object({ journeyTaskId: id, status: z.enum(STUDENT_TASK_STATUSES) });

export const helpRequestSchema = z.object({
  journeyTaskId: id,
  subject: text(3, 200, "validation.subject"),
  problemDescription: text(10, 2000, "validation.problem"),
});

export const resolveRequestSchema = z.object({ requestId: id, resolutionText: text(5, 2000, "validation.answer") });

export const assignRequestSchema = z.object({ requestId: id, mentorUserId: id });

export const universitySchema = z.object({
  universityName: text(2, 200),
  city: text(1, 100),
  country: text(1, 100),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "validation.countryCode"),
  website: optionalUrl(500),
});

export const templateSchema = z.object({
  universityId: z
    .string()
    .transform((value) => (value === "" || value === "global" ? null : Number(value)))
    .pipe(z.number().int().positive().nullable()),
  taskTitle: text(3, 200),
  description: optionalText(1000),
  category: text(2, 60),
  journeyStage: z.enum(JOURNEY_STAGES),
  applicableProgram: z.enum(APPLICABLE_PROGRAMS),
  accommodationCondition: z.enum(ACCOMMODATION_CONDITIONS),
  priority: z.coerce.number().int().min(1, "validation.invalid").max(5, "validation.invalid"),
  isActive: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export const templateTranslationSchema = z.object({
  taskId: id,
  taskTitle: text(3, 200),
  description: optionalText(1000),
});

export const dependencySchema = z.object({ taskId: id, requiredTaskId: id });

export const sourceSchema = z.object({
  taskId: id,
  sourceTitle: text(2, 200),
  sourceTitleTr: optionalText(200),
  sourceUrl: optionalUrl(1000),
  sourceStatus: z.enum(SOURCE_STATUSES),
});

export const userAdminSchema = z.object({
  userId: id,
  role: z.enum(USER_ROLES),
  isActive: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export function fieldErrors(error: z.ZodError, t: Translate, has: (key: string) => boolean): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    const message = has(issue.message) ? t(issue.message as Parameters<Translate>[0]) : t("validation.invalid");
    result[field] = [...(result[field] ?? []), message];
  }
  return result;
}
