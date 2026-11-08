"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { JOURNEY_STATUSES } from "@/domain/statuses";
import { accommodationSchema, fieldErrors, helpRequestSchema, journeySchema, taskStatusSchema } from "@/lib/validation";
import { requireRole } from "../dal";
import { isUniqueViolation, runAction, toAppError, type ActionResult } from "../errors";
import * as help from "../repositories/help";
import * as journeys from "../repositories/journeys";
import * as tasks from "../repositories/tasks";

export async function createJourney(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const parsed = journeySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  let journeyId: number;
  try {
    journeyId = await journeys.createJourney(user.id, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "You already have a journey to this university on this date." };
    return { ok: false, error: toAppError(error).message };
  }
  redirect(`/journey/${journeyId}`);
}

export async function changeAccommodation(_: ActionResult<{ added: number; retired: number; reopened: number }> | undefined, formData: FormData) {
  const user = await requireRole("Student");
  const parsed = accommodationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "Choose an accommodation status." };
  const result = await runAction(() => journeys.changeAccommodation(user.id, parsed.data.journeyId, parsed.data.accommodationStatus));
  revalidatePath(`/journey/${parsed.data.journeyId}`);
  return result;
}

const journeyStatusSchema = z.object({ journeyId: z.coerce.number().int().positive(), status: z.enum(JOURNEY_STATUSES) });

export async function setJourneyStatus(formData: FormData) {
  const user = await requireRole("Student");
  const parsed = journeyStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await journeys.setJourneyStatus(user.id, parsed.data.journeyId, parsed.data.status);
  revalidatePath(`/journey/${parsed.data.journeyId}`);
}

export async function updateTaskStatus(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const parsed = taskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Choose a valid status." };
  const result = await runAction(() => tasks.updateTaskStatus(user.id, parsed.data.journeyTaskId, parsed.data.status));
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: "Task updated." } : result;
}

export async function createHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const parsed = helpRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const result = await runAction(() => help.createHelpRequest(user.id, parsed.data));
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: "Your request was sent. A mentor will answer it here." } : result;
}

const requestIdSchema = z.object({ requestId: z.coerce.number().int().positive() });

export async function withdrawHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const result = await runAction(() => help.withdrawRequest(user.id, parsed.data.requestId));
  revalidatePath("/", "layout");
  return result;
}

export async function closeHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Student");
  const parsed = requestIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const result = await runAction(() => help.closeOwnRequest(user.id, parsed.data.requestId));
  revalidatePath("/", "layout");
  return result;
}
