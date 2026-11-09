import { RevealScope } from "@/components/motion/reveal";
import { SplitText } from "@/components/reactbits/split-text";
import type { I18n } from "@/i18n/translator";
import { StepsRail } from "./steps-rail";

const STEPS = ["profile", "plan", "progress", "help"] as const;

export function HowItWorks({ t }: Pick<I18n, "t">) {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-24 bg-band py-24 sm:py-32 lg:py-40">
      <div className="page-container grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
        <RevealScope className="lg:col-span-5">
          <div className="lg:sticky lg:top-36">
            <p data-reveal className="eyebrow">
              {t("landing.how.eyebrow")}
            </p>
            <SplitText as="h2" id="how-title" text={t("landing.how.title")} className="mt-5 max-w-[16ch] font-display text-headline font-light" />
          </div>
        </RevealScope>

        <div className="lg:col-span-7">
          <StepsRail>
            <RevealScope>
              <ol className="grid">
                {STEPS.map((step, index) => (
                  <li
                    key={step}
                    data-step
                    className="group/step grid gap-4 py-10 pl-8 first:pt-2 last:pb-2 sm:grid-cols-[7.5rem_1fr] sm:gap-8 sm:pl-12 lg:py-14"
                  >
                    <span
                      data-reveal
                      aria-hidden
                      className="font-display text-6xl leading-none font-light tracking-[-0.05em] text-muted-foreground transition-colors duration-500 group-data-active/step:text-ochre sm:text-7xl"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="grid content-start gap-3">
                      <span data-reveal="line" aria-hidden className="block h-px w-full bg-hairline" />
                      <h3 data-reveal className="pt-3 font-heading text-2xl font-normal tracking-[-0.02em] sm:text-3xl">
                        <span className="sr-only">{index + 1}. </span>
                        {t(`landing.how.steps.${step}.title`)}
                      </h3>
                      <p data-reveal className="max-w-xl text-base leading-relaxed text-foreground-soft sm:text-lg">
                        {t(`landing.how.steps.${step}.text`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </RevealScope>
          </StepsRail>
        </div>
      </div>
    </section>
  );
}
