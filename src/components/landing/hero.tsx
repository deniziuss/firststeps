import { ArrowDownRightIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { RevealScope } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import type { I18n } from "@/i18n/translator";
import { ProductPreview } from "./product-preview";

const FACTS = ["tasks", "order", "help"] as const;

export function Hero({ t }: Pick<I18n, "t">) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pt-32 sm:pt-40">
      <div className="page-container">
        <p className="hero-fade eyebrow flex items-center gap-3" style={{ "--i": -4 } as React.CSSProperties}>
          <span className="h-px w-8 bg-ochre" aria-hidden />
          {t("landing.hero.eyebrow")}
        </p>
        <h1 id="hero-title" className="mt-6 max-w-[13ch] font-display text-display font-light text-balance">
          {t("landing.hero.title")
            .split(" ")
            .map((word, i, words) => (
              <span key={i}>
                <span className="-mb-[0.1em] inline-block overflow-hidden pb-[0.1em] align-bottom">
                  <span className="hero-word inline-block" style={{ "--i": i } as React.CSSProperties}>
                    {word}
                  </span>
                </span>
                {i < words.length - 1 && " "}
              </span>
            ))}
        </h1>

        <div className="mt-12 grid grid-cols-1 gap-14 lg:mt-16 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col gap-8 lg:col-span-4 lg:pt-2">
            <p className="hero-fade max-w-md text-lead text-foreground-soft">
              {t("landing.intro")}
            </p>
            <div className="hero-fade flex flex-wrap gap-3" style={{ "--i": 1 } as React.CSSProperties}>
              <Button asChild size="lg">
                <Link href="/register">
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRightIcon aria-hidden className="transition-transform duration-300 group-hover/button:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">
                  {t("landing.hero.ctaSecondary")}
                  <ArrowDownRightIcon aria-hidden />
                </a>
              </Button>
            </div>
            <p className="hero-fade flex max-w-sm gap-3 border-l border-ochre/60 pl-4 text-sm text-muted-foreground" style={{ "--i": 2 } as React.CSSProperties}>
              {t("landing.hero.pilot")}
            </p>
          </div>

          <div className="min-w-0 lg:col-span-8">
            <ProductPreview />
          </div>
        </div>
      </div>

      <RevealScope className="mt-24 border-y border-hairline bg-band sm:mt-28">
        <dl className="page-container grid divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FACTS.map((fact) => (
            <div key={fact} data-reveal className="flex flex-col gap-1 py-6 sm:px-8 sm:py-8 sm:first:pl-0 sm:last:pr-0">
              <dt className="font-heading text-2xl font-light tracking-[-0.03em]">{t(`landing.hero.facts.${fact}.value`)}</dt>
              <dd className="text-sm text-muted-foreground">{t(`landing.hero.facts.${fact}.label`)}</dd>
            </div>
          ))}
        </dl>
      </RevealScope>
    </section>
  );
}
