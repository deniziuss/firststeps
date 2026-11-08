"use client";

import { useActionState } from "react";
import { ConfirmSubmit } from "@/components/form";
import type { RequestStatus } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import { closeHelpRequest, withdrawHelpRequest } from "@/server/actions/student";

export function RequestActions({ requestId, status }: { requestId: number; status: RequestStatus }) {
  const { t } = useI18n();
  const [withdrawState, withdraw] = useActionState(withdrawHelpRequest, undefined);
  const [closeState, close] = useActionState(closeHelpRequest, undefined);
  const error = (withdrawState && !withdrawState.ok && withdrawState.error) || (closeState && !closeState.ok && closeState.error);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
      {status === "Open" && (
        <form action={withdraw}>
          <input type="hidden" name="requestId" value={requestId} />
          <ConfirmSubmit variant="ghost" size="sm" title={t("help.withdrawConfirmTitle")} description={t("help.withdrawConfirmText")} confirmLabel={t("help.withdraw")}>
            {t("help.withdraw")}
          </ConfirmSubmit>
        </form>
      )}
      {status === "Resolved" && (
        <form action={close}>
          <input type="hidden" name="requestId" value={requestId} />
          <ConfirmSubmit variant="outline" size="sm" title={t("help.closeConfirmTitle")} description={t("help.closeConfirmText")} confirmLabel={t("help.solved")}>
            {t("help.solved")}
          </ConfirmSubmit>
        </form>
      )}
    </div>
  );
}
