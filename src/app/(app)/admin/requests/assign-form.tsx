"use client";

import { useActionState } from "react";
import { NativeSelect, SubmitButton } from "@/components/form";
import { assignMentor } from "@/server/actions/admin";

export function AssignForm({ requestId, mentors }: { requestId: number; mentors: { id: number; label: string }[] }) {
  const [state, action] = useActionState(assignMentor, undefined);
  if (mentors.length === 0) return <p className="text-xs text-muted-foreground">No active mentors. Promote a user first.</p>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <NativeSelect name="mentorUserId" aria-label="Mentor" className="w-56">
        {mentors.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </NativeSelect>
      <SubmitButton size="sm" variant="secondary">
        Assign
      </SubmitButton>
      {state && <span className={state.ok ? "text-xs text-success" : "text-xs text-destructive"}>{state.ok ? state.message : state.error}</span>}
    </form>
  );
}
