import { ArrowUpRightIcon, CircleCheckIcon, CircleDotIcon, LockIcon, MessageCircleQuestionIcon, ShieldCheckIcon, SlashIcon } from "lucide-react";
import { RevealScope } from "@/components/motion/reveal";
import SpotlightCard from "@/components/reactbits/spotlight-card";
import { SplitText } from "@/components/reactbits/split-text";
import type { I18n } from "@/i18n/translator";
import { cn } from "@/lib/utils";

type T = Pick<I18n, "t">["t"];
type FeatureKey = "journey" | "dependencies" | "progress" | "sources" | "assistance" | "mentors";

function FeatureCard({ t, feature, className, tone = "card", children }: { t: T; feature: FeatureKey; className?: string; tone?: "card" | "band"; children: React.ReactNode }) {
  return (
    <div data-reveal className={cn("h-full", className)}>
      <SpotlightCard
        className="shape-cut flex h-full flex-col justify-between gap-10 p-6 sm:p-8 lg:p-9"
        style={tone === "band" ? ({ "--spotlight-card-surface": "var(--band-strong)" } as React.CSSProperties) : undefined}
        spotlightSize={320}
        intensity={0.14}
        borderGlow={0.7}
      >
        <div aria-hidden className="relative">
          {children}
        </div>
        <div className="relative max-w-md">
          <h3 className="font-heading text-2xl font-normal tracking-[-0.025em]">{t(`landing.features.items.${feature}.title`)}</h3>
          <p className="mt-2 leading-relaxed text-foreground-soft">{t(`landing.features.items.${feature}.text`)}</p>
        </div>
      </SpotlightCard>
    </div>
  );
}

const STAGES = ["BeforeArrival", "FirstDays", "FirstWeek", "SettlingIn"] as const;
// Bars per stage: 1 = done, 0.5 = available now, 0 = later. Purely illustrative.
const STAGE_BARS = [
  [1, 1, 1],
  [1, 0.5, 0],
  [0, 0, 0, 0],
  [0, 0],
];

