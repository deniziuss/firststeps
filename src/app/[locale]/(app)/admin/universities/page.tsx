import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { universityUsage } from "@/server/repositories/admin";
import { listUniversities } from "@/server/repositories/journeys";
import { UniversityForm } from "./university-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.universities.title") };
}

export default async function UniversitiesPage() {
  await requireRole("Admin");
  const { t } = await getI18n();
  const [universities, usage] = await Promise.all([listUniversities(), universityUsage()]);

  return (
    <div className="grid gap-8">
      <PageHeader title={t("admin.universities.title")} description={t("admin.universities.intro")} />
      <div className="grid gap-6 lg:grid-cols-2">
        {universities.map((u) => {
          const used = usage.find((x) => x.UniversityID === u.UniversityID);
          return (
            <section key={u.UniversityID} aria-labelledby={`uni-${u.UniversityID}`} className="grid content-start gap-4 rounded-2xl border bg-card p-6">
              <div>
                <h2 id={`uni-${u.UniversityID}`} className="text-xl font-semibold">
                  {u.UniversityName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("admin.universities.usage", { city: u.City, country: u.Country, journeys: used?.Journeys ?? 0, templates: used?.Templates ?? 0 })}
                </p>
              </div>
              <UniversityForm university={u} />
            </section>
          );
        })}
        <section aria-labelledby="uni-new" className="grid content-start gap-4 rounded-2xl border border-dashed bg-card p-6">
          <h2 id="uni-new" className="text-xl font-semibold">
            {t("admin.universities.add")}
          </h2>
          <UniversityForm />
        </section>
      </div>
    </div>
  );
}
