"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STUDENT_TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from "@/domain/statuses";
import { createHelpRequest, updateTaskStatus } from "@/server/actions/student";

export function StatusForm({ journeyTaskId, current, locked }: { journeyTaskId: number; current: TaskStatus; locked: boolean }) {
  const [state, action] = useActionState(updateTaskStatus, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="journeyTaskId" value={journeyTaskId} />
      <NativeSelect name="status" defaultValue={current} aria-label="Task status" key={current}>
        {STUDENT_TASK_STATUSES.map((status) => (
          <option key={status} value={status} disabled={status === "Completed" && locked && current !== "Completed"}>
            {TASK_STATUS_LABELS[status]}
            {status === "Completed" && locked && current !== "Completed" ? " (locked)" : ""}
          </option>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">Use &ldquo;Blocked&rdquo; when something outside your control stops you.</p>
      <SubmitButton pendingText="Saving…">Save status</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function HelpRequestForm({ journeyTaskId, taskTitle }: { journeyTaskId: number; taskTitle: string }) {
  const [state, action] = useActionState(createHelpRequest, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3" noValidate>
      <input type="hidden" name="journeyTaskId" value={journeyTaskId} />
      <Field label="Subject" name="subject" state={state}>
        <Input id="subject" name="subject" maxLength={200} placeholder={`Help with: ${taskTitle}`} />
      </Field>
      <Field label="What is the problem?" name="problemDescription" state={state} hint="Do not include passport or visa numbers.">
        <Textarea id="problemDescription" name="problemDescription" rows={4} maxLength={2000} />
      </Field>
      <SubmitButton variant="secondary" pendingText="Sending…">
        Ask a mentor
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
