import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Brand } from "@/components/nav";
import { LanguageSwitcher, ThemeToggle } from "@/components/theme";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, HOME_BY_ROLE } from "@/server/dal";

async function SignedInRedirect() {
  const user = await getCurrentUser();
  if (user) redirect(HOME_BY_ROLE[user.role]);
  return null;
}

// Editorial split: a deep-forest statement panel (large screens) beside a calm form column.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="dark relative hidden overflow-hidden bg-hero text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Brand />
        <svg aria-hidden className="pointer-events-none absolute -right-20 bottom-0 h-[70%] text-hairline" viewBox="0 0 600 600" fill="none">
          <path d="M0 600h150V450h150V300h150V150h150" stroke="currentColor" strokeWidth="1.2" />
          <path d="M60 600h150V450h150V300h150V150h150" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <div className="relative max-w-md">
          <p className="eyebrow">{t("landing.hero.eyebrow")}</p>
          <p className="mt-6 font-display text-5xl leading-[1] font-light tracking-[-0.035em]">{t("landing.hero.title")}</p>
          <p className="mt-6 text-foreground-soft">{t("landing.hero.pilot")}</p>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex h-20 items-center justify-between gap-2 px-4 sm:px-8">
          <div className="lg:invisible">
            <Brand />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
      <Suspense>
        <SignedInRedirect />
      </Suspense>
    </div>
  );
}
