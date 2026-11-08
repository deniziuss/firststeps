import { BuildingIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { listJourneys, listUniversities } from "@/server/repositories/journeys";
import { JourneyForm } from "./journey-form";

export const metadata: Metadata = { title: "Plan your arrival" };

const STEPS = [
  { title: "Tell us about your stay", text: "University, arrival date, programme and housing." },
  { title: "Get your personal plan", text: "Only the tasks that apply to you, in the right order." },
  { title: "Work through it", text: "Check sources, mark progress, ask a mentor when stuck." },
];

export default async function OnboardingPage() {
  const user = await requireRole("Student");
  const [universities, journeys] = await Promise.all([listUniversities(), listJourneys(user.id)]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={journeys.length === 0 ? `Welcome, ${user.firstName}` : "Plan another arrival"}
        description="Your answers decide which tasks you get. You can change your housing status later and the plan updates itself."
      />
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>
            <p className="mt-2 font-medium">{step.title}</p>
            <p className="text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Your arrival details</CardTitle>
          <CardDescription>We do not ask for passport, visa or other document data.</CardDescription>
        </CardHeader>
        <CardContent>
          {universities.length === 0 ? (
            <EmptyState icon={BuildingIcon} title="No universities available yet">
              An administrator needs to add a university before journeys can be created.
            </EmptyState>
          ) : (
            <JourneyForm
              universities={universities.map((u) => ({ id: u.UniversityID, label: `${u.UniversityName} — ${u.City}, ${u.Country}` }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
