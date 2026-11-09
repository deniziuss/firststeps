"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { requestPasswordReset } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <Field label={t("auth.email")} name="email" state={state}>
        <Input type="email" autoComplete="email" required />
      </Field>
      <SubmitButton pendingText={t("auth.sendingResetLink")} className="w-full">
        {t("auth.sendResetLink")}
      </SubmitButton>
    </form>
  );
}
