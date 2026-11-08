import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.createAccount") };
}

export default async function RegisterPage() {
  const { t } = await getI18n();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("auth.registerIntro")}</p>
      </div>
      <RegisterForm />
      <p className="text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline decoration-gold/60 underline-offset-4 hover:decoration-gold">
          {t("auth.signInLink")}
        </Link>
      </p>
    </div>
  );
}
