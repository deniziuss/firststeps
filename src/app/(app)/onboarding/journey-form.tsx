"use client";

import { useActionState } from "react";
import { Field, FormMessage, NativeSelect, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { createJourney } from "@/server/actions/student";

export function JourneyForm({ universities }: { universities: { id: number; label: string }[] }) {
  const [state, action] = useActionState(createJourney, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="University" name="universityId" state={state}>
        <NativeSelect id="universityId" name="universityId" defaultValue={universities[0]?.id} required>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Arrival date" name="arrivalDate" state={state}>
          <Input id="arrivalDate" name="arrivalDate" type="date" required />
        </Field>
        <Field label="Programme" name="programType" state={state}>
          <NativeSelect id="programType" name="programType" defaultValue="Erasmus">
            <option value="Erasmus">Erasmus exchange</option>
            <option value="FullTime">Full-time degree</option>
            <option value="Other">Other</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Accommodation" name="accommodationStatus" state={state} hint="Choose “confirmed” only if you already have a place to stay.">
        <NativeSelect id="accommodationStatus" name="accommodationStatus" defaultValue="NotArranged">
          <option value="NotArranged">Not arranged yet</option>
          <option value="Confirmed">Confirmed</option>
        </NativeSelect>
      </Field>
      <Field label="Home country code (optional)" name="homeCountryCode" state={state} hint="Two letters, for example DE or TR.">
        <Input id="homeCountryCode" name="homeCountryCode" maxLength={2} className="w-24 uppercase" autoComplete="country" />
      </Field>
      <SubmitButton pendingText="Building your plan…">Create my plan</SubmitButton>
    </form>
  );
}
