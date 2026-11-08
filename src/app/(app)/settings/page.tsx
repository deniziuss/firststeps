import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { ThemeToggle } from "@/components/theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/dal";
import { PasswordForm, ProfileForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="Settings" description={`Signed in as ${user.email}`} />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name is shown to mentors who answer your requests (first name only).</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm firstName={user.firstName} lastName={user.lastName} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Light, dark or follow your device. Saved in this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}
