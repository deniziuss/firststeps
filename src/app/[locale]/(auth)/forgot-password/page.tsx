import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-title font-light">{t("auth.forgotTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("auth.forgotIntro")}</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-sm text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-foreground link-accent">
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
