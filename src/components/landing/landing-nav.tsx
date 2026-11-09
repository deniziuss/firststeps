"use client";

import { ArrowUpRightIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, markRevealed, MOTION, useGSAP } from "@/components/motion/gsap";
import { Brand } from "@/components/nav";
import { LanguageSwitcher, ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "how", label: "landing.nav.how" },
  { id: "features", label: "landing.nav.features" },
  { id: "support", label: "landing.nav.support" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Tracks which page section is in the reading zone (a band around 40% of the viewport height). */
function useActiveSection() {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    const visible = new Map<SectionId, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id as SectionId, entry.isIntersecting);
        setActive(SECTIONS.find((s) => visible.get(s.id))?.id ?? null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);
  return scrolled;
}

export function LandingNav() {
  const { t } = useI18n();
  const active = useActiveSection();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const pill = useRef<HTMLUListElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);

  // Entrance: the bar settles from above once, on first load.
  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-nav-item]", header.current);
      const mm = gsap.matchMedia();
      mm.add(MOTION.ok, () => {
        gsap.from(items, { y: -16, opacity: 0, duration: 0.8, stagger: 0.06, delay: 0.1 });
        markRevealed(items);
      });
      mm.add(MOTION.reduce, () => markRevealed(items));
    },
    { scope: header },
  );

  // The active-section indicator slides between links (CSS transition on transform and width).
  useIsoLayoutEffect(() => {
    const list = pill.current;
    const mark = indicator.current;
    if (!list || !mark) return;
    const place = () => {
      const link = active ? list.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
      if (!link) {
        mark.style.opacity = "0";
        return;
      }
      mark.style.opacity = "1";
      mark.style.width = `${link.offsetWidth}px`;
      mark.style.transform = `translateX(${link.offsetLeft}px)`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);

  return (
    <header ref={header} className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4 print:hidden">
      <div
        className={cn(
          "mx-auto flex max-w-page items-center justify-between gap-2 rounded-full border py-1.5 pr-1.5 pl-4 transition-[background-color,border-color] duration-300 sm:pl-5",
          scrolled ? "border-hairline bg-background/85 backdrop-blur-md" : "border-transparent bg-transparent",
        )}
      >
        <div data-nav-item data-reveal="">
          <Brand />
        </div>

        <nav aria-label={t("landing.nav.label")} data-nav-item data-reveal="" className="hidden lg:block">
          <ul ref={pill} className="relative flex items-center gap-1 rounded-full bg-band/90 p-1">
            <span
              ref={indicator}
              aria-hidden
              className="absolute top-1 bottom-1 left-0 rounded-full bg-card opacity-0 ring-1 ring-hairline transition-[transform,width,opacity] duration-500 ease-editorial"
            />
            {SECTIONS.map((section) => (
              <li key={section.id} className="relative">
                <a
                  href={`#${section.id}`}
                  data-section={section.id}
                  aria-current={active === section.id ? "location" : undefined}
                  className="flex min-h-10 items-center rounded-full px-4 font-heading text-[0.95rem] tracking-[-0.01em] text-foreground-soft transition-colors hover:text-foreground aria-[current]:text-foreground"
                >
                  {t(section.label)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div data-nav-item data-reveal="" className="flex items-center gap-1">
          <div className="hidden items-center gap-0.5 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/sign-in">{t("landing.nav.signIn")}</Link>
          </Button>
          <Button asChild className="rounded-full px-5">
            <Link href="/register">
              {t("landing.nav.getStarted")}
              <ArrowUpRightIcon aria-hidden className="transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
            </Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full lg:hidden" aria-label={t("common.openMenu")}>
                <MenuIcon aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" closeLabel={t("common.close")} className="w-full gap-8 bg-background p-6 sm:max-w-sm">
              <SheetTitle className="font-heading text-sm font-normal tracking-normal text-muted-foreground">{t("landing.nav.menuTitle")}</SheetTitle>
              <SheetDescription className="sr-only">{t("landing.nav.menuDescription")}</SheetDescription>
              <nav aria-label={t("landing.nav.label")}>
                <ul className="grid">
                  {SECTIONS.map((section, index) => (
                    <li key={section.id} className="border-b border-hairline">
                      <a
                        href={`#${section.id}`}
                        onClick={() => setOpen(false)}
                        className="flex min-h-16 items-baseline gap-4 font-heading text-3xl font-light tracking-[-0.03em]"
                      >
                        <span className="font-mono text-xs text-gold" aria-hidden>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {t(section.label)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="grid gap-2">
                <Button asChild size="lg">
                  <Link href="/register">{t("landing.nav.getStarted")}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/sign-in">{t("landing.nav.signIn")}</Link>
                </Button>
              </div>
              <div className="mt-auto grid gap-2 border-t border-hairline pt-4">
                <p className="eyebrow">{t("landing.nav.preferences")}</p>
                <div className="flex gap-2">
                  <LanguageSwitcher withLabel />
                  <ThemeToggle withLabel />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
