import { BuildingIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listJourneys, listUniversities } from "@/server/repositories/journeys";
import { JourneyForm } from "./journey-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("onboarding.submit") };
}

export default async function OnboardingPage() {
  const user = await requireRole("Student");
  const { t } = await getI18n();
  const [universities, journeys] = await Promise.all([listUniversities(), listJourneys(user.id)]);

  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <PageHeader title={journeys.length === 0 ? t("onboarding.welcome", { name: user.firstName }) : t("onboarding.another")} description={t("onboarding.intro")} />
      {universities.length === 0 ? (
        <EmptyState icon={BuildingIcon} title={t("onboarding.noUniversities")}>
          {t("onboarding.noUniversitiesText")}
        </EmptyState>
      ) : (
        <div className="shape-cut border bg-card p-6 sm:p-8">
          <JourneyForm universities={universities.map((u) => ({ id: u.UniversityID, label: `${u.UniversityName} — ${u.City}, ${u.Country}` }))} />
        </div>
      )}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("onboarding.privacy")}
      </p>
    </div>
  );
}
