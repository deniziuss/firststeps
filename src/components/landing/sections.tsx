import { ArrowRightIcon, ArrowUpIcon, HandHelpingIcon, MessageSquareTextIcon, UserRoundCheckIcon } from "lucide-react";
import Link from "next/link";
import { RevealScope } from "@/components/motion/reveal";
import { Brand } from "@/components/nav";
import { SplitText } from "@/components/reactbits/split-text";
import { Button } from "@/components/ui/button";
import type { I18n } from "@/i18n/translator";
import { JourneyDemo } from "./journey-demo";
import { SupportFlow } from "./support-flow";

type T = Pick<I18n, "t">["t"];

/** Interactive dependency demo on a deep-forest band (the section always uses the dark token set). */
export function DemoSection({ t }: { t: T }) {
  return (
    <section aria-labelledby="demo-title" className="dark bg-hero py-24 text-foreground sm:py-32 lg:py-40">
      <div className="page-container">
        <RevealScope className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p data-reveal className="eyebrow">
              {t("landing.demo.eyebrow")}
            </p>
            <SplitText as="h2" id="demo-title" text={t("landing.demo.title")} className="mt-5 font-display text-headline font-light" />
          </div>
          <p data-reveal className="max-w-xl text-lead text-foreground-soft lg:col-span-5 lg:self-end">
            {t("landing.demo.intro")}
          </p>
        </RevealScope>
        <RevealScope className="mt-14 sm:mt-20">
          <div data-reveal>
            <JourneyDemo />
          </div>
        </RevealScope>
      </div>
    </section>
  );
}

const SUPPORT_STEPS = [
  { key: "ask", icon: MessageSquareTextIcon },
  { key: "assign", icon: UserRoundCheckIcon },
  { key: "answer", icon: HandHelpingIcon },
] as const;

export function SupportSection({ t }: { t: T }) {
  return (
    <section id="support" aria-labelledby="support-title" className="scroll-mt-24 bg-band py-24 sm:py-32 lg:py-40">
      <div className="page-container grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
        <RevealScope className="flex flex-col gap-10 lg:col-span-5">
          <div>
            <p data-reveal className="eyebrow">
              {t("landing.support.eyebrow")}
            </p>
            <SplitText as="h2" id="support-title" text={t("landing.support.title")} className="mt-5 font-display text-headline font-light" />
            <p data-reveal className="mt-6 max-w-lg text-lead text-foreground-soft">
              {t("landing.support.intro")}
            </p>
          </div>
          <ol className="grid border-t border-hairline">
            {SUPPORT_STEPS.map(({ key, icon: Icon }) => (
              <li key={key} data-reveal className="grid grid-cols-[2.25rem_1fr] gap-4 border-b border-hairline py-5">
                <Icon className="mt-0.5 size-5 text-gold" aria-hidden />
                <div>
                  <h3 className="font-heading text-lg font-medium tracking-[-0.015em]">{t(`landing.support.steps.${key}.title`)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`landing.support.steps.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </RevealScope>
        <div className="lg:col-span-6 lg:col-start-7 lg:self-center">
          <SupportFlow />
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ t }: { t: T }) {
  return (
    <section aria-labelledby="cta-title" className="dark relative overflow-hidden bg-hero text-foreground">
      {/* A quiet stair motif drawn with hairlines, echoing the brand mark. */}
      <svg aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-[120%] text-hairline" viewBox="0 0 600 600" fill="none">
        <path d="M0 600h150V450h150V300h150V150h150" stroke="currentColor" strokeWidth="1.2" />
        <path d="M60 600h150V450h150V300h150V150h150" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <RevealScope className="page-container relative py-28 sm:py-36 lg:py-44">
        <p data-reveal className="eyebrow">
          {t("common.appName")}
        </p>
        <SplitText as="h2" id="cta-title" text={t("landing.cta.title")} className="mt-6 max-w-[14ch] font-display text-display font-light" />
        <p data-reveal className="mt-8 max-w-lg text-lead text-foreground-soft">
          {t("landing.cta.text")}
        </p>
        <div data-reveal className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              {t("landing.cta.primary")}
              <ArrowRightIcon aria-hidden className="transition-transform duration-300 group-hover/button:translate-x-0.5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">{t("landing.cta.secondary")}</Link>
          </Button>
        </div>
      </RevealScope>
    </section>
  );
}

export function LandingFooter({ t }: { t: T }) {
  const product = [
    { href: "#how", label: t("landing.nav.how") },
    { href: "#features", label: t("landing.nav.features") },
    { href: "#support", label: t("landing.nav.support") },
  ];
  const account = [
    { href: "/register", label: t("landing.footer.register") },
    { href: "/sign-in", label: t("landing.nav.signIn") },
  ];
  return (
    <footer className="border-t border-hairline">
      <div className="page-container grid grid-cols-1 gap-12 py-16 lg:grid-cols-12">
        <div className="grid content-start gap-4 lg:col-span-6">
          <Brand />
          <p className="max-w-md text-sm leading-relaxed text-foreground-soft">{t("landing.footer.about")}</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t("common.disclaimer")}</p>
        </div>
        <nav aria-labelledby="footer-product" className="lg:col-span-3">
          <h2 id="footer-product" className="eyebrow">
            {t("landing.footer.product")}
          </h2>
          <ul className="mt-4 grid gap-1">
            {product.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-10 items-center text-foreground-soft transition-colors hover:text-foreground">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-account" className="lg:col-span-3">
          <h2 id="footer-account" className="eyebrow">
            {t("landing.footer.account")}
          </h2>
          <ul className="mt-4 grid gap-1">
            {account.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-10 items-center text-foreground-soft transition-colors hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="page-container flex flex-wrap items-center justify-between gap-4 border-t border-hairline py-6 text-sm text-muted-foreground">
        <p>{t("landing.footer.project")}</p>
        <a href="#top" className="inline-flex min-h-10 items-center gap-2 transition-colors hover:text-foreground">
          {t("landing.footer.backToTop")}
          <ArrowUpIcon className="size-4" aria-hidden />
        </a>
      </div>
    </footer>
  );
}
