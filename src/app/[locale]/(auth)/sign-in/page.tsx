import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
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
        <h1 className="text-3xl font-semibold">{t("auth.signInTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("auth.signInIntro")}</p>
      </div>
      <SignInForm />
      <p className="text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-medium text-foreground underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
          {t("auth.registerLink")}
        </Link>
      </p>
    </div>
  );
}
