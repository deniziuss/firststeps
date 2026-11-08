"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { JOURNEY_STATUSES } from "@/domain/statuses";
import { getActionI18n } from "@/i18n/server";
import { accommodationSchema, fieldErrors, helpRequestSchema, journeySchema, taskStatusSchema } from "@/lib/validation";
import { requireRole } from "../dal";
import { isUniqueViolation, runAction, toAppError, type ActionResult } from "../errors";
import * as help from "../repositories/help";
import * as journeys from "../repositories/journeys";
import * as tasks from "../repositories/tasks";

export async function createJourney(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t, has } = await getActionI18n();
  const parsed = journeySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };

  let journeyId: number;
  try {
    journeyId = await journeys.createJourney(user.id, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: t("onboarding.duplicate") };
    const appError = toAppError(error);
    return { ok: false, error: t(appError.key, appError.vars) };
  }
  redirect(`/journey/${journeyId}`);
}

export async function changeAccommodation(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t } = await getActionI18n();
  const parsed = accommodationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields") };
  const result = await runAction(t, () => journeys.changeAccommodation(user.id, parsed.data.journeyId, parsed.data.accommodationStatus));
  revalidatePath(`/journey/${parsed.data.journeyId}`);
  if (!result.ok) return result;
  return { ok: true, message: t("journey.planUpdated", { added: result.data!.added, retired: result.data!.retired, reopened: result.data!.reopened }) };
}

const journeyStatusSchema = z.object({ journeyId: z.coerce.number().int().positive(), status: z.enum(JOURNEY_STATUSES) });

export async function setJourneyStatus(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t } = await getActionI18n();
  const parsed = journeyStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields") };
  await journeys.setJourneyStatus(user.id, parsed.data.journeyId, parsed.data.status);
  revalidatePath(`/journey/${parsed.data.journeyId}`);
  return { ok: true, message: t("journey.statusSaved") };
}

export async function updateTaskStatus(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t, locale } = await getActionI18n();
  const parsed = taskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields") };
  const result = await runAction(t, () => tasks.updateTaskStatus(user.id, parsed.data.journeyTaskId, parsed.data.status, locale));
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: t("task.updated") } : result;
}

export async function createHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t, has } = await getActionI18n();
  const parsed = helpRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };
  const result = await runAction(t, () => help.createHelpRequest(user.id, parsed.data));
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: t("help.sent") } : result;
}

const requestIdSchema = z.object({ requestId: z.coerce.number().int().positive() });

export async function withdrawHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t } = await getActionI18n();
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("errors.requestNotFound") };
  const result = await runAction(t, () => help.withdrawRequest(user.id, parsed.data.requestId));
  revalidatePath("/", "layout");
  return result;
}

export async function closeHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const { t } = await getActionI18n();
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("errors.requestNotFound") };
  const result = await runAction(t, () => help.closeOwnRequest(user.id, parsed.data.requestId));
  revalidatePath("/", "layout");
  return result;
}
