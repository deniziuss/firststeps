"use client";

import { CornerDownRightIcon, UserRoundCheckIcon } from "lucide-react";
import { useRef } from "react";
import { gsap, markRevealed, MOTION, useGSAP } from "@/components/motion/gsap";
import { useI18n } from "@/i18n/client";

/*
  Illustration of the asynchronous help-request workflow with example text: a question on a task,
  an assignment, and the mentor's answer kept on the request. Plays once when it scrolls into view.
  It is a picture of the workflow, not a chat, and is exposed as one labelled image.
*/
export function SupportFlow() {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION.ok, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 75%", once: true } });
        tl.from("[data-sf='frame']", { y: 32, autoAlpha: 0, duration: 1 })
          .from("[data-sf='question']", { y: 16, autoAlpha: 0, duration: 0.7 }, "-=0.5")
          .fromTo("[data-sf='status-open']", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3 }, "+=0.5")
          .from("[data-sf='status-assigned']", { autoAlpha: 0, y: 6, duration: 0.4 }, "<0.1")
          .from("[data-sf='assigned']", { autoAlpha: 0, x: -10, duration: 0.6 }, "<")
          .from("[data-sf='answer']", { y: 16, autoAlpha: 0, duration: 0.8 }, "+=0.4")
          .to("[data-sf='status-assigned']", { autoAlpha: 0, duration: 0.3 }, "+=0.2")
          .from("[data-sf='status-resolved']", { autoAlpha: 0, y: 6, duration: 0.4 }, "<0.1");
        markRevealed(el);
      });
      mm.add(MOTION.reduce, () => {
        gsap.set(["[data-sf='status-open']", "[data-sf='status-assigned']"], { autoAlpha: 0 });
        markRevealed(el);
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} data-motion="" role="img" aria-label={t("landing.support.sample.label")}>
      <div data-sf="frame" className="shape-cut border border-hairline bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
          <p className="min-w-0 font-heading text-lg tracking-[-0.02em]">{t("landing.support.sample.task")}</p>
          <span className="relative inline-grid font-mono text-[0.68rem] tracking-wide uppercase">
            {/* Three states share one cell; the timeline crossfades them. */}
            <span data-sf="status-open" className="col-start-1 row-start-1 rounded-full border border-ochre/60 bg-gold-soft px-2.5 py-1 text-foreground">
              {t("requestStatus.Open")}
            </span>
            <span data-sf="status-assigned" className="col-start-1 row-start-1 rounded-full border border-input px-2.5 py-1 text-foreground">
              {t("requestStatus.Assigned")}
            </span>
            <span data-sf="status-resolved" className="col-start-1 row-start-1 rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-success">
              {t("requestStatus.Resolved")}
            </span>
          </span>
        </div>

        <div data-sf="question" className="mt-5 grid gap-2">
          <p className="font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase">{t("landing.support.sample.student")}</p>
          <p className="shape-cut-sm bg-band p-4 leading-relaxed">{t("landing.support.sample.question")}</p>
        </div>

        <p data-sf="assigned" className="mt-4 flex items-center gap-2 text-sm text-foreground-soft">
          <UserRoundCheckIcon className="size-4 text-gold" aria-hidden />
          {t("landing.support.sample.assigned")}
        </p>

        <div data-sf="answer" className="mt-4 grid gap-2 sm:pl-10">
          <p className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-wide text-gold uppercase">
            <CornerDownRightIcon className="size-3.5" aria-hidden />
            {t("landing.support.sample.mentor")}
          </p>
          <p className="shape-cut-sm border border-ochre/40 bg-gold-soft p-4 leading-relaxed">{t("landing.support.sample.answer")}</p>
        </div>
      </div>
    </div>
  );
}