function JourneyIllustration({ t }: { t: T }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4">
      {STAGES.map((stage, i) => (
        <div key={stage} className="grid content-start gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", i < 2 ? "bg-ochre" : "border border-taupe")} />
            <span className="h-px flex-1 bg-hairline" />
          </div>
          <p className="min-h-8 font-mono text-[0.62rem] leading-tight tracking-wide text-muted-foreground uppercase sm:text-[0.68rem]">{t(`stages.${stage}`)}</p>
          {STAGE_BARS[i].map((state, j) => (
            <span
              key={j}
              className={cn(
                "h-7 rounded-[3px] border sm:h-8",
                state === 1 && "border-transparent bg-forest/85",
                state === 0.5 && "border-ochre bg-gold-soft",
                state === 0 && "border-dashed border-taupe/60",
              )}
              style={{ width: `${100 - ((i + j) % 3) * 14}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DependencyIllustration({ t }: { t: T }) {
  return (
    <div className="grid max-w-xs gap-0">
      <div className="flex items-center gap-2.5 rounded-md border border-hairline bg-background px-3 py-2.5 text-sm">
        <CircleCheckIcon className="size-4 text-forest" />
        {t("landing.demo.tasks.enrol.title")}
      </div>
      <svg viewBox="0 0 40 36" className="ml-4 h-9 w-10 text-ochre" fill="none">
        <path d="M6 0v20c0 6 4 10 10 10h18" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
        <path d="M30 26l4 4-4 4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <div className="ml-10 flex items-center gap-2.5 rounded-md border border-dashed border-taupe/70 px-3 py-2.5 text-sm text-foreground-soft">
        <LockIcon className="size-4 text-taupe" />
        {t("landing.demo.tasks.documents.title")}
      </div>
    </div>
  );
}

function ProgressIllustration({ t }: { t: T }) {
  return (
    <div className="grid gap-4">
      <p className="flex items-baseline gap-1 font-heading font-light tracking-[-0.04em]">
        <span className="text-6xl">7</span>
        <span className="text-2xl text-muted-foreground">/14</span>
      </p>
      <div className="flex gap-[3px]">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-[1px]", i < 7 ? "bg-forest" : i === 7 ? "bg-ochre" : i > 11 ? "bg-transparent outline outline-1 -outline-offset-1 outline-taupe/50" : "bg-band-strong")} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <CircleCheckIcon className="size-3.5 text-forest" /> {t("taskStatus.Completed.label")}
        </li>
        <li className="flex items-center gap-1.5">
          <CircleDotIcon className="size-3.5 text-gold" /> {t("landing.preview.status.next")}
        </li>
        <li className="flex items-center gap-1.5">
          <SlashIcon className="size-3.5" /> {t("taskStatus.NotApplicable.label")}
        </li>
      </ul>
    </div>
  );
}

function SourceIllustration({ t }: { t: T }) {
  return (
    <div className="grid gap-2 rounded-md border border-hairline bg-background p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-forest">
        <ShieldCheckIcon className="size-4" /> {t("sourceStatus.Verified.label")}
      </p>
      <p className="flex items-center justify-between gap-2 font-heading text-base underline decoration-ochre underline-offset-4">
        {t("landing.preview.tasks.residence")}
        <ArrowUpRightIcon className="size-4 shrink-0" />
      </p>
      <p className="font-mono text-[0.68rem] text-muted-foreground">{t("landing.features.reviewed", { date: t("landing.features.reviewedDate") })}</p>
    </div>
  );
}

function AssistanceIllustration({ t }: { t: T }) {
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">
        <MessageCircleQuestionIcon className="size-3.5 text-gold" /> {t("landing.support.sample.task")}
      </p>
      <p className="shape-cut-sm line-clamp-3 bg-background p-4 text-sm leading-relaxed text-foreground-soft">{t("landing.support.sample.question")}</p>
    </div>
  );
}

function MentorIllustration({ t }: { t: T }) {
  const rows = [
    { status: "Assigned", width: "w-3/4" },
    { status: "Assigned", width: "w-1/2" },
    { status: "Resolved", width: "w-2/3" },
  ] as const;
  return (
    <ul className="grid divide-y divide-hairline rounded-md border border-hairline bg-background">
      {rows.map((row, i) => (
        <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className={cn("h-2 rounded-full bg-band-strong", row.width)} />
          <span className={cn("shrink-0 font-mono text-[0.62rem] tracking-wide uppercase", row.status === "Resolved" ? "text-forest" : "text-gold")}>
            {t(`requestStatus.${row.status}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Features({ t, samples }: { t: T; samples: { en: string; tr: string } }) {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 py-24 sm:py-32 lg:py-40">
      <div className="page-container">
        <RevealScope className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p data-reveal className="eyebrow">
              {t("landing.features.eyebrow")}
            </p>
            <SplitText as="h2" id="features-title" text={t("landing.features.title")} className="mt-5 max-w-[20ch] font-display text-headline font-light" />
          </div>
        </RevealScope>

        <RevealScope className="mt-14 grid grid-cols-1 gap-4 sm:mt-20 lg:grid-cols-12 lg:gap-5">
          <FeatureCard t={t} feature="journey" className="lg:col-span-7 lg:row-span-2">
            <JourneyIllustration t={t} />
          </FeatureCard>
          <FeatureCard t={t} feature="dependencies" tone="band" className="lg:col-span-5">
            <DependencyIllustration t={t} />
          </FeatureCard>
          <FeatureCard t={t} feature="progress" className="lg:col-span-5">
            <ProgressIllustration t={t} />
          </FeatureCard>
          <FeatureCard t={t} feature="sources" className="lg:col-span-4">
            <SourceIllustration t={t} />
          </FeatureCard>
          <FeatureCard t={t} feature="assistance" tone="band" className="lg:col-span-4">
            <AssistanceIllustration t={t} />
          </FeatureCard>
          <FeatureCard t={t} feature="mentors" className="lg:col-span-4">
            <MentorIllustration t={t} />
          </FeatureCard>

          {/* Languages: a full-width strip that shows the same task in both languages. */}
          <div data-reveal className="dark shape-cut grid gap-8 bg-hero p-6 text-foreground sm:p-8 lg:col-span-12 lg:grid-cols-12 lg:items-end lg:p-10">
            <div className="lg:col-span-4">
              <h3 className="font-heading text-2xl font-normal tracking-[-0.025em]">{t("landing.features.items.languages.title")}</h3>
              <p className="mt-2 leading-relaxed text-foreground-soft">{t("landing.features.items.languages.text")}</p>
            </div>
            <div aria-hidden className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
              {(["en", "tr"] as const).map((lang) => (
                <div key={lang} lang={lang} className="border-t border-hairline pt-4">
                  <p className="font-mono text-xs text-gold uppercase">{lang}</p>
                  <p className="mt-3 font-display text-3xl leading-[1.05] font-light tracking-[-0.03em] sm:text-4xl">{samples[lang]}</p>
                </div>
              ))}
            </div>
          </div>
        </RevealScope>
      </div>
    </section>
  );
}
