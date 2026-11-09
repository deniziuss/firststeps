"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, MOTION, ScrollTrigger } from "./gsap";

/**
 * Lenis smooth scrolling for public storytelling pages only (mounted by the landing page).
 * - Driven by the GSAP ticker: one requestAnimationFrame loop for Lenis and ScrollTrigger.
 * - Not started when the reader prefers reduced motion; native scrolling stays in place.
 * - In-page anchors scroll through Lenis with an offset for the floating navigation.
 * - Nested scroll areas (menus, dialogs, code blocks) keep native scrolling.
 * - Destroyed on unmount, so application pages never inherit it.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia(MOTION.reduce).matches) return;

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.12,
      anchors: { offset: -96 },
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
      // Radix portals (menus, sheets, dialogs) scroll natively.
      prevent: (node) => node.closest("[data-radix-popper-content-wrapper], [role='dialog'], [data-lenis-prevent]") !== null,
    });

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Opening a modal (Radix sets data-scroll-locked on body) pauses smooth scrolling.
    const observer = new MutationObserver(() => {
      if (document.body.hasAttribute("data-scroll-locked")) lenis.stop();
      else lenis.start();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-scroll-locked"] });

    return () => {
      observer.disconnect();
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
