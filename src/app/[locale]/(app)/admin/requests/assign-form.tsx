"use client";

import { useActionState, useId } from "react";
import { NativeSelect, SubmitButton } from "@/components/form";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/client";
import { assignMentor } from "@/server/actions/admin";

export function AssignForm({ requestId, mentors }: { requestId: number; mentors: { id: number; label: string }[] }) {
  const { t } = useI18n();
  const id = useId();
  const [state, action] = useActionState(assignMentor, undefined);
  if (mentors.length === 0) return <p className="text-sm text-muted-foreground">{t("admin.requests.noMentors")}</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-1">
        <Label htmlFor={id} className="text-sm">
          {t("admin.requests.mentor")}
        </Label>
        <NativeSelect id={id} name="mentorUserId" className="w-60">
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton variant="outline">{t("admin.requests.assign")}</SubmitButton>
      {state && (
        <span role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </form>
  );
}
