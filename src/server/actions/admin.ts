"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applicabilityGaps, findCycle } from "@/domain/dependencyGraph";
import { SOURCE_STATUSES } from "@/domain/statuses";
import { assignRequestSchema, dependencySchema, fieldErrors, sourceSchema, templateSchema, universitySchema, userAdminSchema } from "@/lib/validation";
import { requireRole } from "../dal";
import { runAction, toAppError, type ActionResult } from "../errors";
import * as admin from "../repositories/admin";
import * as help from "../repositories/help";
import * as users from "../repositories/users";

const id = z.coerce.number().int().positive();

function invalid(error: z.ZodError): ActionResult {
  return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(error) };
}

export async function saveTemplate(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const taskId = id.optional().safeParse(formData.get("taskId") || undefined);
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !taskId.success) return parsed.success ? { ok: false, error: "Invalid template." } : invalid(parsed.error);

  let newId: number | undefined;
  try {
    if (taskId.data) await admin.updateTemplate(taskId.data, parsed.data);
    else newId = await admin.createTemplate(parsed.data);
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
  revalidatePath("/admin/templates", "layout");
  if (newId) redirect(`/admin/templates/${newId}`);
  return { ok: true, message: "Template saved. New and re-planned journeys use the new version." };
}

export async function addDependency(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const parsed = dependencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Choose a prerequisite task." };
  const { taskId, requiredTaskId } = parsed.data;

  const [dependencies, dependent, prerequisite] = await Promise.all([admin.listAllDependencies(), admin.getTemplate(taskId), admin.getTemplate(requiredTaskId)]);
  if (!dependent || !prerequisite) return { ok: false, error: "Task not found." };

  const cycle = findCycle(dependencies, taskId, requiredTaskId);
  if (cycle) {
    const titles = new Map((await admin.listTemplates()).map((t) => [t.TaskID, t.TaskTitle]));
    const path = [taskId, ...cycle].map((tid) => titles.get(tid) ?? `#${tid}`).join(" → requires → ");
    return { ok: false, error: `This would create a cycle: ${path}. A task cannot depend on itself through other tasks.` };
  }

  const toRule = (t: admin.TemplateRow) => ({ universityId: t.UniversityID, applicableProgram: t.ApplicableProgram, accommodationCondition: t.AccommodationCondition });
  const gaps = applicabilityGaps(toRule(dependent), toRule(prerequisite));
  if (gaps.length > 0 && formData.get("acknowledgeGaps") !== "on") {
    return {
      ok: false,
      error: `Some students would get "${dependent.TaskTitle}" without "${prerequisite.TaskTitle}", and could never complete it. ${gaps.join(" ")} Tick the confirmation box to add it anyway.`,
    };
  }

  const result = await runAction(() => admin.addDependency(taskId, requiredTaskId), "This dependency already exists.");
  revalidatePath(`/admin/templates/${taskId}`);
  return result.ok ? { ok: true, message: "Prerequisite added." } : result;
}

export async function removeDependency(formData: FormData) {
  await requireRole("Admin");
  const parsed = dependencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await admin.removeDependency(parsed.data.taskId, parsed.data.requiredTaskId);
  revalidatePath(`/admin/templates/${parsed.data.taskId}`);
}

export async function addSource(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);
  const result = await runAction(() => admin.createSource(parsed.data));
  revalidatePath("/admin", "layout");
  return result.ok ? { ok: true, message: "Source added." } : result;
}

const sourceStatusSchema = z.object({ sourceId: id, status: z.enum(SOURCE_STATUSES) });

export async function setSourceStatus(formData: FormData) {
  await requireRole("Admin");
  const parsed = sourceStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await admin.setSourceStatus(parsed.data.sourceId, parsed.data.status);
  revalidatePath("/admin", "layout");
}

export async function deleteSource(formData: FormData) {
  await requireRole("Admin");
  const parsed = z.object({ sourceId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await admin.deleteSource(parsed.data.sourceId);
  revalidatePath("/admin", "layout");
}

export async function saveUniversity(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const universityId = id.optional().safeParse(formData.get("universityId") || undefined);
  const parsed = universitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !universityId.success) return parsed.success ? { ok: false, error: "Invalid university." } : invalid(parsed.error);
  const result = await runAction(async () => {
    if (universityId.data) await admin.updateUniversity(universityId.data, parsed.data);
    else await admin.createUniversity(parsed.data);
  }, "A university with this name already exists in this city.");
  revalidatePath("/admin/universities");
  return result.ok ? { ok: true, message: "University saved." } : result;
}

export async function assignMentor(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const parsed = assignRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Choose a mentor." };
  const result = await runAction(() => help.assignMentor(parsed.data.requestId, parsed.data.mentorUserId));
  revalidatePath("/admin/requests");
  return result.ok ? { ok: true, message: "Mentor assigned." } : result;
}

export async function saveUser(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const current = await requireRole("Admin");
  const parsed = userAdminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid user settings." };
  if (parsed.data.userId === current.id && (parsed.data.role !== "Admin" || !parsed.data.isActive)) {
    return { ok: false, error: "You cannot remove your own admin access." };
  }
  const result = await runAction(() => users.setUserRoleAndStatus(parsed.data.userId, parsed.data.role, parsed.data.isActive));
  revalidatePath("/admin/users");
  return result.ok ? { ok: true, message: "User updated." } : result;
}
