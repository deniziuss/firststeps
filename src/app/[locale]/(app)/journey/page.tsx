import { ArrowRightIcon, CompassIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listJourneys } from "@/server/repositories/journeys";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("journey.listTitle") };
}

export default async function JourneysPage() {
  const user = await requireRole("Student");
  const { t, format } = await getI18n();
  const journeys = await listJourneys(user.id);

  return (
    <div className="grid gap-8">
      <PageHeader
        title={t("journey.listTitle")}
        description={t("journey.listIntro")}
        actions={
          journeys.length > 0 && (
            <Button asChild variant="outline">
              <Link href="/onboarding">
                <PlusIcon aria-hidden /> {t("journey.newJourney")}
              </Link>
            </Button>
          )
        }
      />
      {journeys.length === 0 ? (
        <EmptyState icon={CompassIcon} title={t("journey.emptyTitle")}>
          <p>{t("journey.emptyText")}</p>
          <Button asChild size="lg" className="mt-5">
            <Link href="/onboarding">{t("dashboard.startCta")}</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {journeys.map((journey) => (
            <li key={journey.JourneyID}>
              <Link href={`/journey/${journey.JourneyID}`} className="group grid h-full gap-3 shape-cut border bg-card p-6 transition-colors hover:border-primary-border">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-normal">{journey.UniversityName}</h2>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium">{t(`journeyStatuses.${journey.JourneyStatus}`)}</span>
                </div>
                <p className="text-muted-foreground">
                  {journey.City}, {journey.Country} · {t("journey.arrival", { date: format.date(journey.ArrivalDate) })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`programmes.${journey.ProgramType}.label`)} ·{" "}
                  {journey.AccommodationStatus === "Confirmed" ? t("journey.accommodationConfirmed") : t("journey.accommodationNotArranged")}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
                  {t("dashboard.openJourney")} <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
