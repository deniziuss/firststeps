"use client";

import { useRef } from "react";
import { gsap, MOTION, ScrollTrigger, useGSAP } from "@/components/motion/gsap";

/**
 * Scroll-linked storytelling for the "How it works" list: a vertical rail fills as the reader moves
 * through the steps, and the step in the reading zone gets `data-active` (its number turns ochre).
 * Only decorative styling changes; the text itself is never dimmed or hidden.
 */
export function StepsRail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const steps = gsap.utils.toArray<HTMLElement>("[data-step]", root);
      const mm = gsap.matchMedia();

      mm.add(MOTION.ok, () => {
        gsap.fromTo(
          "[data-rail-fill]",
          { scaleY: 0 },
          { scaleY: 1, ease: "none", scrollTrigger: { trigger: root, start: "top 65%", end: "bottom 65%", scrub: 0.6 } },
        );
        for (const step of steps) {
          ScrollTrigger.create({
            trigger: step,
            start: "top 65%",
            end: "bottom 65%",
            onToggle: (self) => step.toggleAttribute("data-active", self.isActive),
          });
        }
      });
      mm.add(MOTION.reduce, () => {
        gsap.set("[data-rail-fill]", { scaleY: 1 });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="relative">
      <div aria-hidden className="absolute top-2 bottom-2 left-0 w-px bg-hairline">
        <div data-rail-fill className="h-full w-full origin-top scale-y-0 bg-ochre" />
      </div>
      {children}
    </div>
  );
}
