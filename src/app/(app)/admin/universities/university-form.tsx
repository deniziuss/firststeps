"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { saveUniversity } from "@/server/actions/admin";
import type { University } from "@/server/repositories/journeys";

export function UniversityForm({ university }: { university?: University }) {
  const [state, action] = useActionState(saveUniversity, undefined);
  const key = university?.UniversityID ?? "new";
  return (
    <form action={action} className="grid gap-3" noValidate>
      {university && <input type="hidden" name="universityId" value={university.UniversityID} />}
      <Field label="Name" name="universityName" state={state}>
        <Input id={`universityName-${key}`} name="universityName" defaultValue={university?.UniversityName} maxLength={200} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
        <Field label="City" name="city" state={state}>
          <Input id={`city-${key}`} name="city" defaultValue={university?.City} maxLength={100} />
        </Field>
        <Field label="Country" name="country" state={state}>
          <Input id={`country-${key}`} name="country" defaultValue={university?.Country} maxLength={100} />
        </Field>
        <Field label="Code" name="countryCode" state={state}>
          <Input id={`countryCode-${key}`} name="countryCode" defaultValue={university?.CountryCode} maxLength={2} className="uppercase" />
        </Field>
      </div>
      <Field label="Website" name="website" state={state}>
        <Input id={`website-${key}`} name="website" type="url" defaultValue={university?.Website ?? ""} placeholder="https://" maxLength={500} />
      </Field>
      <div>
        <SubmitButton variant="secondary" size="sm">
          {university ? "Save" : "Add university"}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
