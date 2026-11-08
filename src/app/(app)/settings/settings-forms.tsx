"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { changePassword, updateProfile } from "@/server/actions/auth";

export function ProfileForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" state={state}>
          <Input id="firstName" name="firstName" defaultValue={firstName} autoComplete="given-name" maxLength={100} />
        </Field>
        <Field label="Last name" name="lastName" state={state}>
          <Input id="lastName" name="lastName" defaultValue={lastName} autoComplete="family-name" maxLength={100} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4" noValidate>
      <Field label="Current password" name="currentPassword" state={state}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
      </Field>
      <Field label="New password" name="newPassword" state={state} hint="At least 10 characters.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" name="confirmPassword" state={state}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
      </Field>
      <div>
        <SubmitButton pendingText="Changing…">Change password</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
