"use server";

import { revalidatePath } from "next/cache";
import { getActionI18n } from "@/i18n/server";
import { fieldErrors, resolveRequestSchema } from "@/lib/validation";
import { requireRole } from "../dal";
import { runAction, type ActionResult } from "../errors";
import * as help from "../repositories/help";

export async function resolveHelpRequest(_: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireRole("Mentor", "Admin");
  const { t, has } = await getActionI18n();
  const parsed = resolveRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("validation.checkFields"), fieldErrors: fieldErrors(parsed.error, t, has) };
  const result = await runAction(t, () =>
    help.resolveRequest({ id: user.id, isAdmin: user.role === "Admin" }, parsed.data.requestId, parsed.data.resolutionText),
  );
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: t("mentor.sentAnswer") } : result;
}
