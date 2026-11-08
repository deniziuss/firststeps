"use client";

import { CheckIcon, MessageCircleQuestionIcon, OctagonAlertIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmSubmit, Field, FormMessage, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudentTaskStatus, TaskStatus } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import type { ActionResult } from "@/server/errors";
import { createHelpRequest, refreshPlan, updateTaskStatus } from "@/server/actions/student";

type Dispatch = (formData: FormData) => void;

function StatusForm({ action, journeyTaskId, status, children }: { action: Dispatch; journeyTaskId: number; status: StudentTaskStatus; children: React.ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="journeyTaskId" value={journeyTaskId} />
      <input type="hidden" name="status" value={status} />
      {children}
    </form>
  );
}

// One clear primary action for the current state, with secondary actions below it.
export function StatusActions({ journeyTaskId, status, locked }: { journeyTaskId: number; status: TaskStatus; locked: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionResult | undefined, FormData>(updateTaskStatus, undefined);
  const props = { action, journeyTaskId };

  return (
    <div className="grid gap-3">
      {status === "Completed" ? (
        <StatusForm {...props} status="Pending">
          <ConfirmSubmit variant="outline" className="w-full" title={t("task.reopenConfirmTitle")} description={t("task.reopenConfirmText")} confirmLabel={t("task.reopen")}>
            <RotateCcwIcon aria-hidden /> {t("task.reopen")}
          </ConfirmSubmit>
        </StatusForm>
      ) : status === "Blocked" ? (
        <StatusForm {...props} status="InProgress">
          <SubmitButton className="w-full" pendingText={t("common.saving")}>
            <PlayIcon aria-hidden /> {t("task.resume")}
          </SubmitButton>
        </StatusForm>
      ) : (
        <>
          <StatusForm {...props} status="Completed">
            <SubmitButton className="w-full" disabled={locked} pendingText={t("common.saving")}>
              <CheckIcon aria-hidden /> {t("task.markDone")}
            </SubmitButton>
          </StatusForm>
          {status === "Pending" && !locked && (
            <StatusForm {...props} status="InProgress">
              <SubmitButton variant="outline" className="w-full" pendingText={t("common.saving")}>
                <PlayIcon aria-hidden /> {t("task.start")}
              </SubmitButton>
            </StatusForm>
          )}
          <StatusForm {...props} status="Blocked">
            <SubmitButton variant="ghost" size="sm" className="w-full text-muted-foreground" pendingText={t("common.saving")}>
              <OctagonAlertIcon aria-hidden /> {t("task.markBlocked")}
            </SubmitButton>
          </StatusForm>
        </>
      )}
      <FormMessage state={state} />
    </div>
  );
}

export function HelpRequestForm({ journeyTaskId, taskTitle, startOpen = false }: { journeyTaskId: number; taskTitle: string; startOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(startOpen);
  const [state, action] = useActionState(createHelpRequest, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <div className="grid gap-3">
        <FormMessage state={state} />
        <Button variant="outline" className="w-fit" onClick={() => setOpen(true)} aria-expanded={false}>
          <MessageCircleQuestionIcon aria-hidden /> {t("help.openForm")}
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="grid gap-5 rounded-xl border bg-card p-5" noValidate>
      <input type="hidden" name="journeyTaskId" value={journeyTaskId} />
      <Field label={t("help.subject")} name="subject" state={state}>
        <Input maxLength={200} placeholder={t("help.subjectPlaceholder", { task: taskTitle })} />
      </Field>
      <Field label={t("help.problem")} name="problemDescription" state={state} hint={t("help.problemHint")}>
        <Textarea rows={4} maxLength={2000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText={t("help.sending")}>{t("help.send")}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function RefreshPlanForm({ journeyId }: { journeyId: number }) {
  const { t } = useI18n();
  const [state, action] = useActionState(refreshPlan, undefined);
  return (
    <form action={action} className="grid justify-items-start gap-3">
      <input type="hidden" name="journeyId" value={journeyId} />
      <SubmitButton pendingText={t("journey.updatingPlan")}>{t("journey.updatePlan")}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
