"use client";

import { useActionState } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JOURNEY_STAGES, STAGE_LABELS } from "@/domain/statuses";
import { saveTemplate } from "@/server/actions/admin";
import type { TemplateRow } from "@/server/repositories/admin";

export function TemplateForm({ template, universities }: { template?: TemplateRow; universities: { id: number; label: string }[] }) {
  const [state, action] = useActionState(saveTemplate, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {template && <input type="hidden" name="taskId" value={template.TaskID} />}
      <Field label="Title" name="taskTitle" state={state}>
        <Input id="taskTitle" name="taskTitle" defaultValue={template?.TaskTitle} maxLength={200} />
      </Field>
      <Field label="Guidance" name="description" state={state} hint="What the student should do. Avoid legal conclusions; link sources instead.">
        <Textarea id="description" name="description" defaultValue={template?.Description ?? ""} rows={4} maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scope" name="universityId" state={state}>
          <NativeSelect id="universityId" name="universityId" defaultValue={template?.UniversityID ?? "global"}>
            <option value="global">All universities</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Category" name="category" state={state} hint="e.g. University, Housing, Documents, Transport, DailyLife, Health">
          <Input id="category" name="category" defaultValue={template?.Category} maxLength={60} list="categories" />
        </Field>
        <Field label="Stage" name="journeyStage" state={state}>
          <NativeSelect id="journeyStage" name="journeyStage" defaultValue={template?.JourneyStage ?? "BeforeArrival"}>
            {JOURNEY_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Priority (1 = highest)" name="priority" state={state}>
          <Input id="priority" name="priority" type="number" min={1} max={5} defaultValue={template?.Priority ?? 3} />
        </Field>
        <Field label="Programme" name="applicableProgram" state={state}>
          <NativeSelect id="applicableProgram" name="applicableProgram" defaultValue={template?.ApplicableProgram ?? "All"}>
            <option value="All">All programmes</option>
            <option value="Erasmus">Erasmus only</option>
            <option value="FullTime">Full-time only</option>
            <option value="Other">Other only</option>
          </NativeSelect>
        </Field>
        <Field label="Accommodation" name="accommodationCondition" state={state}>
          <NativeSelect id="accommodationCondition" name="accommodationCondition" defaultValue={template?.AccommodationCondition ?? "Any"}>
            <option value="Any">Any</option>
            <option value="NotArranged">Only when not arranged</option>
            <option value="Confirmed">Only when confirmed</option>
          </NativeSelect>
        </Field>
      </div>
      <datalist id="categories">
        {["University", "Housing", "Documents", "Transport", "DailyLife", "Health"].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={template?.IsActive ?? true} className="size-4 accent-primary" />
        Active (assigned to new journeys)
      </label>
      <div>
        <SubmitButton pendingText="Saving…">{template ? "Save changes" : "Create template"}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
