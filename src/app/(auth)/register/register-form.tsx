"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { register } from "@/server/actions/auth";

export function RegisterForm() {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" state={state}>
          <Input id="firstName" name="firstName" autoComplete="given-name" required maxLength={100} />
        </Field>
        <Field label="Last name" name="lastName" state={state}>
          <Input id="lastName" name="lastName" autoComplete="family-name" required maxLength={100} />
        </Field>
      </div>
      <Field label="Email" name="email" state={state}>
        <Input id="email" name="email" type="email" autoComplete="email" required maxLength={255} />
      </Field>
      <Field label="Password" name="password" state={state} hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
      </Field>
      <Field label="Confirm password" name="confirmPassword" state={state}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
