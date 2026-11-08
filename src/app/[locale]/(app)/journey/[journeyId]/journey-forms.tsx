"use client";

import { useActionState } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { ACCOMMODATION_STATUSES, JOURNEY_STATUSES, type AccommodationStatus, type JourneyStatus } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import { changeAccommodation, setJourneyStatus } from "@/server/actions/student";

export function AccommodationForm({ journeyId, current }: { journeyId: number; current: AccommodationStatus }) {
  const { t } = useI18n();
  const [state, action] = useActionState(changeAccommodation, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Field label={t("journey.accommodationLabel")} name="accommodationStatus">
        <NativeSelect defaultValue={current}>
          {ACCOMMODATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`accommodationOptions.${status}.label`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <SubmitButton variant="outline" pendingText={t("journey.updatingPlan")}>
        {t("journey.updatePlan")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function JourneyStatusForm({ journeyId, current }: { journeyId: number; current: JourneyStatus }) {
  const { t } = useI18n();
  const [state, action] = useActionState(setJourneyStatus, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Field label={t("journey.statusTitle")} name="status">
        <NativeSelect defaultValue={current}>
          {JOURNEY_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`journeyStatuses.${status}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <SubmitButton variant="outline" pendingText={t("common.saving")}>
        {t("journey.saveStatus")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
