"use client";

import { useSearchParams } from "next/navigation";
import { FormMessage } from "@/components/form";
import { useI18n } from "@/i18n/client";

// Shown after a successful password reset (/sign-in?reset=1).
export function ResetNotice() {
  const { t } = useI18n();
  const reset = useSearchParams().get("reset") === "1";
  return reset ? <FormMessage state={{ ok: true, message: t("auth.resetDone") }} /> : null;
}
