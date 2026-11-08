"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { signIn } from "@/server/actions/auth";

export function SignInForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <Field label={t("auth.email")} name="email" state={state}>
        <Input type="email" autoComplete="email" required />
      </Field>
      <Field label={t("auth.password")} name="password" state={state}>
        <Input type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingText={t("auth.signingIn")} className="w-full">
        {t("auth.signIn")}
      </SubmitButton>
    </form>
  );
}
