import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getI18n } from "@/i18n/server";
import { isTokenUsable } from "@/server/repositories/tokens";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  // No token in the title or anywhere else outside the form.
  return { title: t("auth.resetTitle"), referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password/[token]">) {
  const { t } = await getI18n();
  const { token } = await params;
  const usable = await isTokenUsable(token, "ResetPassword");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-title font-light">{t("auth.resetTitle")}</h1>
        {usable && <p className="mt-2 text-muted-foreground">{t("auth.resetIntro")}</p>}
      </div>
      {usable ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert variant="destructive" role="alert" className="border-destructive/40 bg-destructive-soft">
          <AlertDescription>{t("auth.resetInvalid")}</AlertDescription>
        </Alert>
      )}
      <p className="flex flex-wrap gap-4 text-sm">
        <Link href="/forgot-password" className="font-medium link-accent">
          {t("auth.requestNewLink")}
        </Link>
        <Link href="/sign-in" className="font-medium link-accent">
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
