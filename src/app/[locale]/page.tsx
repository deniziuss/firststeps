import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingNav } from "@/components/landing/landing-nav";
import { DemoSection, FinalCta, LandingFooter, SupportSection } from "@/components/landing/sections";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { getI18n } from "@/i18n/server";

// Public landing page. Sections are server components; only the navigation, the product preview,
// the interactive demo and the motion wrappers run on the client. Lenis is mounted here only.
export default async function Home() {
  const { t } = await getI18n();
  return (
    <div id="top" className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only z-50 rounded-sm bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {t("common.skipToContent")}
      </a>
      <SmoothScroll />
      <LandingNav />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Hero t={t} />
        <HowItWorks t={t} />
        <Features t={t} samples={{ en: en.landing.features.sample, tr: tr.landing.features.sample }} />
        <DemoSection t={t} />
        <SupportSection t={t} />
        <FinalCta t={t} />
      </main>
      <LandingFooter t={t} />
    </div>
  );
}
