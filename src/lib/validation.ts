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

const name = z.string().trim().min(1, "Required").max(100);
const email = z.string().trim().toLowerCase().max(255).pipe(z.email("Enter a valid email address"));
const password = z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters");
const id = z.coerce.number().int().positive();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const registerSchema = z
  .object({ firstName: name, lastName: name, email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const signInSchema = z.object({ email, password: z.string().min(1, "Required").max(128) });

export const profileSchema = z.object({ firstName: name, lastName: name });

export const passwordChangeSchema = z
  .object({ currentPassword: z.string().min(1, "Required").max(128), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const journeySchema = z.object({
  universityId: id,
  arrivalDate: z.iso.date("Choose your arrival date"),
  programType: z.enum(PROGRAM_TYPES),
  accommodationStatus: z.enum(ACCOMMODATION_STATUSES),
  homeCountryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/, "Use a two-letter country code")
    .transform((value) => (value === "" ? null : value)),
});

export const accommodationSchema = z.object({ journeyId: id, accommodationStatus: z.enum(ACCOMMODATION_STATUSES) });

export const taskStatusSchema = z.object({ journeyTaskId: id, status: z.enum(STUDENT_TASK_STATUSES) });

export const helpRequestSchema = z.object({
  journeyTaskId: id,
  subject: z.string().trim().min(3, "Add a short subject").max(200),
  problemDescription: z.string().trim().min(10, "Describe the problem in a few words").max(2000),
});

export const resolveRequestSchema = z.object({
  requestId: id,
  resolutionText: z.string().trim().min(5, "Write a short answer").max(2000),
});

export const assignRequestSchema = z.object({ requestId: id, mentorUserId: id });

export const universitySchema = z.object({
  universityName: z.string().trim().min(2).max(200),
  city: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a two-letter country code"),
  website: optionalText(500).pipe(z.url("Enter a full URL starting with https://").nullable()),
});

export const templateSchema = z.object({
  universityId: z
    .string()
    .transform((value) => (value === "" || value === "global" ? null : Number(value)))
    .pipe(z.number().int().positive().nullable()),
  taskTitle: z.string().trim().min(3).max(200),
  description: optionalText(1000),
  category: z.string().trim().min(2).max(60),
  journeyStage: z.enum(JOURNEY_STAGES),
  applicableProgram: z.enum(APPLICABLE_PROGRAMS),
  accommodationCondition: z.enum(ACCOMMODATION_CONDITIONS),
  priority: z.coerce.number().int().min(1).max(5),
  isActive: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export const dependencySchema = z.object({ taskId: id, requiredTaskId: id });

export const sourceSchema = z.object({
  taskId: id,
  sourceTitle: z.string().trim().min(2).max(200),
  sourceUrl: optionalText(1000).pipe(z.url("Enter a full URL starting with https://").nullable()),
  sourceStatus: z.enum(SOURCE_STATUSES),
});

export const userAdminSchema = z.object({
  userId: id,
  role: z.enum(USER_ROLES),
  isActive: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
});

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
