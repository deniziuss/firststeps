"use client";

import { ArrowRightIcon, CircleCheckIcon, CircleDotIcon, LockIcon, ShieldCheckIcon } from "lucide-react";
import { useRef, useState } from "react";
import { gsap, markRevealed, MOTION, useGSAP } from "@/components/motion/gsap";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/*
  An illustration of the student dashboard built from real UI pieces, filled with clearly labelled
  example data. It is not connected to the database. On first view it assembles itself, then shows
  one task being completed: progress moves from 6 to 7 of 14 and the dependent task becomes available.
  The whole figure is exposed to assistive technology as one labelled image.
*/

type RowState = "done" | "next" | "locked";
type TaskKey = "insurance" | "housing" | "enrol" | "residence" | "card";

const TOTAL = 14;
const ROWS: { key: TaskKey; stage: "BeforeArrival" | "FirstDays" | "FirstWeek"; before: RowState; after: RowState }[] = [
  { key: "insurance", stage: "BeforeArrival", before: "done", after: "done" },
  { key: "housing", stage: "BeforeArrival", before: "done", after: "done" },
  { key: "enrol", stage: "FirstDays", before: "next", after: "done" },
  { key: "residence", stage: "FirstWeek", before: "locked", after: "next" },
  { key: "card", stage: "FirstWeek", before: "locked", after: "locked" },
];

const ICON: Record<RowState, typeof CircleCheckIcon> = { done: CircleCheckIcon, next: CircleDotIcon, locked: LockIcon };

export function ProductPreview() {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const [completed, setCompleted] = useState(false);
  const done = completed ? 7 : 6;
  const next: TaskKey = completed ? "residence" : "enrol";
  const unlocks: TaskKey = completed ? "card" : "residence";

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION.ok, () => {
        const tl = gsap.timeline({ delay: 0.55 });
        tl.from("[data-pv='window']", { y: 48, opacity: 0, duration: 1.2, ease: "power4.out" })
          .from("[data-pv='panel']", { y: 20, opacity: 0, stagger: 0.1, duration: 0.8 }, "-=0.75")
          .from("[data-pv='row']", { x: -14, opacity: 0, stagger: 0.07, duration: 0.6 }, "-=0.5")
          .fromTo("[data-pv='seg-initial']", { scaleX: 0 }, { scaleX: 1, stagger: 0.05, duration: 0.45, ease: "power2.out" }, "<")
          .from("[data-pv='float']", { y: 28, opacity: 0, duration: 0.9 }, "-=0.4")
          .add(() => setCompleted(true), "+=0.8");
        markRevealed(el);
      });
      mm.add(MOTION.reduce, () => {
        setCompleted(true);
        markRevealed(el);
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} data-motion="" role="img" aria-label={t("landing.preview.label")} className="relative">
      <div data-pv="window" className="shape-cut relative border border-hairline bg-card p-4 sm:p-6 lg:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">{t("landing.preview.journey")}</p>
            <p className="mt-1 font-heading text-xl font-normal tracking-[-0.02em] sm:text-2xl">{t("landing.preview.greeting")}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-ochre/70 px-2.5 py-1 font-mono text-[0.65rem] tracking-wide text-gold uppercase">
            <span className="size-1.5 rounded-full bg-ochre" />
            {t("landing.preview.badge")}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1.15fr_1fr] sm:gap-4">
          {/* Next step */}
          <div data-pv="panel" className="shape-cut-sm flex flex-col justify-between gap-5 bg-band-strong p-4 sm:p-5">
            <div>
              <p className="font-mono text-[0.68rem] tracking-[0.12em] text-gold uppercase">{t("landing.preview.nextLabel")}</p>
              <p key={next} className="mt-2 animate-in font-heading text-lg leading-tight font-normal tracking-[-0.02em] duration-700 fade-in slide-in-from-bottom-2 sm:text-[1.4rem]">
                {t(`landing.preview.tasks.${next}`)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("landing.preview.nextMeta")}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p key={unlocks} className="flex animate-in items-center gap-1.5 text-xs text-foreground-soft duration-700 fade-in">
                <LockIcon className="size-3.5 text-taupe" aria-hidden />
                {t("landing.preview.unlocks", { task: t(`landing.preview.tasks.${unlocks}`) })}
              </p>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary px-3 font-heading text-xs text-primary-foreground">
                {t("landing.preview.openTask")}
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </span>
            </div>
          </div>

          {/* Progress */}
          <div data-pv="panel" className="flex flex-col justify-between gap-4 rounded-lg border border-hairline p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t("landing.preview.progressLabel")}</p>
              <p className="font-mono text-[0.68rem] text-muted-foreground">{t("landing.preview.arrival")}</p>
            </div>
            <p className="flex items-baseline gap-1 font-heading font-light tracking-[-0.04em]">
              <span key={done} className="inline-block animate-in text-5xl duration-500 fade-in slide-in-from-bottom-3 sm:text-6xl">
                {done}
              </span>
              <span className="text-2xl text-muted-foreground">/{TOTAL}</span>
            </p>
            <div>
              <div className="flex gap-[3px]" aria-hidden>
                {Array.from({ length: TOTAL }, (_, i) => (
                  <span
                    key={i}
                    data-pv={i < 6 ? "seg-initial" : undefined}
                    className={cn(
                      "h-2 flex-1 origin-left rounded-[1px] transition-[transform,background-color] duration-700 ease-editorial",
                      i < 6 ? "bg-forest" : i === 6 ? (completed ? "scale-x-100 bg-ochre" : "scale-x-0 bg-ochre") : "bg-band-strong",
                    )}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-foreground-soft">{t("landing.preview.progressValue", { done, total: TOTAL })}</p>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
          {ROWS.map((row) => {
            const state = completed ? row.after : row.before;
            const Icon = ICON[state];
            return (
              <li key={row.key} data-pv="row" className={cn("flex items-center gap-3 py-2.5", row.key === "card" && "hidden sm:flex")}>
                <span key={state} className="grid size-6 shrink-0 animate-in place-items-center duration-500 zoom-in-50 fade-in">
                  <Icon className={cn("size-[1.1rem]", state === "done" ? "text-forest" : state === "next" ? "text-gold" : "text-taupe")} aria-hidden />
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm", state === "done" ? "text-muted-foreground line-through decoration-taupe/60" : "text-foreground")}>
                  {t(`landing.preview.tasks.${row.key}`)}
                </span>
                <span className="hidden font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase sm:inline">{t(`stages.${row.stage}`)}</span>
                <span
                  className={cn(
                    "w-[5.5rem] shrink-0 text-right font-mono text-[0.65rem] tracking-wide uppercase",
                    state === "done" ? "text-forest" : state === "next" ? "text-gold" : "text-muted-foreground",
                  )}
                >
                  {t(`landing.preview.status.${state}`)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Floating source card */}
      <div data-pv="float" className="shape-cut-sm absolute -bottom-10 -left-6 hidden w-64 border border-hairline bg-background p-4 xl:block">
        <p className="flex items-center gap-2 text-xs font-medium text-forest">
          <ShieldCheckIcon className="size-4" aria-hidden />
          {t("landing.preview.sourceLabel")}
        </p>
        <p className="mt-2 font-heading text-sm leading-snug">{t(`landing.preview.tasks.${next}`)}</p>
        <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">{t("landing.features.reviewed", { date: t("landing.features.reviewedDate") })}</p>
      </div>
    </div>
  );
}
