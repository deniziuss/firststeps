"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { confirmEmail } from "@/server/actions/auth";

export function ConfirmEmailForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(confirmEmail, undefined);
  if (state?.ok) {
    return (
      <div className="grid gap-5">
        <FormMessage state={state} />
        <Button asChild className="w-fit">
          <Link href="/dashboard">{t("verify.continue")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton pendingText={t("verify.confirming")} className="w-full">
        {t("verify.confirm")}
      </SubmitButton>
    </form>
  );
}
