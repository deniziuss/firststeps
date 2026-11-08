"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/client";
import { addDependency, addSource, saveTemplateTranslation } from "@/server/actions/admin";

export function DependencyForm({ taskId, candidates }: { taskId: number; candidates: { id: number; label: string }[] }) {
  const { t } = useI18n();
  const [state, action] = useActionState(addDependency, undefined);
  const needsConfirmation = state && !state.ok && state.fieldErrors?.acknowledgeGaps;
  return (
    <form action={action} className="grid gap-3 border-t pt-4">
      <input type="hidden" name="taskId" value={taskId} />
      <Field label={t("admin.templates.prereqTask")} name="requiredTaskId">
        <NativeSelect>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {needsConfirmation && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acknowledgeGaps" className="mt-0.5 size-5 accent-primary" />
          {t("admin.templates.acknowledgeGaps")}
        </label>
      )}
      <SubmitButton variant="outline" className="w-fit">
        {t("admin.templates.addPrereq")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function TranslationForm({ taskId, title, description }: { taskId: number; title: string; description: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveTemplateTranslation, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate lang="tr">
      <input type="hidden" name="taskId" value={taskId} />
      <Field label={t("admin.templates.translationTitleField")} name="taskTitle" state={state}>
        <Input defaultValue={title} maxLength={200} />
      </Field>
      <Field label={t("admin.templates.translationGuidanceField")} name="description" state={state}>
        <Textarea defaultValue={description} rows={4} maxLength={1000} />
      </Field>
      <SubmitButton variant="outline" className="w-fit" pendingText={t("common.saving")}>
        {t("admin.templates.saveTranslation")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AddSourceForm({ taskId }: { taskId: number }) {
  const { t } = useI18n();
  const [state, action] = useActionState(addSource, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 border-t pt-4" noValidate>
      <input type="hidden" name="taskId" value={taskId} />
      <Field label={t("admin.sources.addTitle")} name="sourceTitle" state={state}>
        <Input maxLength={200} />
      </Field>
      <Field label={t("admin.sources.titleTr")} name="sourceTitleTr" state={state}>
        <Input maxLength={200} lang="tr" />
      </Field>
      <Field label={t("admin.sources.addUrl")} name="sourceUrl" state={state}>
        <Input type="url" placeholder="https://" maxLength={1000} />
      </Field>
      <Field label={t("admin.sources.addStatus")} name="sourceStatus" state={state} hint={t("admin.sources.addStatusHint")}>
        <NativeSelect defaultValue="PendingReview">
          <option value="PendingReview">{t("sourceStatus.PendingReview.label")}</option>
          <option value="Verified">{t("admin.sources.verifiedNow")}</option>
          <option value="Outdated">{t("sourceStatus.Outdated.label")}</option>
        </NativeSelect>
      </Field>
      <SubmitButton variant="outline" className="w-fit">
        {t("admin.sources.add")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
