"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/form";
import type { RequestStatus } from "@/domain/statuses";
import { closeHelpRequest, withdrawHelpRequest } from "@/server/actions/student";

export function RequestActions({ requestId, status }: { requestId: number; status: RequestStatus }) {
  const [withdrawState, withdraw] = useActionState(withdrawHelpRequest, undefined);
  const [closeState, close] = useActionState(closeHelpRequest, undefined);
  const error = (withdrawState && !withdrawState.ok && withdrawState.error) || (closeState && !closeState.ok && closeState.error);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-destructive">{error}</span>}
      {status === "Open" && (
        <form action={withdraw}>
          <input type="hidden" name="requestId" value={requestId} />
          <SubmitButton variant="ghost" size="sm">
            Withdraw
          </SubmitButton>
        </form>
      )}
      {status === "Resolved" && (
        <form action={close}>
          <input type="hidden" name="requestId" value={requestId} />
          <SubmitButton variant="outline" size="sm">
            This solved it
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
