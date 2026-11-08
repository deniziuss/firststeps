import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/dal";
import { universityUsage } from "@/server/repositories/admin";
import { listUniversities } from "@/server/repositories/journeys";
import { UniversityForm } from "./university-form";

export const metadata: Metadata = { title: "Universities" };

export default async function UniversitiesPage() {
  await requireRole("Admin");
  const [universities, usage] = await Promise.all([listUniversities(), universityUsage()]);

  return (
    <div className="grid gap-6">
      <PageHeader title="Universities" description="Universities students can choose during onboarding. Linked records are never deleted." />
      <div className="grid gap-4 lg:grid-cols-2">
        {universities.map((u) => {
          const used = usage.find((x) => x.UniversityID === u.UniversityID);
          return (
            <Card key={u.UniversityID}>
              <CardHeader>
                <CardTitle>{u.UniversityName}</CardTitle>
                <CardDescription>
                  {u.City}, {u.Country} · {used?.Journeys ?? 0} journeys · {used?.Templates ?? 0} specific templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UniversityForm university={u} />
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardHeader>
            <CardTitle>Add university</CardTitle>
          </CardHeader>
          <CardContent>
            <UniversityForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
