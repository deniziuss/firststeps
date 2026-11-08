"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { addDependency, addSource } from "@/server/actions/admin";

export function DependencyForm({ taskId, candidates }: { taskId: number; candidates: { id: number; label: string }[] }) {
  const [state, action] = useActionState(addDependency, undefined);
  const needsConfirmation = state && !state.ok && state.error.includes("Tick the confirmation box");
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <NativeSelect name="requiredTaskId" aria-label="Prerequisite task">
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
      {needsConfirmation && (
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" name="acknowledgeGaps" className="mt-0.5 size-4 accent-primary" />
          I understand that some students may not be able to complete this task.
        </label>
      )}
      <SubmitButton variant="secondary" size="sm">
        Add prerequisite
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AddSourceForm({ taskId }: { taskId: number }) {
  const [state, action] = useActionState(addSource, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 border-t pt-4" noValidate>
      <input type="hidden" name="taskId" value={taskId} />
      <Field label="Source title" name="sourceTitle" state={state}>
        <Input id="sourceTitle" name="sourceTitle" maxLength={200} />
      </Field>
      <Field label="URL" name="sourceUrl" state={state}>
        <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://" maxLength={1000} />
      </Field>
      <Field label="Status" name="sourceStatus" state={state} hint="Choose Verified only after checking the page yourself.">
        <NativeSelect id="sourceStatus" name="sourceStatus" defaultValue="PendingReview">
          <option value="PendingReview">Review pending</option>
          <option value="Verified">Verified now</option>
          <option value="Outdated">Outdated</option>
        </NativeSelect>
      </Field>
      <SubmitButton variant="secondary" size="sm">
        Add source
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
