import { ExternalLinkIcon, GlobeIcon, MapPinnedIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page";
import { SourceStatusBadge } from "@/components/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { listEssentials, type EssentialRow } from "@/server/repositories/content";
import { listJourneys, listUniversities } from "@/server/repositories/journeys";

export const metadata: Metadata = { title: "Local essentials" };

const CATEGORY_LABELS: Record<string, string> = {
  Transport: "Getting around",
  DailyLife: "Daily life",
  Health: "Health and emergencies",
  Housing: "Housing",
};

export default async function EssentialsPage({ searchParams }: PageProps<"/essentials">) {
  const user = await requireRole("Student");
  const [journeys, universities] = await Promise.all([listJourneys(user.id), listUniversities()]);
  const requested = Number((await searchParams).university);
  const university =
    universities.find((u) => u.UniversityID === requested) ??
    universities.find((u) => u.UniversityID === journeys[0]?.UniversityID) ??
    universities[0];

  if (!university) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Local essentials" />
        <EmptyState icon={MapPinnedIcon} title="No city guides yet" />
      </div>
    );
  }

  const rows = await listEssentials(university.UniversityID);
  const topics = new Map<number, { title: string; description: string | null; category: string; sources: EssentialRow[] }>();
  for (const row of rows) {
    const topic = topics.get(row.TaskID) ?? { title: row.TaskTitle, description: row.Description, category: row.Category, sources: [] };
    if (row.SourceID) topic.sources.push(row);
    topics.set(row.TaskID, topic);
  }
  const categories = [...new Set([...topics.values()].map((t) => t.category))];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Local essentials: ${university.City}`}
        description={`Practical information for students of ${university.UniversityName}. Check every source before you rely on it.`}
        actions={
          university.Website && (
            <a href={university.Website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
              <GlobeIcon className="size-4" /> University website
            </a>
          )
        }
      />
      {universities.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Choose a city">
          {universities.map((u) => (
            <Link
              key={u.UniversityID}
              href={`/essentials?university=${u.UniversityID}`}
              aria-current={u.UniversityID === university.UniversityID ? "page" : undefined}
              className="rounded-full border px-3 py-1 text-sm aria-[current=page]:border-primary aria-[current=page]:text-primary"
            >
              {u.City}
            </Link>
          ))}
        </nav>
      )}
      {categories.length === 0 ? (
        <EmptyState icon={MapPinnedIcon} title="No guide content for this city yet" />
      ) : (
        categories.map((category) => (
          <section key={category} className="grid gap-3">
            <h2 className="font-semibold">{CATEGORY_LABELS[category] ?? category}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {[...topics.entries()]
                .filter(([, t]) => t.category === category)
                .map(([taskId, topic]) => (
                  <Card key={taskId} size="sm">
                    <CardHeader>
                      <CardTitle>{topic.title}</CardTitle>
                      {topic.description && <CardDescription>{topic.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      {topic.sources.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No source linked yet.</p>
                      ) : (
                        <ul className="grid gap-2">
                          {topic.sources.map((source) => (
                            <li key={source.SourceID} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              {source.SourceURL ? (
                                <a href={source.SourceURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                                  {source.SourceTitle} <ExternalLinkIcon className="size-3.5" />
                                </a>
                              ) : (
                                <span>{source.SourceTitle}</span>
                              )}
                              <SourceStatusBadge status={source.SourceStatus!} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
