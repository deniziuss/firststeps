"use client";

import { useActionState } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACCOMMODATION_STATUSES, JOURNEY_STAGES, PROGRAM_TYPES } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import { saveTemplate } from "@/server/actions/admin";
import type { TemplateRow } from "@/server/repositories/admin";

export function TemplateForm({ template, universities }: { template?: TemplateRow; universities: { id: number; label: string }[] }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveTemplate, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      {template && <input type="hidden" name="taskId" value={template.TaskID} />}
      <Field label={t("admin.templates.fields.title")} name="taskTitle" state={state}>
        <Input defaultValue={template?.TaskTitle} maxLength={200} />
      </Field>
      <Field label={t("admin.templates.fields.guidance")} name="description" state={state} hint={t("admin.templates.fields.guidanceHint")}>
        <Textarea defaultValue={template?.Description ?? ""} rows={4} maxLength={1000} />
      </Field>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label={t("admin.templates.fields.scope")} name="universityId" state={state}>
          <NativeSelect defaultValue={template?.UniversityID ?? "global"}>
            <option value="global">{t("admin.templates.allUniversities")}</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("admin.templates.fields.category")} name="category" state={state} hint={t("admin.templates.fields.categoryHint")}>
          <Input defaultValue={template?.Category} maxLength={60} list="categories" />
        </Field>
        <Field label={t("admin.templates.fields.stage")} name="journeyStage" state={state}>
          <NativeSelect defaultValue={template?.JourneyStage ?? "BeforeArrival"}>
            {JOURNEY_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stages.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("admin.templates.fields.priority")} name="priority" state={state}>
          <Input type="number" min={1} max={5} defaultValue={template?.Priority ?? 3} />
        </Field>
        <Field label={t("admin.templates.fields.programme")} name="applicableProgram" state={state}>
          <NativeSelect defaultValue={template?.ApplicableProgram ?? "All"}>
            <option value="All">{t("admin.templates.programmeAll")}</option>
            {PROGRAM_TYPES.map((p) => (
              <option key={p} value={p}>
                {t("admin.templates.programmeOnly", { value: t(`programmes.${p}.label`) })}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("admin.templates.fields.accommodation")} name="accommodationCondition" state={state}>
          <NativeSelect defaultValue={template?.AccommodationCondition ?? "Any"}>
            <option value="Any">{t("admin.templates.accommodationAny")}</option>
            {ACCOMMODATION_STATUSES.map((a) => (
              <option key={a} value={a}>
                {t("admin.templates.accommodationOnly", { value: t(`accommodationOptions.${a}.label`) })}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <datalist id="categories">
        {["University", "Housing", "Documents", "Transport", "DailyLife", "Health"].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="isActive" defaultChecked={template?.IsActive ?? true} className="size-5 accent-primary" />
        {t("admin.templates.fields.active")}
      </label>
      <SubmitButton className="w-fit" pendingText={t("common.saving")}>
        {template ? t("admin.templates.saveChanges") : t("admin.templates.create")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
