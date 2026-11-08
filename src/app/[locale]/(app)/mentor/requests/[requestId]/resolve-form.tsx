"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/client";
import { resolveHelpRequest } from "@/server/actions/mentor";

export function ResolveForm({ requestId }: { requestId: number }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resolveHelpRequest, undefined);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="requestId" value={requestId} />
      <Field label={t("mentor.answer")} name="resolutionText" state={state}>
        <Textarea rows={6} maxLength={2000} />
      </Field>
      <SubmitButton className="w-fit" pendingText={t("mentor.sending")}>
        {t("mentor.send")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
