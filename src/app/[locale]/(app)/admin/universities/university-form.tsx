"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { saveUniversity } from "@/server/actions/admin";
import type { University } from "@/server/repositories/journeys";

export function UniversityForm({ university }: { university?: University }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveUniversity, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {university && <input type="hidden" name="universityId" value={university.UniversityID} />}
      <Field label={t("admin.universities.name")} name="universityName" state={state}>
        <Input defaultValue={university?.UniversityName} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_96px]">
        <Field label={t("admin.universities.city")} name="city" state={state}>
          <Input defaultValue={university?.City} maxLength={100} />
        </Field>
        <Field label={t("admin.universities.country")} name="country" state={state}>
          <Input defaultValue={university?.Country} maxLength={100} />
        </Field>
        <Field label={t("admin.universities.code")} name="countryCode" state={state}>
          <Input defaultValue={university?.CountryCode} maxLength={2} className="uppercase" />
        </Field>
      </div>
      <Field label={t("admin.universities.website")} name="website" state={state}>
        <Input type="url" defaultValue={university?.Website ?? ""} placeholder="https://" maxLength={500} />
      </Field>
      <SubmitButton variant="outline" className="w-fit" pendingText={t("common.saving")}>
        {university ? t("common.save") : t("admin.universities.add")}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
