import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { Suspense } from "react";
import { ResetNotice } from "./reset-notice";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.signIn") };
}

export default async function SignInPage() {
  const { t } = await getI18n();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-title font-light">{t("auth.signInTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("auth.signInIntro")}</p>
      </div>
      <Suspense>
        <ResetNotice />
      </Suspense>
      <SignInForm />
      <p className="-mt-2 text-sm">
        <Link href="/forgot-password" className="font-medium link-accent">
          {t("auth.forgotLink")}
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-foreground link-accent">
          {t("auth.registerLink")}
        </Link>
      </p>
    </div>
  );
}
