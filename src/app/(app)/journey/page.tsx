import { CompassIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, formatDate, PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/server/dal";
import { listJourneys } from "@/server/repositories/journeys";

export const metadata: Metadata = { title: "My journey" };

export default async function JourneysPage() {
  const user = await requireRole("Student");
  const journeys = await listJourneys(user.id);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="My journeys"
        description="Each journey is one arrival: a university, a date and your situation."
        actions={
          <Button asChild>
            <Link href="/onboarding">
              <PlusIcon /> New journey
            </Link>
          </Button>
        }
      />
      {journeys.length === 0 ? (
        <EmptyState icon={CompassIcon} title="No journey yet">
          <Link href="/onboarding" className="font-medium text-primary underline-offset-4 hover:underline">
            Plan your arrival
          </Link>{" "}
          to get your personal task list.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {journeys.map((journey) => (
            <li key={journey.JourneyID}>
              <Link
                href={`/journey/${journey.JourneyID}`}
                className="block rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-shadow hover:ring-primary/40 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{journey.UniversityName}</p>
                  <Badge variant="secondary">{journey.JourneyStatus}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {journey.City}, {journey.Country} · Arrival {formatDate(journey.ArrivalDate)}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {journey.ProgramType} · Accommodation {journey.AccommodationStatus === "Confirmed" ? "confirmed" : "not arranged"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
