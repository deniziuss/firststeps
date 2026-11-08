import { ExternalLinkIcon, GlobeIcon, MapPinnedIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Section } from "@/components/page";
import { SourceStatusBadge } from "@/components/status";
import { getI18n } from "@/i18n/server";
import { requireRole } from "@/server/dal";
import { listEssentials, type EssentialRow } from "@/server/repositories/content";
import { listJourneys, listUniversities } from "@/server/repositories/journeys";

const GROUPS = ["Housing", "Transport", "DailyLife", "Health"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("nav.essentials") };
}

export default async function EssentialsPage({ searchParams }: PageProps<"/[locale]/essentials">) {
  const user = await requireRole("Student");
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const [journeys, universities] = await Promise.all([listJourneys(user.id), listUniversities()]);
  const requested = Number((await searchParams).university);
  const university =
    universities.find((u) => u.UniversityID === requested) ?? universities.find((u) => u.UniversityID === journeys[0]?.UniversityID) ?? universities[0];

  if (!university) {
    return (
      <div className="grid gap-8">
        <PageHeader title={t("nav.essentials")} />
        <EmptyState icon={MapPinnedIcon} title={t("essentials.empty")} />
      </div>
    );
  }

  const rows = await listEssentials(university.UniversityID, locale);
  const topics = new Map<number, { title: string; description: string | null; category: string; fallback: boolean; sources: EssentialRow[] }>();
  for (const row of rows) {
    const topic = topics.get(row.TaskID) ?? { title: row.TaskTitle, description: row.Description, category: row.Category, fallback: row.IsFallback, sources: [] };
    if (row.SourceID) topic.sources.push(row);
    topics.set(row.TaskID, topic);
  }

  return (
    <div className="grid gap-10">
      <PageHeader
        title={t("essentials.title", { city: university.City })}
        description={t("essentials.intro", { university: university.UniversityName })}
        actions={
          university.Website && (
            <a href={university.Website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-medium underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
              <GlobeIcon className="size-4" aria-hidden /> {t("essentials.universityWebsite")}
              <span className="sr-only">({t("common.externalLink")})</span>
            </a>
          )
        }
      />
      {universities.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("essentials.chooseCity")}>
          {universities.map((u) => (
            <Link
              key={u.UniversityID}
              href={`/essentials?university=${u.UniversityID}`}
              aria-current={u.UniversityID === university.UniversityID ? "page" : undefined}
              className="inline-flex min-h-10 items-center rounded-full border px-4 text-sm aria-[current=page]:border-primary-border aria-[current=page]:bg-accent"
            >
              {u.City}
            </Link>
          ))}
        </nav>
      )}
      {topics.size === 0 ? (
        <EmptyState icon={MapPinnedIcon} title={t("essentials.empty")} />
      ) : (
        GROUPS.map((group) => {
          const groupTopics = [...topics.entries()].filter(([, topic]) => topic.category === group);
          if (groupTopics.length === 0) return null;
          return (
            <Section key={group} id={`group-${group}`} title={t(`essentials.groups.${group}`)}>
              <ul className="grid gap-4 md:grid-cols-2">
                {groupTopics.map(([taskId, topic]) => (
                  <li key={taskId} className="grid content-start gap-3 rounded-2xl border bg-card p-5">
                    <h3 className="text-lg font-semibold">{topic.title}</h3>
                    {topic.description && <p className="text-muted-foreground">{topic.description}</p>}
                    {topic.sources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("essentials.noSource")}</p>
                    ) : (
                      <ul className="grid gap-2 border-t pt-3">
                        {topic.sources.map((source) => (
                          <li key={source.SourceID} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            {source.SourceURL ? (
                              <a href={source.SourceURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
                                {source.SourceTitle} <ExternalLinkIcon className="size-3.5" aria-hidden />
                                <span className="sr-only">({t("common.externalLink")})</span>
                              </a>
                            ) : (
                              <span>{source.SourceTitle}</span>
                            )}
                            <SourceStatusBadge status={source.SourceStatus!} i18n={i18n} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          );
        })
      )}
    </div>
  );
}
