"use client";

import { MailWarningIcon } from "lucide-react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { useI18n } from "@/i18n/client";
import { resendVerification } from "@/server/actions/auth";

// Shown to students who have not confirmed their email address yet.
export function VerifyBanner({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resendVerification, undefined);
  return (
    <section aria-labelledby="verify-banner" className="shape-cut-sm grid gap-3 border border-ochre/50 bg-gold-soft p-5 sm:flex sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <MailWarningIcon className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        <div>
          <h2 id="verify-banner" className="font-heading text-lg font-medium">
            {t("verify.bannerTitle")}
          </h2>
          <p className="mt-1 text-sm text-foreground-soft">{t("verify.bannerText", { email })}</p>
          <FormMessage state={state} className="mt-3" />
        </div>
      </div>
      <form action={action} className="shrink-0">
        <SubmitButton variant="outline" size="sm" pendingText={t("verify.resending")}>
          {t("verify.resend")}
        </SubmitButton>
      </form>
    </section>
  );
}
