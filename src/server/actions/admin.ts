"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { applicabilityGaps, findCycle, type ApplicabilityGap } from "@/domain/dependencyGraph";
import { SOURCE_STATUSES } from "@/domain/statuses";
import { getActionI18n } from "@/i18n/server";
import type { I18n } from "@/i18n/translator";
import {
  assignRequestSchema,
  dbId,
  dependencySchema,
  fieldErrors,
  sourceSchema,
  templateSchema,
  templateTranslationSchema,
  universitySchema,
  userAdminSchema,
} from "@/lib/validation";
import { requireRole } from "../dal";
import { AppError, runAction, toAppError, type ActionResult } from "../errors";
import * as admin from "../repositories/admin";
import * as help from "../repositories/help";
import * as users from "../repositories/users";

const id = dbId;

function invalid({ t, has }: I18n, error: z.ZodError): ActionResult {
  return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(error, t, has) };
}

export async function saveTemplate(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const i18n = await getActionI18n();
  const taskId = id.optional().safeParse(formData.get("taskId") || undefined);
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(i18n, parsed.error);
  if (!taskId.success) return { ok: false, error: i18n.t("errors.templateNotFound") };

  let newId: number | undefined;
  try {
    if (taskId.data) await admin.updateTemplate(taskId.data, parsed.data);
    else newId = await admin.createTemplate(parsed.data);
  } catch (error) {
    const appError = toAppError(error);
    return { ok: false, error: i18n.t(appError.key, appError.vars) };
  }
  revalidatePath("/admin/templates", "layout");
  if (newId) redirect(`/admin/templates/${newId}`);
  return { ok: true, message: i18n.t("admin.templates.saved") };
}

export async function saveTemplateTranslation(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const i18n = await getActionI18n();
  const parsed = templateTranslationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(i18n, parsed.error);
  const result = await runAction(i18n.t, () => admin.saveTemplateTranslation(parsed.data.taskId, parsed.data.taskTitle, parsed.data.description));
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: i18n.t("admin.templates.translationSaved") } : result;
}

function gapText({ t }: I18n, gap: ApplicabilityGap) {
  if (gap.kind === "scope") return t("admin.templates.gapScope");
  if (gap.kind === "programme") return t("admin.templates.gapProgramme", { value: t(`programmes.${gap.value as "Erasmus"}.label`) });
  return t("admin.templates.gapAccommodation", { value: t(`accommodationOptions.${gap.value as "Confirmed"}.label`) });
}

export async function addDependency(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const i18n = await getActionI18n();
  const { t } = i18n;
  const parsed = dependencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.required") };
  const { taskId, requiredTaskId } = parsed.data;

  const [dependencies, dependent, prerequisite] = await Promise.all([admin.listAllDependencies(), admin.getTemplate(taskId), admin.getTemplate(requiredTaskId)]);
  if (!dependent || !prerequisite) return { ok: false, error: t("errors.templateNotFound") };

  const cycle = findCycle(dependencies, taskId, requiredTaskId);
  if (cycle) {
    const titles = new Map((await admin.listTemplates()).map((tpl) => [tpl.TaskID, tpl.TaskTitle]));
    const path = [taskId, ...cycle].map((tid) => titles.get(tid) ?? `#${tid}`).join(" → ");
    return { ok: false, error: t("admin.templates.cycle", { path }) };
  }

  const toRule = (tpl: admin.TemplateRow) => ({ universityId: tpl.UniversityID, applicableProgram: tpl.ApplicableProgram, accommodationCondition: tpl.AccommodationCondition });
  const gaps = applicabilityGaps(toRule(dependent), toRule(prerequisite));
  if (gaps.length > 0 && formData.get("acknowledgeGaps") !== "on") {
    return {
      ok: false,
      error: t("admin.templates.gaps", { task: dependent.TaskTitle, required: prerequisite.TaskTitle, reasons: gaps.map((g) => gapText(i18n, g)).join(" ") }),
      fieldErrors: { acknowledgeGaps: [t("admin.templates.acknowledgeGaps")] },
    };
  }

  const result = await runAction(t, () => admin.addDependency(taskId, requiredTaskId), "admin.templates.dependencyExists");
  revalidatePath(`/admin/templates/${taskId}`);
  return result.ok ? { ok: true, message: t("admin.templates.prereqAdded") } : result;
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
  const i18n = await getActionI18n();
  const parsed = sourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(i18n, parsed.error);
  const result = await runAction(i18n.t, () => admin.createSource(parsed.data));
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: i18n.t("admin.sources.added") } : result;
}

const sourceStatusSchema = z.object({ sourceId: id, status: z.enum(SOURCE_STATUSES) });

export async function setSourceStatus(formData: FormData) {
  await requireRole("Admin");
  const parsed = sourceStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await admin.setSourceStatus(parsed.data.sourceId, parsed.data.status);
  revalidatePath("/", "layout");
}

export async function deleteSource(formData: FormData) {
  await requireRole("Admin");
  const parsed = z.object({ sourceId: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await admin.deleteSource(parsed.data.sourceId);
  revalidatePath("/", "layout");
}

export async function saveUniversity(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const i18n = await getActionI18n();
  const universityId = id.optional().safeParse(formData.get("universityId") || undefined);
  const parsed = universitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(i18n, parsed.error);
  if (!universityId.success) return { ok: false, error: i18n.t("errors.universityNotFound") };
  const result = await runAction(
    i18n.t,
    async () => {
      if (universityId.data) await admin.updateUniversity(universityId.data, parsed.data);
      else await admin.createUniversity(parsed.data);
    },
    "admin.universities.exists",
  );
  revalidatePath("/admin/universities");
  return result.ok ? { ok: true, message: i18n.t("admin.universities.saved") } : result;
}

export async function assignMentor(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  await requireRole("Admin");
  const { t } = await getActionI18n();
  const parsed = assignRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.required") };
  const result = await runAction(t, () => help.assignMentor(parsed.data.requestId, parsed.data.mentorUserId));
  revalidatePath("/admin/requests");
  return result.ok ? { ok: true, message: t("admin.requests.assigned") } : result;
}

export async function saveUser(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const current = await requireRole("Admin");
  const { t } = await getActionI18n();
  const parsed = userAdminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields") };
  if (parsed.data.userId === current.id && (parsed.data.role !== "Admin" || !parsed.data.isActive)) {
    return { ok: false, error: t("admin.users.selfDemote") };
  }
  const result = await runAction(t, async () => {
    const affected = await users.setUserRoleAndStatus(parsed.data.userId, parsed.data.role, parsed.data.isActive);
    if (affected === 0) throw new AppError("errors.userNotFound", undefined, "notFound");
  });
  revalidatePath("/admin/users");
  return result.ok ? { ok: true, message: t("admin.users.saved") } : result;
}
