"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/server/actions/auth";

export function SignInForm() {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Email" name="email" state={state}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" name="password" state={state}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
