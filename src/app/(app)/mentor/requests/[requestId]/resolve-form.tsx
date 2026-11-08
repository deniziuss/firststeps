"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Textarea } from "@/components/ui/textarea";
import { resolveHelpRequest } from "@/server/actions/mentor";

export function ResolveForm({ requestId }: { requestId: number }) {
  const [state, action] = useActionState(resolveHelpRequest, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      <Field label="Answer" name="resolutionText" state={state}>
        <Textarea id="resolutionText" name="resolutionText" rows={6} maxLength={2000} />
      </Field>
      <div>
        <SubmitButton pendingText="Sending…">Send answer and resolve</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
