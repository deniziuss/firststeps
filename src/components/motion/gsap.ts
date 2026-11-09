"use client";

// Single place where GSAP plugins are registered. Import GSAP from here in client components only,
// so the animation runtime stays out of server bundles and pages that do not animate.
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
}

/** Media queries used with gsap.matchMedia(): every animation has a reduced-motion branch. */
export const MOTION = {
  ok: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
} as const;

/** Marks reveal targets as handled so the CSS pre-hide (html.js [data-reveal]) no longer applies. */
export function markRevealed(targets: Element | Element[] | NodeListOf<Element>) {
  const list = targets instanceof Element ? [targets] : Array.from(targets);
  for (const el of list) el.setAttribute("data-revealed", "");
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
