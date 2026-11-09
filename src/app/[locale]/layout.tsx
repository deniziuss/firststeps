import type { Metadata } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import { notFound } from "next/navigation";
import { ThemeProvider } from "@/components/theme";
import { I18nProvider } from "@/i18n/client";
import { isLocale, LOCALES } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import "../globals.css";

// Inter Tight (display, weight 300–500) and Inter (body/UI) are SIL OFL licensed; Geist Mono sets data labels.
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });

// Marks the document as script-enabled before first paint, so reveal animations can hide their
// targets without a flash. Without JavaScript the class is missing and everything stays visible.
const JS_FLAG = "document.documentElement.classList.add('js')";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: "FirstSteps", template: "%s · FirstSteps" },
    description: t("landing.intro"),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${interTight.variable} ${geistMono.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="min-h-full">
        <I18nProvider locale={locale}>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
