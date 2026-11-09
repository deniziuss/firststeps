"use client";

/*
  Adapted from React Bits "SplitText" (https://reactbits.dev/text-animations/split-text)
  Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0 (see THIRD_PARTY_NOTICES.md).

  FirstSteps changes:
  - Server-rendered heading stays readable without JavaScript; the CSS pre-hide only applies under
    html.js with motion allowed, and a failsafe reveals it if the script never runs.
  - Word-level masked rise only (no hover springs, loops or click triggers) to suit editorial headings.
  - Splits after fonts load, re-splits on resize (autoSplit with lines), and reverts cleanly on unmount.
  - GSAP SplitText `aria: "auto"` keeps the original sentence available to screen readers.
  - Reduced motion: no split, no movement.
*/
import { useEffect, useRef, useState } from "react";
import { gsap, markRevealed, MOTION, ScrollTrigger, SplitText as GSAPSplitText, useGSAP } from "@/components/motion/gsap";

type Tag = "h1" | "h2" | "h3" | "p" | "span";

export interface SplitTextProps {
  text: string;
  as?: Tag;
  id?: string;
  className?: string;
  /** "load" animates on mount (hero); "view" when the heading scrolls into view. */
  trigger?: "load" | "view";
  /** Seconds before the first word moves. */
  delay?: number;
  /** Seconds between words. */
  stagger?: number;
  duration?: number;
}

const fontsReady = () => typeof document !== "undefined" && (!document.fonts || document.fonts.status === "loaded");

export function SplitText({ text, as = "h2", id, className, trigger = "view", delay = 0, stagger = 0.045, duration = 1.1 }: SplitTextProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fontsLoaded, setFontsLoaded] = useState(fontsReady);

  useEffect(() => {
    if (fontsLoaded) return;
    let active = true;
    document.fonts.ready.then(() => active && setFontsLoaded(true));
    return () => {
      active = false;
    };
  }, [fontsLoaded]);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !fontsLoaded) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION.ok, () => {
        const split = GSAPSplitText.create(el, {
          type: "words,lines",
          mask: "lines",
          aria: "auto",
          autoSplit: true,
          linesClass: "split-line",
          wordsClass: "split-word",
          onSplit: (self) =>
            gsap.from(self.words, {
              yPercent: 110,
              opacity: 0,
              duration,
              delay,
              stagger,
              ease: "power4.out",
              scrollTrigger: trigger === "view" ? { trigger: el, start: "top 88%", once: true } : undefined,
            }),
        });
        markRevealed(el);
        return () => split.revert();
      });

      mm.add(MOTION.reduce, () => markRevealed(el));
    },
    { scope: ref, dependencies: [text, fontsLoaded, trigger, delay, stagger, duration], revertOnUpdate: true },
  );

  // ScrollTrigger positions depend on fonts; refresh once they settle.
  useEffect(() => {
    if (fontsLoaded) ScrollTrigger.refresh();
  }, [fontsLoaded]);

  const Tag = as;
  return (
    <Tag ref={ref} id={id} data-split="" className={className}>
      {text}
    </Tag>
  );
}
