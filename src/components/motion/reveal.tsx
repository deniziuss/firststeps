"use client";

import { useRef } from "react";
import { gsap, markRevealed, MOTION, ScrollTrigger, useGSAP } from "./gsap";

/**
 * Scroll reveal for server-rendered content. Wrap a section once; every descendant marked with
 * `data-reveal` fades and rises into place when it enters the viewport, in small staggered batches.
 * `data-reveal="line"` draws a rule from left to right instead. Content stays in the DOM and visible
 * to assistive technology; with reduced motion nothing moves.
 */
export function RevealScope({
  children,
  className,
  as: Tag = "div",
  trigger = "scroll",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "main";
  /** "scroll" reveals in batches as items enter the viewport; "load" plays one staggered sequence on mount. */
  trigger?: "scroll" | "load";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]:not([data-reveal='line'])", root);
      const lines = gsap.utils.toArray<HTMLElement>("[data-reveal='line']", root);
      const mm = gsap.matchMedia();

      mm.add(MOTION.ok, () => {
        gsap.set(items, { opacity: 0, y: 28 });
        gsap.set(lines, { scaleX: 0, transformOrigin: "0% 50%" });
        markRevealed([...items, ...lines]);
        if (trigger === "load") {
          gsap.to(items, { opacity: 1, y: 0, duration: 1, stagger: 0.09, delay });
          gsap.to(lines, { scaleX: 1, duration: 1.2, ease: "power2.inOut", delay });
          return;
        }
        ScrollTrigger.batch(items, {
          start: "top 90%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, overwrite: true }),
        });
        ScrollTrigger.batch(lines, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { scaleX: 1, duration: 1.2, ease: "power2.inOut", stagger: 0.1 }),
        });
      });

      mm.add(MOTION.reduce, () => markRevealed([...items, ...lines]));
    },
    { scope: ref, dependencies: [trigger, delay] },
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
