import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { ConfirmEmailForm } from "./confirm-email-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("verify.title"), referrer: "no-referrer" };
}

// Opening the link does not change anything: the address is confirmed by pressing the button
// (a POST), so automatic link scanners in mail systems cannot use up the token.
export default async function VerifyEmailPage({ params }: PageProps<"/[locale]/verify-email/[token]">) {
  const { t } = await getI18n();
  const { token } = await params;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-title font-light">{t("verify.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("verify.intro")}</p>
      </div>
      <ConfirmEmailForm token={token} />
    </div>
  );
}
