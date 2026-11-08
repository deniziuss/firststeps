"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors, resolveRequestSchema } from "@/lib/validation";
import { requireRole } from "../dal";
import { runAction, type ActionResult } from "../errors";
import * as help from "../repositories/help";

export async function resolveHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Mentor", "Admin");
  const parsed = resolveRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const result = await runAction(() =>
    help.resolveRequest({ id: user.id, isAdmin: user.role === "Admin" }, parsed.data.requestId, parsed.data.resolutionText),
  );
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: "Answer sent to the student." } : result;
}
