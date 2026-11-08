"use client";

import { useActionState } from "react";
import { FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import type { AccommodationStatus, JourneyStatus } from "@/domain/statuses";
import { changeAccommodation, setJourneyStatus } from "@/server/actions/student";

export function AccommodationForm({ journeyId, current }: { journeyId: number; current: AccommodationStatus }) {
  const [state, action] = useActionState(changeAccommodation, undefined);
  const summary =
    state?.ok && state.data
      ? `Plan updated: ${state.data.added} added, ${state.data.retired} no longer needed, ${state.data.reopened} reopened.`
      : undefined;

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="journeyId" value={journeyId} />
      <NativeSelect name="accommodationStatus" defaultValue={current} aria-label="Accommodation status">
        <option value="NotArranged">Not arranged yet</option>
        <option value="Confirmed">Confirmed</option>
      </NativeSelect>
      <SubmitButton variant="secondary" pendingText="Updating plan…">
        Update plan
      </SubmitButton>
      <FormMessage state={state?.ok ? { ok: true, message: summary } : state} />
    </form>
  );
}

const STATUS_LABELS: Record<JourneyStatus, string> = { Planning: "Planning", Active: "Arrived / active", Completed: "Completed", Cancelled: "Cancelled" };

export function JourneyStatusForm({ journeyId, current }: { journeyId: number; current: JourneyStatus }) {
  return (
    <form action={setJourneyStatus} className="grid gap-3">
      <input type="hidden" name="journeyId" value={journeyId} />
      <NativeSelect name="status" defaultValue={current} aria-label="Journey status">
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      <SubmitButton variant="secondary">Save status</SubmitButton>
    </form>
  );
}
