"use client";

import { useActionState } from "react";
import { ChoiceGroup, Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { ACCOMMODATION_STATUSES, PROGRAM_TYPES } from "@/domain/statuses";
import { useI18n } from "@/i18n/client";
import { createJourney } from "@/server/actions/student";

export function JourneyForm({ universities }: { universities: { id: number; label: string }[] }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createJourney, undefined);
  return (
    <form action={action} className="grid gap-7" noValidate>
      <FormMessage state={state} />
      <Field label={t("onboarding.university")} name="universityId" state={state}>
        <NativeSelect defaultValue={universities[0]?.id} required>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("onboarding.arrival")} name="arrivalDate" state={state} hint={t("onboarding.arrivalHint")}>
        <Input type="date" required className="sm:max-w-60" />
      </Field>
      <ChoiceGroup
        legend={t("onboarding.programme")}
        name="programType"
        defaultValue="Erasmus"
        state={state}
        options={PROGRAM_TYPES.map((p) => ({ value: p, label: t(`programmes.${p}.label`), hint: t(`programmes.${p}.hint`) }))}
      />
      <ChoiceGroup
        legend={t("onboarding.accommodation")}
        name="accommodationStatus"
        defaultValue="NotArranged"
        state={state}
        options={ACCOMMODATION_STATUSES.map((a) => ({ value: a, label: t(`accommodationOptions.${a}.label`), hint: t(`accommodationOptions.${a}.hint`) }))}
      />
      <Field label={t("onboarding.homeCountry")} name="homeCountryCode" state={state} hint={t("onboarding.homeCountryHint")} optional>
        <Input maxLength={2} className="w-24 uppercase" autoComplete="country" />
      </Field>
      <SubmitButton size="lg" pendingText={t("onboarding.submitting")} className="w-full sm:w-auto sm:justify-self-start">
        {t("onboarding.submit")}
      </SubmitButton>
    </form>
  );
}
