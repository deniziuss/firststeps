"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { changePassword, updateProfile } from "@/server/actions/auth";

export function ProfileForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("auth.firstName")} name="firstName" state={state}>
          <Input defaultValue={firstName} autoComplete="given-name" maxLength={100} />
        </Field>
        <Field label={t("auth.lastName")} name="lastName" state={state}>
          <Input defaultValue={lastName} autoComplete="family-name" maxLength={100} />
        </Field>
      </div>
      <SubmitButton className="w-fit" pendingText={t("common.saving")}>
        {t("settings.saveProfile")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function PasswordForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-5" noValidate>
      <Field label={t("settings.currentPassword")} name="currentPassword" state={state}>
        <Input type="password" autoComplete="current-password" />
      </Field>
      <Field label={t("settings.newPassword")} name="newPassword" state={state} hint={t("auth.passwordHint")}>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <Field label={t("settings.confirmNewPassword")} name="confirmPassword" state={state}>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-fit" pendingText={t("settings.changingPassword")}>
        {t("settings.changePassword")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
