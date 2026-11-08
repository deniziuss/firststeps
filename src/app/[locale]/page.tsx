import { BookOpenCheckIcon, GitBranchIcon, HandHelpingIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/nav";
import { LanguageSwitcher, ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

const FEATURES = [
  { key: "order", icon: GitBranchIcon },
  { key: "sources", icon: BookOpenCheckIcon },
  { key: "help", icon: HandHelpingIcon },
  { key: "adapt", icon: RefreshCwIcon },
] as const;

const STEPS = ["profile", "plan", "progress"] as const;

export default async function Home() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Brand />
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/sign-in">{t("landing.ctaSignIn")}</Link>
          </Button>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        <section className="bg-hero text-hero-foreground">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:py-28">
            <p className="text-sm font-medium tracking-[0.18em] text-hero-muted uppercase">{t("landing.eyebrow")}</p>
            <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold sm:text-6xl">{t("landing.title")}</h1>
            <p className="max-w-2xl text-lg leading-relaxed text-hero-muted">{t("landing.intro")}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild className="border-transparent bg-hero-foreground text-hero hover:bg-hero-foreground/90">
                <Link href="/register">{t("landing.ctaRegister")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-hero-muted/50 text-hero-foreground hover:bg-white/10 hover:text-hero-foreground">
                <Link href="/sign-in">{t("landing.ctaSignIn")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 id="how" className="text-3xl font-semibold">
            {t("landing.howTitle")}
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step} className="grid content-start gap-3 border-t border-taupe/50 pt-6">
                <span className="font-heading text-4xl text-gold" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-xl font-semibold">{t(`landing.steps.${step}.title`)}</h3>
                <p className="leading-relaxed text-muted-foreground">{t(`landing.steps.${step}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
            <h2 id="features" className="text-3xl font-semibold">
              {t("landing.featuresTitle")}
            </h2>
            <ul className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {FEATURES.map(({ key, icon: Icon }) => (
                <li key={key} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent">
                    <Icon className="size-5 text-primary dark:text-success" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{t(`landing.features.${key}.title`)}</h3>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{t(`landing.features.${key}.text`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">{t("common.disclaimer")}</footer>
    </div>
  );
}
