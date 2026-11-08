"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { register } from "@/server/actions/auth";

export function RegisterForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("auth.firstName")} name="firstName" state={state}>
          <Input autoComplete="given-name" required maxLength={100} />
        </Field>
        <Field label={t("auth.lastName")} name="lastName" state={state}>
          <Input autoComplete="family-name" required maxLength={100} />
        </Field>
      </div>
      <Field label={t("auth.email")} name="email" state={state}>
        <Input type="email" autoComplete="email" required maxLength={255} />
      </Field>
      <Field label={t("auth.password")} name="password" state={state} hint={t("auth.passwordHint")}>
        <Input type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
      </Field>
      <Field label={t("auth.confirmPassword")} name="confirmPassword" state={state}>
        <Input type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingText={t("auth.creatingAccount")} className="w-full">
        {t("auth.createAccount")}
      </SubmitButton>
    </form>
  );
}
