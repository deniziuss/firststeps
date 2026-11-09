import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { LanguageSwitcher, ThemeToggle } from "@/components/theme";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/server/dal";
import { PasswordForm, ProfileForm } from "./settings-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("settings.title") };
}

function Panel({ id, title, text, children }: { id: string; title: string; text?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-5 shape-cut border bg-card p-6 sm:p-8">
      <div>
        <h2 id={id} className="text-xl font-normal">
          {title}
        </h2>
        {text && <p className="mt-1 text-muted-foreground">{text}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  return (
    <div className="grid max-w-2xl gap-8">
      <PageHeader title={t("settings.title")} description={t("settings.signedInAs", { email: user.email })} />
      <Panel id="language" title={t("settings.language")} text={t("settings.languageText")}>
        <div>
          <LanguageSwitcher withLabel />
        </div>
      </Panel>
      <Panel id="appearance" title={t("settings.appearance")} text={t("settings.appearanceText")}>
        <div>
          <ThemeToggle withLabel />
        </div>
      </Panel>
      <Panel id="profile" title={t("settings.profile")} text={t("settings.profileText")}>
        <ProfileForm firstName={user.firstName} lastName={user.lastName} />
      </Panel>
      <Panel id="password" title={t("settings.password")}>
        <PasswordForm />
      </Panel>
      <Panel id="data" title={t("settings.data")} text={t("settings.dataText")}>
        {/* A plain link: the route answers with a JSON download for the signed-in account only. */}
        <a href="/api/account/export" download className={buttonVariants({ variant: "outline", className: "w-fit" })}>
          {t("settings.exportData")}
        </a>
        <p className="text-sm text-muted-foreground">{t("settings.deletionText")}</p>
      </Panel>
    </div>
  );
}
