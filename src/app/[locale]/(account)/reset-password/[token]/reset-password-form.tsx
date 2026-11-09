"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { resetPassword } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label={t("settings.newPassword")} name="newPassword" state={state} hint={t("auth.passwordHint")}>
        <Input type="password" autoComplete="new-password" required />
      </Field>
      <Field label={t("settings.confirmNewPassword")} name="confirmPassword" state={state}>
        <Input type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingText={t("auth.resetting")} className="w-full">
        {t("auth.resetSubmit")}
      </SubmitButton>
    </form>
  );
}
